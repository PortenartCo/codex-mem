/**
 * Session Routes
 *
 * Handles session lifecycle operations: initialization, observations, summarization, completion.
 * These routes manage the flow of work through the Claude Agent SDK.
 */

import express, { Request, Response } from 'express';
import { getWorkerPort } from '../../../../shared/worker-utils.js';
import { logger } from '../../../../utils/logger.js';
import { stripMemoryTagsFromJson, stripMemoryTagsFromPrompt } from '../../../../utils/tag-stripping.js';
import { SessionManager } from '../../SessionManager.js';
import { DatabaseManager } from '../../DatabaseManager.js';
import { SDKAgent } from '../../SDKAgent.js';
import { GeminiAgent, isGeminiSelected, isGeminiAvailable } from '../../GeminiAgent.js';
import { OpenRouterAgent, isOpenRouterSelected, isOpenRouterAvailable } from '../../OpenRouterAgent.js';
import type { WorkerService } from '../../../worker-service.js';
import { BaseRouteHandler } from '../BaseRouteHandler.js';
import { SessionEventBroadcaster } from '../../events/SessionEventBroadcaster.js';
import { SessionCompletionHandler } from '../../session/SessionCompletionHandler.js';
import { PrivacyCheckValidator } from '../../validation/PrivacyCheckValidator.js';
import { SettingsDefaultsManager } from '../../../../shared/SettingsDefaultsManager.js';
import { USER_SETTINGS_PATH } from '../../../../shared/paths.js';
import { getProcessBySession, ensureProcessExit } from '../../ProcessRegistry.js';
import { buildNormalizedEvent } from '../../../platform/normalization.js';
import { getRepoContext } from '../../../platform/repo-context.js';
import type { NormalizedEvent, SessionMetadata } from '../../../platform/types.js';

export class SessionRoutes extends BaseRouteHandler {
  private completionHandler: SessionCompletionHandler;
  private spawnInProgress = new Map<number, boolean>();
  private crashRecoveryScheduled = new Set<number>();

  constructor(
    private sessionManager: SessionManager,
    private dbManager: DatabaseManager,
    private sdkAgent: SDKAgent,
    private geminiAgent: GeminiAgent,
    private openRouterAgent: OpenRouterAgent,
    private eventBroadcaster: SessionEventBroadcaster,
    private workerService: WorkerService
  ) {
    super();
    this.completionHandler = new SessionCompletionHandler(
      sessionManager,
      eventBroadcaster,
      dbManager
    );
  }

  /**
   * Get the appropriate agent based on settings
   * Throws error if provider is selected but not configured (no silent fallback)
   *
   * Note: Session linking via contentSessionId allows provider switching mid-session.
   * The conversationHistory on ActiveSession maintains context across providers.
   */
  private getActiveAgent(): SDKAgent | GeminiAgent | OpenRouterAgent {
    if (isOpenRouterSelected()) {
      if (isOpenRouterAvailable()) {
        logger.debug('SESSION', 'Using OpenRouter agent');
        return this.openRouterAgent;
      } else {
        throw new Error('OpenRouter provider selected but no API key configured. Set CLAUDE_MEM_OPENROUTER_API_KEY in settings or OPENROUTER_API_KEY environment variable.');
      }
    }
    if (isGeminiSelected()) {
      if (isGeminiAvailable()) {
        logger.debug('SESSION', 'Using Gemini agent');
        return this.geminiAgent;
      } else {
        throw new Error('Gemini provider selected but no API key configured. Set CLAUDE_MEM_GEMINI_API_KEY in settings or GEMINI_API_KEY environment variable.');
      }
    }
    return this.sdkAgent;
  }

  /**
   * Get the currently selected provider name
   */
  private getSelectedProvider(): 'claude' | 'gemini' | 'openrouter' {
    if (isOpenRouterSelected() && isOpenRouterAvailable()) {
      return 'openrouter';
    }
    return (isGeminiSelected() && isGeminiAvailable()) ? 'gemini' : 'claude';
  }

  /**
   * Ensures agent generator is running for a session
   * Auto-starts if not already running to process pending queue
   * Uses either Claude SDK or Gemini based on settings
   *
   * Provider switching: If provider setting changed while generator is running,
   * we let the current generator finish naturally (max 5s linger timeout).
   * The next generator will use the new provider with shared conversationHistory.
   */
  private static readonly STALE_GENERATOR_THRESHOLD_MS = 30_000; // 30 seconds (#1099)

  private ensureGeneratorRunning(sessionDbId: number, source: string): void {
    const session = this.sessionManager.getSession(sessionDbId);
    if (!session) return;

    // GUARD: Prevent duplicate spawns
    if (this.spawnInProgress.get(sessionDbId)) {
      logger.debug('SESSION', 'Spawn already in progress, skipping', { sessionDbId, source });
      return;
    }

    const selectedProvider = this.getSelectedProvider();

    // Start generator if not running
    if (!session.generatorPromise) {
      this.spawnInProgress.set(sessionDbId, true);
      this.startGeneratorWithProvider(session, selectedProvider, source);
      return;
    }

    // Generator is running - check if stale (no activity for 30s) to prevent queue stall (#1099)
    const timeSinceActivity = Date.now() - session.lastGeneratorActivity;
    if (timeSinceActivity > SessionRoutes.STALE_GENERATOR_THRESHOLD_MS) {
      logger.warn('SESSION', 'Stale generator detected, aborting to prevent queue stall (#1099)', {
        sessionId: sessionDbId,
        timeSinceActivityMs: timeSinceActivity,
        thresholdMs: SessionRoutes.STALE_GENERATOR_THRESHOLD_MS,
        source
      });
      // Abort the stale generator and reset state
      session.abortController.abort();
      session.generatorPromise = null;
      session.abortController = new AbortController();
      session.lastGeneratorActivity = Date.now();
      // Start a fresh generator
      this.spawnInProgress.set(sessionDbId, true);
      this.startGeneratorWithProvider(session, selectedProvider, 'stale-recovery');
      return;
    }

    // Generator is running - check if provider changed
    if (session.currentProvider && session.currentProvider !== selectedProvider) {
      logger.info('SESSION', `Provider changed, will switch after current generator finishes`, {
        sessionId: sessionDbId,
        currentProvider: session.currentProvider,
        selectedProvider,
        historyLength: session.conversationHistory.length
      });
      // Let current generator finish naturally, next one will use new provider
      // The shared conversationHistory ensures context is preserved
    }
  }

