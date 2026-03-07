export type MemoryPlatform =
  | 'claude'
  | 'cursor'
  | 'codex'
  | 'openclaw'
  | 'transcript'
  | 'manual'
  | 'unknown';

export type MemoryClientKind =
  | 'claude-code'
  | 'cursor'
  | 'codex-cli'
  | 'codex-exec'
  | 'codex-app-server'
  | 'openclaw'
  | 'transcript'
  | 'manual'
  | 'unknown';

export type MemoryCaptureMode =
  | 'hook'
  | 'notify'
  | 'exec-json'
  | 'app-server'
  | 'replay'
  | 'manual';

export type MemoryPrivacyState = 'normal' | 'private_stripped' | 'skipped';
export type MemorySourceConfidence = 'high' | 'medium' | 'low';
export type MemoryCaptureFidelity = 'high' | 'medium' | 'low';

export interface SessionMetadata {
  platform: MemoryPlatform;
  clientKind: MemoryClientKind;
  captureMode: MemoryCaptureMode;
  platformSessionId: string;
  platformTurnId?: string | null;
  itemId?: string | null;
  parentSessionId?: string | null;
  agentRole?: string | null;
  cwd?: string | null;
  project?: string | null;
  repoRoot?: string | null;
  repoId?: string | null;
  gitBranch?: string | null;
  gitCommit?: string | null;
}

export interface ProjectionMetadata extends SessionMetadata {
  rawEventId?: number | null;
  captureFidelity?: MemoryCaptureFidelity;
  supersededBy?: number | null;
  stalenessScore?: number;
}

export interface NormalizedEvent extends SessionMetadata {
  id: string;
  eventType: string;
  payloadJson: string;
  payloadHash: string;
  createdAtEpochMs: number;
  privacyState: MemoryPrivacyState;
  sourceConfidence: MemorySourceConfidence;
  captureFidelity: MemoryCaptureFidelity;
  promptText?: string | null;
  assistantText?: string | null;
  summaryText?: string | null;
  toolName?: string | null;
  toolInput?: unknown;
  toolOutput?: unknown;
}

export interface RawEventFilters {
  platformSessionId?: string;
  platform?: MemoryPlatform;
  eventType?: string;
  repoId?: string;
  limit?: number;
  offset?: number;
}

