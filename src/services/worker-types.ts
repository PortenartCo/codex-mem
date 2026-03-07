/**
 * Shared types for Worker Service architecture
 */

import type { Response } from 'express';
import type {
  MemoryCaptureFidelity,
  MemoryCaptureMode,
  MemoryClientKind,
  MemoryPlatform
} from './platform/types.js';

// ============================================================================
// Active Session Types
// ============================================================================

/**
 * Provider-agnostic conversation message for shared history
 * Used to maintain context across Claude↔Gemini provider switches
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ActiveSession {
  sessionDbId: number;
  contentSessionId: string;      // User's Claude Code session being observed
  memorySessionId: string | null; // Memory agent's session ID for resume
  project: string;
  platform: MemoryPlatform;
  clientKind: MemoryClientKind;
  captureMode: MemoryCaptureMode;
  platformSessionId: string;
  parentSessionId?: string | null;
  agentRole?: string | null;
  repoRoot?: string | null;
  repoId?: string | null;
  gitBranch?: string | null;
  gitCommit?: string | null;
  userPrompt: string;
  pendingMessages: PendingMessage[];  // Deprecated: now using persistent store, kept for compatibility
  abortController: AbortController;
  generatorPromise: Promise<void> | null;
  lastPromptNumber: number;
  startTime: number;
  cumulativeInputTokens: number;   // Track input tokens for discovery cost
  cumulativeOutputTokens: number;  // Track output tokens for discovery cost
  earliestPendingTimestamp: number | null;  // Original timestamp of earliest pending message (for accurate observation timestamps)
  conversationHistory: ConversationMessage[];  // Shared conversation history for provider switching
  currentProvider: 'claude' | 'gemini' | 'openrouter' | null;  // Track which provider is currently running
  consecutiveRestarts: number;  // Track consecutive restart attempts to prevent infinite loops
  forceInit?: boolean;  // Force fresh SDK session (skip resume)
  idleTimedOut?: boolean;  // Set when session exits due to idle timeout (prevents restart loop)
  lastGeneratorActivity: number;  // Timestamp of last generator progress (for stale detection, Issue #1099)
  // CLAIM-CONFIRM FIX: Track IDs of messages currently being processed
  // These IDs will be confirmed (deleted) after successful storage
  processingMessageIds: number[];
}

export interface PendingMessage {
  type: 'observation' | 'summarize';
  tool_name?: string;
  tool_input?: any;
  tool_response?: any;
  prompt_number?: number;
  cwd?: string;
  last_assistant_message?: string;
  raw_event_id?: number;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  platform_turn_id?: string;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
  git_commit?: string | null;
  parent_session_id?: string | null;
  agent_role?: string | null;
  source_event_epoch?: number;
}

/**
 * PendingMessage with database ID for completion tracking.
 * The _persistentId is used to mark the message as processed after SDK success.
 * The _originalTimestamp is the source event epoch when available, otherwise the queue time.
 */
export interface PendingMessageWithId extends PendingMessage {
  _persistentId: number;
  _originalTimestamp: number;
}

export interface ObservationData {
  tool_name: string;
  tool_input: any;
  tool_response: any;
  prompt_number: number;
  cwd?: string;
  raw_event_id?: number;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  platform_turn_id?: string;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
  git_commit?: string | null;
  parent_session_id?: string | null;
  agent_role?: string | null;
  source_event_epoch?: number;
}

// ============================================================================
// SSE Types
// ============================================================================

export interface SSEEvent {
  type: string;
  timestamp?: number;
  [key: string]: any;
}

export type SSEClient = Response;

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  offset: number;
  limit: number;
}

export interface PaginationParams {
  offset: number;
  limit: number;
  project?: string;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface ViewerSettings {
  sidebarOpen: boolean;
  selectedProject: string | null;
  theme: 'light' | 'dark' | 'system';
}

// ============================================================================
// Database Record Types
// ============================================================================

export interface Observation {
  id: number;
  memory_session_id: string;  // Renamed from sdk_session_id
  project: string;
  type: string;
  title: string;
  subtitle: string | null;
  text: string | null;
  narrative: string | null;
  facts: string | null;
  concepts: string | null;
  files_read: string | null;
  files_modified: string | null;
  prompt_number: number;
  created_at: string;
  created_at_epoch: number;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  capture_fidelity?: MemoryCaptureFidelity;
  platform_session_id?: string | null;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
  parent_session_id?: string | null;
  agent_role?: string | null;
}

export interface Summary {
  id: number;
  session_id: string; // content_session_id (from JOIN)
  project: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  notes: string | null;
  created_at: string;
  created_at_epoch: number;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  capture_fidelity?: MemoryCaptureFidelity;
  platform_session_id?: string | null;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
  parent_session_id?: string | null;
  agent_role?: string | null;
}

export interface UserPrompt {
  id: number;
  content_session_id: string;  // Renamed from claude_session_id
  project: string; // From JOIN with sdk_sessions
  prompt_number: number;
  prompt_text: string;
  created_at: string;
  created_at_epoch: number;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  platform_turn_id?: string | null;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
  parent_session_id?: string | null;
  agent_role?: string | null;
}

export interface DBSession {
  id: number;
  content_session_id: string;    // Renamed from claude_session_id
  project: string;
  user_prompt: string;
  memory_session_id: string | null;  // Renamed from sdk_session_id
  platform: MemoryPlatform;
  client_kind: MemoryClientKind;
  capture_mode: MemoryCaptureMode;
  platform_session_id: string | null;
  parent_session_id: string | null;
  agent_role: string | null;
  repo_root: string | null;
  repo_id: string | null;
  git_branch: string | null;
  git_commit: string | null;
  status: 'active' | 'completed' | 'failed';
  started_at: string;
  started_at_epoch: number;
  completed_at: string | null;
  completed_at_epoch: number | null;
}

// ============================================================================
// SDK Types
// ============================================================================

// Re-export the actual SDK type to ensure compatibility
export type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

export interface ParsedObservation {
  type: string;
  title: string;
  subtitle: string | null;
  text: string;
  concepts: string[];
  files: string[];
}

export interface ParsedSummary {
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  notes: string | null;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface DatabaseStats {
  totalObservations: number;
  totalSessions: number;
  totalPrompts: number;
  totalSummaries: number;
  projectCounts: Record<string, {
    observations: number;
    sessions: number;
    prompts: number;
    summaries: number;
  }>;
}