  /**
   * Start a generator with the specified provider
   */
  private startGeneratorWithProvider(
    session: ReturnType<typeof this.sessionManager.getSession>,
    provider: 'claude' | 'gemini' | 'openrouter',
    source: string
  ): void {
    if (!session) return;

    // Reset AbortController if it was previously aborted
    // This fixes the bug where a session gets stuck in an infinite "Generator aborted" loop
    // after its AbortController was aborted (e.g., from a previous generator exit)
    if (session.abortController.signal.aborted) {
      logger.debug('SESSION', 'Resetting aborted AbortController before starting generator', {
        sessionId: session.sessionDbId
      });
      session.abortController = new AbortController();
    }

    const agent = provider === 'openrouter' ? this.openRouterAgent : (provider === 'gemini' ? this.geminiAgent : this.sdkAgent);
    const agentName = provider === 'openrouter' ? 'OpenRouter' : (provider === 'gemini' ? 'Gemini' : 'Claude SDK');

    // Use database count for accurate telemetry (in-memory array is always empty due to FK constraint fix)
    const pendingStore = this.sessionManager.getPendingMessageStore();
    const actualQueueDepth = pendingStore.getPendingCount(session.sessionDbId);

    logger.info('SESSION', `Generator auto-starting (${source}) using ${agentName}`, {
      sessionId: session.sessionDbId,
      queueDepth: actualQueueDepth,
      historyLength: session.conversationHistory.length
    });

    // Track which provider is running and mark activity for stale detection (#1099)
    session.currentProvider = provider;
    session.lastGeneratorActivity = Date.now();

    session.generatorPromise = agent.startSession(session, this.workerService)
      .catch(error => {
        // Only log non-abort errors
        if (session.abortController.signal.aborted) return;
        
        logger.error('SESSION', `Generator failed`, {
          sessionId: session.sessionDbId,
          provider: provider,
          error: error.message
        }, error);

        // Mark all processing messages as failed so they can be retried or abandoned
        const pendingStore = this.sessionManager.getPendingMessageStore();
        try {
          const failedCount = pendingStore.markSessionMessagesFailed(session.sessionDbId);
          if (failedCount > 0) {
            logger.error('SESSION', `Marked messages as failed after generator error`, {
              sessionId: session.sessionDbId,
              failedCount
            });
          }
        } catch (dbError) {
          logger.error('SESSION', 'Failed to mark messages as failed', {
            sessionId: session.sessionDbId
          }, dbError as Error);
        }
      })
      .finally(async () => {
        // CRITICAL: Verify subprocess exit to prevent zombie accumulation (Issue #1168)
        const tracked = getProcessBySession(session.sessionDbId);
        if (tracked && !tracked.process.killed && tracked.process.exitCode === null) {
          await ensureProcessExit(tracked, 5000);
        }

        const sessionDbId = session.sessionDbId;
        this.spawnInProgress.delete(sessionDbId);
        const wasAborted = session.abortController.signal.aborted;

        if (wasAborted) {
          logger.info('SESSION', `Generator aborted`, { sessionId: sessionDbId });
        } else {
          logger.error('SESSION', `Generator exited unexpectedly`, { sessionId: sessionDbId });
        }

        session.generatorPromise = null;
        session.currentProvider = null;
        this.workerService.broadcastProcessingStatus();

        // Crash recovery: If not aborted and still has work, restart (with limit)
        if (!wasAborted) {
          try {
            const pendingStore = this.sessionManager.getPendingMessageStore();
            const pendingCount = pendingStore.getPendingCount(sessionDbId);

            // CRITICAL: Limit consecutive restarts to prevent infinite loops
            // This prevents runaway API costs when there's a persistent error (e.g., memorySessionId not captured)
            const MAX_CONSECUTIVE_RESTARTS = 3;

            if (pendingCount > 0) {
              // GUARD: Prevent duplicate crash recovery spawns
              if (this.crashRecoveryScheduled.has(sessionDbId)) {
                logger.debug('SESSION', 'Crash recovery already scheduled', { sessionDbId });
                return;
              }

              session.consecutiveRestarts = (session.consecutiveRestarts || 0) + 1;

              if (session.consecutiveRestarts > MAX_CONSECUTIVE_RESTARTS) {
                logger.error('SESSION', `CRITICAL: Generator restart limit exceeded - stopping to prevent runaway costs`, {
                  sessionId: sessionDbId,
                  pendingCount,
                  consecutiveRestarts: session.consecutiveRestarts,
                  maxRestarts: MAX_CONSECUTIVE_RESTARTS,
                  action: 'Generator will NOT restart. Check logs for root cause. Messages remain in pending state.'
                });
                // Don't restart - abort to prevent further API calls
                session.abortController.abort();
                return;
              }

              logger.info('SESSION', `Restarting generator after crash/exit with pending work`, {
                sessionId: sessionDbId,
                pendingCount,
                consecutiveRestarts: session.consecutiveRestarts,
                maxRestarts: MAX_CONSECUTIVE_RESTARTS
              });

              // Abort OLD controller before replacing to prevent child process leaks
              const oldController = session.abortController;
              session.abortController = new AbortController();
              oldController.abort();

              this.crashRecoveryScheduled.add(sessionDbId);

              // Exponential backoff: 1s, 2s, 4s for subsequent restarts
              const backoffMs = Math.min(1000 * Math.pow(2, session.consecutiveRestarts - 1), 8000);

              // Delay before restart with exponential backoff
              setTimeout(() => {
                this.crashRecoveryScheduled.delete(sessionDbId);
                const stillExists = this.sessionManager.getSession(sessionDbId);
                if (stillExists && !stillExists.generatorPromise) {
                  this.startGeneratorWithProvider(stillExists, this.getSelectedProvider(), 'crash-recovery');
                }
              }, backoffMs);
            } else {
              // No pending work - abort to kill the child process
              session.abortController.abort();
              // Reset restart counter on successful completion
              session.consecutiveRestarts = 0;
              logger.debug('SESSION', 'Aborted controller after natural completion', {
                sessionId: sessionDbId
              });
            }
          } catch (e) {
            // Ignore errors during recovery check, but still abort to prevent leaks
            logger.debug('SESSION', 'Error during recovery check, aborting to prevent leaks', { sessionId: sessionDbId, error: e instanceof Error ? e.message : String(e) });
            session.abortController.abort();
          }
        }
        // NOTE: We do NOT delete the session here anymore.
        // The generator waits for events, so if it exited, it's either aborted or crashed.
        // Idle sessions stay in memory (ActiveSession is small) to listen for future events.
      });
  }

