/**
 * TypeScript types for database query results
 * Provides type safety for bun:sqlite query results
 */
import type {
  MemoryCaptureFidelity,
  MemoryCaptureMode,
  MemoryClientKind,
  MemoryPlatform,
  MemoryPrivacyState,
  MemorySourceConfidence
} from '../services/platform/types.js';

/**
 * Schema information from sqlite3 PRAGMA table_info
 */
export interface TableColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Index information from sqlite3 PRAGMA index_list
 */
export interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

/**
 * Table name from sqlite_master
 */
export interface TableNameRow {
  name: string;
}

/**
 * Schema version record
 */
export interface SchemaVersion {
  version: number;
}

/**
 * SDK Session database record
 */
export interface SdkSessionRecord {
  id: number;
  content_session_id: string;
  memory_session_id: string | null;
  project: string;
  user_prompt: string | null;
  started_at: string;
  started_at_epoch: number;
  completed_at: string | null;
  completed_at_epoch: number | null;
  status: 'active' | 'completed' | 'failed';
  worker_port?: number;
  prompt_counter?: number;
  custom_title?: string | null;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  platform_session_id?: string | null;
  parent_session_id?: string | null;
  agent_role?: string | null;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
  git_commit?: string | null;
}

/**
 * Observation database record
 */
export interface ObservationRecord {
  id: number;
  memory_session_id: string;
  project: string;
  text: string | null;
  type: 'decision' | 'bugfix' | 'feature' | 'refactor' | 'discovery' | 'change';
  created_at: string;
  created_at_epoch: number;
  title?: string;
  concept?: string;
  source_files?: string;
  prompt_number?: number;
  discovery_tokens?: number;
  uuid?: string | null;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  capture_fidelity?: MemoryCaptureFidelity;
  raw_event_id?: number | null;
  platform_session_id?: string | null;
  platform_turn_id?: string | null;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
  git_commit?: string | null;
  parent_session_id?: string | null;
  agent_role?: string | null;
  superseded_by?: number | null;
  staleness_score?: number;
}

/**
 * Session Summary database record
 */
export interface SessionSummaryRecord {
  id: number;
  memory_session_id: string;
  project: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  created_at: string;
  created_at_epoch: number;
  prompt_number?: number;
  discovery_tokens?: number;
  uuid?: string | null;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  capture_fidelity?: MemoryCaptureFidelity;
  raw_event_id?: number | null;
  platform_session_id?: string | null;
  platform_turn_id?: string | null;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
  git_commit?: string | null;
  parent_session_id?: string | null;
  agent_role?: string | null;
  superseded_by?: number | null;
  staleness_score?: number;
}

/**
 * User Prompt database record
 */
export interface UserPromptRecord {
  id: number;
  content_session_id: string;
  prompt_number: number;
  prompt_text: string;
  project?: string;  // From JOIN with sdk_sessions
  created_at: string;
  created_at_epoch: number;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  platform_turn_id?: string | null;
  raw_event_id?: number | null;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
  git_commit?: string | null;
  parent_session_id?: string | null;
  agent_role?: string | null;
}

/**
 * Latest user prompt with session join
 */
export interface LatestPromptResult {
  id: number;
  content_session_id: string;
  memory_session_id: string;
  project: string;
  prompt_number: number;
  prompt_text: string;
  created_at_epoch: number;
}

/**
 * Observation with context (for time-based queries)
 */
export interface ObservationWithContext {
  id: number;
  memory_session_id: string;
  project: string;
  text: string | null;
  type: string;
  created_at: string;
  created_at_epoch: number;
  title?: string;
  concept?: string;
  source_files?: string;
  prompt_number?: number;
  discovery_tokens?: number;
  platform?: MemoryPlatform;
  client_kind?: MemoryClientKind;
  capture_mode?: MemoryCaptureMode;
  repo_root?: string | null;
  repo_id?: string | null;
  git_branch?: string | null;
}

export interface RawEventRecord {
  id: number;
  event_uuid: string;
  platform: MemoryPlatform;
  client_kind: MemoryClientKind;
  capture_mode: MemoryCaptureMode;
  platform_session_id: string;
  platform_turn_id: string | null;
  item_id: string | null;
  parent_session_id: string | null;
  agent_role: string | null;
  event_type: string;
  cwd: string | null;
  project: string | null;
  repo_root: string | null;
  repo_id: string | null;
  git_branch: string | null;
  git_commit: string | null;
  payload_json: string;
  payload_hash: string;
  privacy_state: MemoryPrivacyState;
  source_confidence: MemorySourceConfidence;
  created_at: string;
  created_at_epoch: number;
  session_db_id: number | null;
}