  private buildContentSessionId(metadata: Pick<SessionMetadata, 'platform' | 'clientKind' | 'platformSessionId'>): string {
    if (metadata.platform === 'claude' && metadata.clientKind === 'claude-code') {
      return metadata.platformSessionId;
    }

    return `${metadata.platform}:${metadata.clientKind}:${metadata.platformSessionId}`;
  }

  private getRequestSessionMetadata(
    body: Record<string, any>,
    defaults: Partial<SessionMetadata> = {}
  ): SessionMetadata {
    const cwd = typeof body.cwd === 'string' && body.cwd.trim() ? body.cwd : defaults.cwd || null;
    const repo = cwd ? getRepoContext(cwd) : null;

    const platform = (body.platform || defaults.platform || 'claude') as SessionMetadata['platform'];
    const clientKind = (
      body.clientKind ||
      body.client_kind ||
      defaults.clientKind ||
      (platform === 'cursor' ? 'cursor' : 'claude-code')
    ) as SessionMetadata['clientKind'];
    const captureMode = (
      body.captureMode ||
      body.capture_mode ||
      defaults.captureMode ||
      'hook'
    ) as SessionMetadata['captureMode'];
    const platformSessionId = String(
      body.platformSessionId ||
      body.platform_session_id ||
      defaults.platformSessionId ||
      body.contentSessionId ||
      body.content_session_id
    );

    return {
      platform,
      clientKind,
      captureMode,
      platformSessionId,
      platformTurnId: body.platformTurnId || body.platform_turn_id || defaults.platformTurnId || null,
      itemId: body.itemId || body.item_id || defaults.itemId || null,
      parentSessionId: body.parentSessionId || body.parent_session_id || defaults.parentSessionId || null,
      agentRole: body.agentRole || body.agent_role || defaults.agentRole || null,
      cwd,
      project: body.project || defaults.project || repo?.project || 'unknown',
      repoRoot: body.repoRoot || body.repo_root || defaults.repoRoot || repo?.repoRoot || null,
      repoId: body.repoId || body.repo_id || defaults.repoId || repo?.repoId || null,
      gitBranch: body.gitBranch || body.git_branch || defaults.gitBranch || repo?.gitBranch || null,
      gitCommit: body.gitCommit || body.git_commit || defaults.gitCommit || repo?.gitCommit || null
    };
  }

  private sanitizeText(text: string | null | undefined): string | null {
    if (!text) return null;

    const cleaned = stripMemoryTagsFromPrompt(text);
    return cleaned && cleaned.trim() ? cleaned : null;
  }

  private sanitizeStructuredPayload(payload: unknown): unknown {
    if (payload === undefined || payload === null) {
      return undefined;
    }

    if (typeof payload === 'string') {
      return this.sanitizeText(payload) || payload;
    }

    try {
      const cleaned = stripMemoryTagsFromJson(JSON.stringify(payload));
      return JSON.parse(cleaned);
    } catch {
      return payload;
    }
  }

  private broadcastLatestPrompt(contentSessionId: string): void {
    const latestPrompt = this.dbManager.getSessionStore().getLatestUserPrompt(contentSessionId);
    if (!latestPrompt) return;

    this.eventBroadcaster.broadcastNewPrompt({
      id: latestPrompt.id,
      content_session_id: latestPrompt.content_session_id,
      project: latestPrompt.project,
      prompt_number: latestPrompt.prompt_number,
      prompt_text: latestPrompt.prompt_text,
      created_at_epoch: latestPrompt.created_at_epoch
    });

    const chromaSync = this.dbManager.getChromaSync();
    if (!chromaSync) return;

    const chromaStart = Date.now();
    const promptText = latestPrompt.prompt_text;
    chromaSync.syncUserPrompt(
      latestPrompt.id,
      latestPrompt.memory_session_id,
      latestPrompt.project,
      promptText,
      latestPrompt.prompt_number,
      latestPrompt.created_at_epoch
    ).then(() => {
      logger.debug('CHROMA', 'User prompt synced', {
        promptId: latestPrompt.id,
        duration: `${Date.now() - chromaStart}ms`
      });
    }).catch((error) => {
      logger.error('CHROMA', 'User prompt sync failed, continuing without vector search', {
        promptId: latestPrompt.id
      }, error);
    });
  }

  private coerceNormalizedEvent(input: any): NormalizedEvent {
    if (input && typeof input === 'object' && input.id && input.payloadJson && input.payloadHash) {
      return input as NormalizedEvent;
    }

    const repo = getRepoContext(input?.cwd || process.cwd());
    const platform = input?.platform || 'manual';
    const clientKind = input?.clientKind || input?.client_kind || 'unknown';
    const captureMode = input?.captureMode || input?.capture_mode || 'manual';
    const platformSessionId = String(input?.platformSessionId || input?.platform_session_id || input?.contentSessionId || input?.content_session_id || `session-${Date.now()}`);

    return buildNormalizedEvent({
      platform,
      clientKind,
      captureMode,
      platformSessionId,
      platformTurnId: input?.platformTurnId || input?.platform_turn_id || null,
      itemId: input?.itemId || input?.item_id || null,
      parentSessionId: input?.parentSessionId || input?.parent_session_id || null,
      agentRole: input?.agentRole || input?.agent_role || null,
      cwd: input?.cwd || repo.cwd,
      project: input?.project || repo.project,
      repoRoot: input?.repoRoot || input?.repo_root || repo.repoRoot,
      repoId: input?.repoId || input?.repo_id || repo.repoId,
      gitBranch: input?.gitBranch || input?.git_branch || repo.gitBranch,
      gitCommit: input?.gitCommit || input?.git_commit || repo.gitCommit,
      eventType: input?.eventType || input?.event_type || 'tool.output',
      createdAtEpochMs: Number(input?.createdAtEpochMs || input?.created_at_epoch_ms || input?.created_at_epoch || Date.now()),
      privacyState: input?.privacyState || input?.privacy_state || 'normal',
      sourceConfidence: input?.sourceConfidence || input?.source_confidence || 'low',
      captureFidelity: input?.captureFidelity || input?.capture_fidelity || 'low',
      promptText: input?.promptText || input?.prompt_text || null,
      assistantText: input?.assistantText || input?.assistant_text || null,
      summaryText: input?.summaryText || input?.summary_text || null,
      toolName: input?.toolName || input?.tool_name || null,
      toolInput: input?.toolInput ?? input?.tool_input,
      toolOutput: input?.toolOutput ?? input?.tool_output,
      payload: input?.payload ?? input
    });
  }

  private shouldQueueObservationEvent(event: NormalizedEvent): boolean {
    if (event.eventType === 'tool.output') {
      return true;
    }

    if (event.eventType === 'approval.requested' || event.eventType === 'approval.resolved') {
      return true;
    }

    if (!['command.execution', 'file.change', 'web.search', 'context.compacted'].includes(event.eventType)) {
      return false;
    }

    return Boolean(event.toolOutput ?? event.assistantText ?? event.summaryText);
  }

  private recordCompatibilityEvent(event: NormalizedEvent, sessionDbId: number): number {
    const result = this.dbManager.getSessionStore().storeRawEvent(event, sessionDbId);
    return result.id;
  }

  private ingestNormalizedEvents(events: NormalizedEvent[]): Array<{
    eventId: string;
    eventType: string;
    contentSessionId: string;
    sessionDbId: number;
    rawEventId: number;
    inserted: boolean;
  }> {
    const store = this.dbManager.getSessionStore();
    const eventTypeRank: Record<string, number> = {
      'session.started': 0,
      'prompt.submitted': 1,
      'tool.used': 2,
      'tool.output': 3,
      'command.execution': 3,
      'file.change': 3,
      'web.search': 3,
      'approval.requested': 3,
      'approval.resolved': 3,
      'context.compacted': 3,
      'turn.completed': 4,
      'session.completed': 5
    };
    const results: Array<{
      eventId: string;
      eventType: string;
      contentSessionId: string;
      sessionDbId: number;
      rawEventId: number;
      inserted: boolean;
    }> = [];

    const ordered = [...events].sort((left, right) => {
      if (left.createdAtEpochMs !== right.createdAtEpochMs) {
        return left.createdAtEpochMs - right.createdAtEpochMs;
      }
      return (eventTypeRank[left.eventType] ?? 99) - (eventTypeRank[right.eventType] ?? 99);
    });

    for (const event of ordered) {
      const contentSessionId = this.buildContentSessionId(event);
      const project = event.project || 'unknown';
      const seedPrompt = this.sanitizeText(event.promptText || event.summaryText || '') || '';
      const sessionDbId = store.createSDKSession(
        contentSessionId,
        project,
        seedPrompt,
        undefined,
        event,
        event.createdAtEpochMs
      );
      const rawEvent = store.storeRawEvent(event, sessionDbId);

      results.push({
        eventId: event.id,
        eventType: event.eventType,
        contentSessionId,
        sessionDbId,
        rawEventId: rawEvent.id,
        inserted: rawEvent.inserted
      });

      if (!rawEvent.inserted) {
        if (event.eventType === 'session.completed') {
          store.markSessionCompleted(sessionDbId, event.createdAtEpochMs);
        }
        continue;
      }

      if (event.eventType === 'session.started') {
        this.eventBroadcaster.broadcastSessionStarted(sessionDbId, project);
        continue;
      }

      if (event.eventType === 'prompt.submitted') {
        const cleanedPrompt = this.sanitizeText(event.promptText || '');
        if (!cleanedPrompt) {
          continue;
        }

        const promptNumber = store.getPromptNumberFromUserPrompts(contentSessionId) + 1;
        store.saveUserPrompt(
          contentSessionId,
          promptNumber,
          cleanedPrompt,
          {
            ...event,
            rawEventId: rawEvent.id
          },
          event.createdAtEpochMs
        );
        this.sessionManager.initializeSession(sessionDbId, cleanedPrompt, promptNumber);
        this.broadcastLatestPrompt(contentSessionId);
        continue;
      }

      if (this.shouldQueueObservationEvent(event)) {
        const promptNumber = store.getPromptNumberFromUserPrompts(contentSessionId);
        if (promptNumber < 1) {
          logger.debug('SESSION', 'Skipping observation event without visible prompt', {
            sessionDbId,
            contentSessionId,
            eventType: event.eventType
          });
          continue;
        }

        const userPrompt = PrivacyCheckValidator.checkUserPromptPrivacy(
          store,
          contentSessionId,
          promptNumber,
          'observation',
          sessionDbId,
          { eventType: event.eventType, tool_name: event.toolName }
        );
        if (!userPrompt) {
          continue;
        }

        this.sessionManager.queueObservation(sessionDbId, {
          tool_name: event.toolName || event.eventType,
          tool_input: this.sanitizeStructuredPayload(event.toolInput),
          tool_response: this.sanitizeStructuredPayload(
            event.toolOutput ?? event.assistantText ?? event.summaryText
          ),
          prompt_number: promptNumber,
          cwd: event.cwd || event.repoRoot || undefined,
          raw_event_id: rawEvent.id,
          platform: event.platform,
          client_kind: event.clientKind,
          capture_mode: event.captureMode,
          platform_turn_id: event.platformTurnId || undefined,
          repo_root: event.repoRoot || undefined,
          repo_id: event.repoId || undefined,
          git_branch: event.gitBranch || undefined,
          git_commit: event.gitCommit || undefined,
          parent_session_id: event.parentSessionId || undefined,
          agent_role: event.agentRole || undefined,
          source_event_epoch: event.createdAtEpochMs
        });
        this.ensureGeneratorRunning(sessionDbId, `event:${event.eventType}`);
        this.eventBroadcaster.broadcastObservationQueued(sessionDbId);
        continue;
      }

      if (event.eventType === 'turn.completed') {
        const promptNumber = store.getPromptNumberFromUserPrompts(contentSessionId);
        if (promptNumber < 1) {
          logger.debug('SESSION', 'Skipping summarize event without visible prompt', {
            sessionDbId,
            contentSessionId
          });
          continue;
        }

        const userPrompt = PrivacyCheckValidator.checkUserPromptPrivacy(
          store,
          contentSessionId,
          promptNumber,
          'summarize',
          sessionDbId
        );
        if (!userPrompt) {
          continue;
        }

        this.sessionManager.initializeSession(sessionDbId);
        this.sessionManager.queueSummarize(
          sessionDbId,
          this.sanitizeText(event.assistantText || event.summaryText || '') || undefined,
          event.createdAtEpochMs
        );
        this.ensureGeneratorRunning(sessionDbId, `event:${event.eventType}`);
        this.eventBroadcaster.broadcastSummarizeQueued();
        continue;
      }

      if (event.eventType === 'session.completed') {
        store.markSessionCompleted(sessionDbId, event.createdAtEpochMs);
        this.eventBroadcaster.broadcastSessionCompleted(sessionDbId);
      }
    }

    return results;
  }

  setupRoutes(app: express.Application): void {
    // Legacy session endpoints (use sessionDbId)
    app.post('/sessions/:sessionDbId/init', this.handleSessionInit.bind(this));
    app.post('/sessions/:sessionDbId/observations', this.handleObservations.bind(this));
    app.post('/sessions/:sessionDbId/summarize', this.handleSummarize.bind(this));
    app.get('/sessions/:sessionDbId/status', this.handleSessionStatus.bind(this));
    app.delete('/sessions/:sessionDbId', this.handleSessionDelete.bind(this));
    app.post('/sessions/:sessionDbId/complete', this.handleSessionComplete.bind(this));

    // New session endpoints (use contentSessionId)
    app.post('/api/sessions/init', this.handleSessionInitByClaudeId.bind(this));
    app.post('/api/sessions/observations', this.handleObservationsByClaudeId.bind(this));
    app.post('/api/sessions/summarize', this.handleSummarizeByClaudeId.bind(this));
    app.post('/api/sessions/complete', this.handleCompleteByClaudeId.bind(this));

    // Generic event-sourced ingress
    app.post('/api/events/ingest', this.handleEventIngest.bind(this));
    app.post('/api/events/batch', this.handleEventBatch.bind(this));
    app.get('/api/events', this.handleGetEvents.bind(this));
    app.get('/api/replay/:platformSessionId', this.handleReplay.bind(this));
    app.get('/api/session-graph/:platformSessionId', this.handleSessionGraph.bind(this));
  }

  /**
   * Initialize a new session
   */
  private handleSessionInit = this.wrapHandler((req: Request, res: Response): void => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) return;

    const { userPrompt, promptNumber } = req.body;
    logger.info('HTTP', 'SessionRoutes: handleSessionInit called', {
      sessionDbId,
      promptNumber,
      has_userPrompt: !!userPrompt
    });

    const session = this.sessionManager.initializeSession(sessionDbId, userPrompt, promptNumber);

    // Get the latest user_prompt for this session to sync to Chroma
    const latestPrompt = this.dbManager.getSessionStore().getLatestUserPrompt(session.contentSessionId);

    // Broadcast new prompt to SSE clients (for web UI)
    if (latestPrompt) {
      this.eventBroadcaster.broadcastNewPrompt({
        id: latestPrompt.id,
        content_session_id: latestPrompt.content_session_id,
        project: latestPrompt.project,
        prompt_number: latestPrompt.prompt_number,
        prompt_text: latestPrompt.prompt_text,
        created_at_epoch: latestPrompt.created_at_epoch
      });

      // Sync user prompt to Chroma
      const chromaSync = this.dbManager.getChromaSync();
      if (chromaSync) {
        const chromaStart = Date.now();
        const promptText = latestPrompt.prompt_text;
        chromaSync.syncUserPrompt(
          latestPrompt.id,
          latestPrompt.memory_session_id,
          latestPrompt.project,
          promptText,
          latestPrompt.prompt_number,
          latestPrompt.created_at_epoch
        ).then(() => {
          const chromaDuration = Date.now() - chromaStart;
          const truncatedPrompt = promptText.length > 60
            ? promptText.substring(0, 60) + '...'
            : promptText;
          logger.debug('CHROMA', 'User prompt synced', {
            promptId: latestPrompt.id,
            duration: `${chromaDuration}ms`,
            prompt: truncatedPrompt
          });
        }).catch((error) => {
          logger.error('CHROMA', 'User prompt sync failed, continuing without vector search', {
            promptId: latestPrompt.id,
            prompt: promptText.length > 60 ? promptText.substring(0, 60) + '...' : promptText
          }, error);
        });
      }
    }

    // Idempotent: ensure generator is running (matches handleObservations / handleSummarize)
    this.ensureGeneratorRunning(sessionDbId, 'init');

    // Broadcast session started event
    this.eventBroadcaster.broadcastSessionStarted(sessionDbId, session.project);

    res.json({ status: 'initialized', sessionDbId, port: getWorkerPort() });
  });

  /**
   * Queue observations for processing
   * CRITICAL: Ensures SDK agent is running to process the queue (ALWAYS SAVE EVERYTHING)
   */
  private handleObservations = this.wrapHandler((req: Request, res: Response): void => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) return;

    const { tool_name, tool_input, tool_response, prompt_number, cwd } = req.body;

    this.sessionManager.queueObservation(sessionDbId, {
      tool_name,
      tool_input,
      tool_response,
      prompt_number,
      cwd
    });

    // CRITICAL: Ensure SDK agent is running to consume the queue
    this.ensureGeneratorRunning(sessionDbId, 'observation');

    // Broadcast observation queued event
    this.eventBroadcaster.broadcastObservationQueued(sessionDbId);

    res.json({ status: 'queued' });
  });

  /**
   * Queue summarize request
   * CRITICAL: Ensures SDK agent is running to process the queue (ALWAYS SAVE EVERYTHING)
   */
  private handleSummarize = this.wrapHandler((req: Request, res: Response): void => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) return;

    const { last_assistant_message } = req.body;

    this.sessionManager.queueSummarize(sessionDbId, last_assistant_message);

    // CRITICAL: Ensure SDK agent is running to consume the queue
    this.ensureGeneratorRunning(sessionDbId, 'summarize');

    // Broadcast summarize queued event
    this.eventBroadcaster.broadcastSummarizeQueued();

    res.json({ status: 'queued' });
  });

  /**
   * Get session status
   */
  private handleSessionStatus = this.wrapHandler((req: Request, res: Response): void => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) return;

    const session = this.sessionManager.getSession(sessionDbId);

    if (!session) {
      res.json({ status: 'not_found' });
      return;
    }

    // Use database count for accurate queue length (in-memory array is always empty due to FK constraint fix)
    const pendingStore = this.sessionManager.getPendingMessageStore();
    const queueLength = pendingStore.getPendingCount(sessionDbId);

    res.json({
      status: 'active',
      sessionDbId,
      project: session.project,
      queueLength,
      uptime: Date.now() - session.startTime
    });
  });

  /**
   * Delete a session
   */
  private handleSessionDelete = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) return;

    await this.completionHandler.completeByDbId(sessionDbId);

    res.json({ status: 'deleted' });
  });

  /**
   * Complete a session (backward compatibility for cleanup-hook)
   * cleanup-hook expects POST /sessions/:sessionDbId/complete instead of DELETE
   */
  private handleSessionComplete = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const sessionDbId = this.parseIntParam(req, res, 'sessionDbId');
    if (sessionDbId === null) return;

    await this.completionHandler.completeByDbId(sessionDbId, Date.now());

    res.json({ success: true });
  });

  /**
   * Queue observations by contentSessionId (post-tool-use-hook uses this)
   * POST /api/sessions/observations
   * Body: { contentSessionId, tool_name, tool_input, tool_response, cwd }
   */
  private handleObservationsByClaudeId = this.wrapHandler((req: Request, res: Response): void => {
    const { contentSessionId, tool_name, tool_input, tool_response, cwd } = req.body;

    if (!contentSessionId) {
      return this.badRequest(res, 'Missing contentSessionId');
    }

    // Load skip tools from settings
    const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);
    const skipTools = new Set(settings.CLAUDE_MEM_SKIP_TOOLS.split(',').map(t => t.trim()).filter(Boolean));

    // Skip low-value or meta tools
    if (skipTools.has(tool_name)) {
      logger.debug('SESSION', 'Skipping observation for tool', { tool_name });
      res.json({ status: 'skipped', reason: 'tool_excluded' });
      return;
    }

    // Skip meta-observations: file operations on session-memory files
    const fileOperationTools = new Set(['Edit', 'Write', 'Read', 'NotebookEdit']);
    if (fileOperationTools.has(tool_name) && tool_input) {
      const filePath = tool_input.file_path || tool_input.notebook_path;
      if (filePath && filePath.includes('session-memory')) {
        logger.debug('SESSION', 'Skipping meta-observation for session-memory file', {
          tool_name,
          file_path: filePath
        });
        res.json({ status: 'skipped', reason: 'session_memory_meta' });
        return;
      }
    }

    try {
      const store = this.dbManager.getSessionStore();
      const metadata = this.getRequestSessionMetadata(req.body, {
        platform: req.body.platform === 'cursor' ? 'cursor' : 'claude',
        clientKind: req.body.platform === 'cursor' ? 'cursor' : 'claude-code',
        captureMode: 'hook',
        platformSessionId: contentSessionId
      });

      // Get or create session
      const sessionDbId = store.createSDKSession(contentSessionId, '', '', undefined, metadata);
      const promptNumber = store.getPromptNumberFromUserPrompts(contentSessionId);

      // Privacy check: skip if user prompt was entirely private
      const userPrompt = PrivacyCheckValidator.checkUserPromptPrivacy(
        store,
        contentSessionId,
        promptNumber,
        'observation',
        sessionDbId,
        { tool_name }
      );
      if (!userPrompt) {
        res.json({ status: 'skipped', reason: 'private' });
        return;
      }

      // Strip memory tags from tool_input and tool_response
      const cleanedToolInput = tool_input !== undefined
        ? stripMemoryTagsFromJson(JSON.stringify(tool_input))
        : '{}';

      const cleanedToolResponse = tool_response !== undefined
        ? stripMemoryTagsFromJson(JSON.stringify(tool_response))
        : '{}';

      // Queue observation
      const rawEventId = this.recordCompatibilityEvent(
        buildNormalizedEvent({
          ...metadata,
          eventType: 'tool.output',
          createdAtEpochMs: Date.now(),
          privacyState: 'normal',
          sourceConfidence: 'high',
          captureFidelity: 'high',
          toolName: tool_name,
          toolInput: this.sanitizeStructuredPayload(tool_input),
          toolOutput: this.sanitizeStructuredPayload(tool_response),
          summaryText: this.sanitizeText(typeof tool_response === 'string' ? tool_response : null),
          payload: req.body
        }),
        sessionDbId
      );

      this.sessionManager.queueObservation(sessionDbId, {
        tool_name,
        tool_input: cleanedToolInput,
        tool_response: cleanedToolResponse,
        prompt_number: promptNumber,
        raw_event_id: rawEventId,
        platform: metadata.platform,
        client_kind: metadata.clientKind,
        capture_mode: metadata.captureMode,
        platform_turn_id: metadata.platformTurnId || undefined,
        repo_root: metadata.repoRoot || undefined,
        repo_id: metadata.repoId || undefined,
        git_branch: metadata.gitBranch || undefined,
        git_commit: metadata.gitCommit || undefined,
        parent_session_id: metadata.parentSessionId || undefined,
        agent_role: metadata.agentRole || undefined,
        source_event_epoch: Date.now(),
        cwd: cwd || (() => {
          logger.error('SESSION', 'Missing cwd when queueing observation in SessionRoutes', {
            sessionId: sessionDbId,
            tool_name
          });
          return '';
        })()
      });

      // Ensure SDK agent is running
      this.ensureGeneratorRunning(sessionDbId, 'observation');

      // Broadcast observation queued event
      this.eventBroadcaster.broadcastObservationQueued(sessionDbId);

      res.json({ status: 'queued' });
    } catch (error) {
      // Return 200 on recoverable errors so the hook doesn't break
      logger.error('SESSION', 'Observation storage failed', { contentSessionId, tool_name }, error as Error);
      res.json({ stored: false, reason: (error as Error).message });
    }
  });

  /**
   * Queue summarize by contentSessionId (summary-hook uses this)
   * POST /api/sessions/summarize
   * Body: { contentSessionId, last_assistant_message }
   *
   * Checks privacy, queues summarize request for SDK agent
   */
  private handleSummarizeByClaudeId = this.wrapHandler((req: Request, res: Response): void => {
    const { contentSessionId, last_assistant_message } = req.body;

    if (!contentSessionId) {
      return this.badRequest(res, 'Missing contentSessionId');
    }

    const store = this.dbManager.getSessionStore();
    const metadata = this.getRequestSessionMetadata(req.body, {
      platform: 'claude',
      clientKind: 'claude-code',
      captureMode: 'hook',
      platformSessionId: contentSessionId
    });

    // Get or create session
    const sessionDbId = store.createSDKSession(contentSessionId, '', '', undefined, metadata);
    const promptNumber = store.getPromptNumberFromUserPrompts(contentSessionId);

    // Privacy check: skip if user prompt was entirely private
    const userPrompt = PrivacyCheckValidator.checkUserPromptPrivacy(
      store,
      contentSessionId,
      promptNumber,
      'summarize',
      sessionDbId
    );
    if (!userPrompt) {
      res.json({ status: 'skipped', reason: 'private' });
      return;
    }

    // Queue summarize
    const cleanedAssistantMessage = this.sanitizeText(last_assistant_message) || undefined;
    this.recordCompatibilityEvent(
      buildNormalizedEvent({
        ...metadata,
        eventType: 'turn.completed',
        createdAtEpochMs: Date.now(),
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'medium',
        assistantText: cleanedAssistantMessage || null,
        summaryText: cleanedAssistantMessage || null,
        payload: req.body
      }),
      sessionDbId
    );
    this.sessionManager.initializeSession(sessionDbId);
    this.sessionManager.queueSummarize(sessionDbId, cleanedAssistantMessage, Date.now());

    // Ensure SDK agent is running
    this.ensureGeneratorRunning(sessionDbId, 'summarize');

    // Broadcast summarize queued event
    this.eventBroadcaster.broadcastSummarizeQueued();

    res.json({ status: 'queued' });
  });

  /**
   * Complete session by contentSessionId (session-complete hook uses this)
   * POST /api/sessions/complete
   * Body: { contentSessionId }
   *
   * Removes session from active sessions map, allowing orphan reaper to
   * clean up any remaining subprocesses.
   *
   * Fixes Issue #842: Sessions stay in map forever, reaper thinks all active.
   */
  private handleCompleteByClaudeId = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const { contentSessionId } = req.body;

    logger.info('HTTP', '→ POST /api/sessions/complete', { contentSessionId });

    if (!contentSessionId) {
      return this.badRequest(res, 'Missing contentSessionId');
    }

    const store = this.dbManager.getSessionStore();
    const metadata = this.getRequestSessionMetadata(req.body, {
      platform: 'claude',
      clientKind: 'claude-code',
      captureMode: 'hook',
      platformSessionId: contentSessionId
    });

    // Look up sessionDbId from contentSessionId (createSDKSession is idempotent)
    // Pass empty strings - we only need the ID lookup, not to create a new session
    const sessionDbId = store.createSDKSession(contentSessionId, '', '', undefined, metadata);
    const completedAtEpoch = Date.now();
    const completeEventId = this.recordCompatibilityEvent(
      buildNormalizedEvent({
        ...metadata,
        eventType: 'session.completed',
        createdAtEpochMs: completedAtEpoch,
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'medium',
        summaryText: 'Session completed',
        payload: req.body
      }),
      sessionDbId
    );

    // Check if session is in the active sessions map
    const activeSession = this.sessionManager.getSession(sessionDbId);
    if (!activeSession) {
      store.markSessionCompleted(sessionDbId, completedAtEpoch);
      logger.debug('SESSION', 'session-complete: Session not in active map', {
        contentSessionId,
        sessionDbId,
        rawEventId: completeEventId
      });
      this.eventBroadcaster.broadcastSessionCompleted(sessionDbId);
      res.json({ status: 'completed', sessionDbId, active: false });
      return;
    }

    // Complete the session (removes from active sessions map)
    await this.completionHandler.completeByDbId(sessionDbId, completedAtEpoch);

    logger.info('SESSION', 'Session completed via API', {
      contentSessionId,
      sessionDbId
    });

    res.json({ status: 'completed', sessionDbId });
  });

  /**
   * Initialize session by contentSessionId (new-hook uses this)
   * POST /api/sessions/init
   * Body: { contentSessionId, project, prompt }
   *
   * Performs all session initialization DB operations:
   * - Creates/gets SDK session (idempotent)
   * - Increments prompt counter
   * - Saves user prompt (with privacy tag stripping)
   *
   * Returns: { sessionDbId, promptNumber, skipped: boolean, reason?: string }
   */
  private handleSessionInitByClaudeId = this.wrapHandler((req: Request, res: Response): void => {
    const { contentSessionId } = req.body;

    // Only contentSessionId is truly required — Cursor and other platforms
    // may omit prompt/project in their payload (#838, #1049)
    const project = req.body.project || 'unknown';
    const prompt = req.body.prompt || '[media prompt]';
    const customTitle = req.body.customTitle || undefined;

    logger.info('HTTP', 'SessionRoutes: handleSessionInitByClaudeId called', {
      contentSessionId,
      project,
      prompt_length: prompt?.length,
      customTitle
    });

    // Validate required parameters
    if (!this.validateRequired(req, res, ['contentSessionId'])) {
      return;
    }

    const store = this.dbManager.getSessionStore();
    const metadata = this.getRequestSessionMetadata(req.body, {
      platform: req.body.platform === 'cursor' ? 'cursor' : 'claude',
      clientKind: req.body.platform === 'cursor' ? 'cursor' : 'claude-code',
      captureMode: 'hook',
      platformSessionId: contentSessionId,
      project
    });

    // Step 1: Create/get SDK session (idempotent INSERT OR IGNORE)
    const sessionDbId = store.createSDKSession(contentSessionId, project, prompt, customTitle, metadata);

    // Verify session creation with DB lookup
    const dbSession = store.getSessionById(sessionDbId);
    const isNewSession = !dbSession?.memory_session_id;
    logger.info('SESSION', `CREATED | contentSessionId=${contentSessionId} → sessionDbId=${sessionDbId} | isNew=${isNewSession} | project=${project}`, {
      sessionId: sessionDbId
    });

    // Step 2: Get next prompt number from user_prompts count
    const currentCount = store.getPromptNumberFromUserPrompts(contentSessionId);
    const promptNumber = currentCount + 1;

    // Debug-level alignment logs for detailed tracing
    const memorySessionId = dbSession?.memory_session_id || null;
    if (promptNumber > 1) {
      logger.debug('HTTP', `[ALIGNMENT] DB Lookup Proof | contentSessionId=${contentSessionId} → memorySessionId=${memorySessionId || '(not yet captured)'} | prompt#=${promptNumber}`);
    } else {
      logger.debug('HTTP', `[ALIGNMENT] New Session | contentSessionId=${contentSessionId} | prompt#=${promptNumber} | memorySessionId will be captured on first SDK response`);
    }

    // Step 3: Strip privacy tags from prompt
    const cleanedPrompt = stripMemoryTagsFromPrompt(prompt);

    // Step 4: Check if prompt is entirely private
    if (!cleanedPrompt || cleanedPrompt.trim() === '') {
      logger.debug('HOOK', 'Session init - prompt entirely private', {
        sessionId: sessionDbId,
        promptNumber,
        originalLength: prompt.length
      });

      res.json({
        sessionDbId,
        promptNumber,
        skipped: true,
        reason: 'private'
      });
      return;
    }

    // Step 5: Save cleaned user prompt
    const rawEventId = this.recordCompatibilityEvent(
      buildNormalizedEvent({
        ...metadata,
        eventType: 'prompt.submitted',
        createdAtEpochMs: Date.now(),
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'high',
        promptText: cleanedPrompt,
        summaryText: cleanedPrompt,
        payload: req.body
      }),
      sessionDbId
    );
    store.saveUserPrompt(contentSessionId, promptNumber, cleanedPrompt, {
      ...metadata,
      rawEventId
    });

    // Step 6: Check if SDK agent is already running for this session (#1079)
    // If contextInjected is true, the hook should skip re-initializing the SDK agent
    const contextInjected = this.sessionManager.getSession(sessionDbId) !== undefined;
    if (contextInjected) {
      this.sessionManager.initializeSession(sessionDbId, cleanedPrompt, promptNumber);
      this.broadcastLatestPrompt(contentSessionId);
    }

    // Debug-level log since CREATED already logged the key info
    logger.debug('SESSION', 'User prompt saved', {
      sessionId: sessionDbId,
      promptNumber,
      contextInjected
    });

    res.json({
      sessionDbId,
      promptNumber,
      skipped: false,
      contextInjected
    });
  });

  private handleEventIngest = this.wrapHandler((req: Request, res: Response): void => {
    const event = req.body?.event ?? req.body;
    if (!event) {
      this.badRequest(res, 'Missing event payload');
      return;
    }

    const results = this.ingestNormalizedEvents([this.coerceNormalizedEvent(event)]);
    res.json({ ingested: results.length, events: results });
  });

  private handleEventBatch = this.wrapHandler((req: Request, res: Response): void => {
    const input = Array.isArray(req.body) ? req.body : req.body?.events;
    if (!Array.isArray(input) || input.length === 0) {
      this.badRequest(res, 'Missing events array');
      return;
    }

    const results = this.ingestNormalizedEvents(input.map((event: any) => this.coerceNormalizedEvent(event)));
    res.json({
      ingested: results.filter(result => result.inserted).length,
      total: results.length,
      events: results
    });
  });

  private handleGetEvents = this.wrapHandler((req: Request, res: Response): void => {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : undefined;
    const events = this.dbManager.getSessionStore().listRawEvents({
      platformSessionId: typeof req.query.platformSessionId === 'string' ? req.query.platformSessionId : undefined,
      platform: typeof req.query.platform === 'string' ? req.query.platform : undefined,
      eventType: typeof req.query.eventType === 'string' ? req.query.eventType : undefined,
      repoId: typeof req.query.repoId === 'string' ? req.query.repoId : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined
    });

    res.json({ events });
  });

  private handleReplay = this.wrapHandler((req: Request, res: Response): void => {
    const { platformSessionId } = req.params;
    if (!platformSessionId) {
      this.badRequest(res, 'Missing platformSessionId');
      return;
    }

    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 200;
    const safeLimit = Number.isFinite(limit) ? limit : 200;
    const store = this.dbManager.getSessionStore();
    const events = store.getRawEventReplay(platformSessionId, safeLimit).slice().reverse();
    const session = store.db.prepare(`
      SELECT *
      FROM sdk_sessions
      WHERE platform_session_id = ?
      ORDER BY started_at_epoch DESC
      LIMIT 1
    `).get(platformSessionId) as Record<string, any> | undefined;

    res.json({
      platformSessionId,
      session: session || null,
      events
    });
  });

  private handleSessionGraph = this.wrapHandler((req: Request, res: Response): void => {
    const { platformSessionId } = req.params;
    if (!platformSessionId) {
      this.badRequest(res, 'Missing platformSessionId');
      return;
    }

    const store = this.dbManager.getSessionStore();
    const baseSession = store.db.prepare(`
      SELECT *
      FROM sdk_sessions
      WHERE platform_session_id = ?
      ORDER BY started_at_epoch DESC
      LIMIT 1
    `).get(platformSessionId) as Record<string, any> | undefined;
    const baseEvent = store.db.prepare(`
      SELECT platform_session_id, parent_session_id
      FROM raw_events
      WHERE platform_session_id = ? OR parent_session_id = ?
      ORDER BY created_at_epoch ASC
      LIMIT 1
    `).get(platformSessionId, platformSessionId) as { platform_session_id: string; parent_session_id: string | null } | undefined;

    const rootPlatformSessionId =
      baseSession?.parent_session_id ||
      baseEvent?.parent_session_id ||
      platformSessionId;

    const sessions = store.db.prepare(`
      SELECT id, content_session_id, memory_session_id, project, status,
             platform, client_kind, capture_mode, platform_session_id, parent_session_id,
             agent_role, repo_root, repo_id, git_branch, git_commit,
             started_at, started_at_epoch, completed_at, completed_at_epoch
      FROM sdk_sessions
      WHERE platform_session_id = ?
         OR parent_session_id = ?
         OR platform_session_id = ?
      ORDER BY started_at_epoch ASC, id ASC
    `).all(rootPlatformSessionId, rootPlatformSessionId, platformSessionId) as Array<Record<string, any>>;

    const edges = sessions
      .filter(session => session.parent_session_id)
      .map(session => ({
        parentSessionId: session.parent_session_id,
        childSessionId: session.platform_session_id,
        agentRole: session.agent_role || null
      }));

    res.json({
      rootPlatformSessionId,
      sessions,
      edges
    });
  });
}
