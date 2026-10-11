# Codex-Mem — isolated security pilot (DRAFT)

This mode is deliberately **off by default** and is **not approved for Portenart business data**.

## Threat model and scope

The prior proof of concept could accept and store raw Codex events on localhost without an API credential. The experimental pilot hardening limits exposure, but does not replace a security architecture review. Local processes running under the same user may still read environment variables or local SQLite files, and heuristic patterns cannot detect every secret or piece of personal information.

The pilot is only for **one synthetic, non-confidential repository**. Worker V2, Supabase, SharePoint, the main Codex configuration, GitHub Cloud workspaces, actual email and real Portenart projects are out of scope.

## Opt-in environment contract (no credentials in files or commands)

All values below are supplied as **environment variables to the isolated worker and its CLI/MCP client processes**, not checked into Git:

- CLAUDE_MEM_PILOT_MODE=true: opt in to this restricted mode.
- CLAUDE_MEM_PILOT_TOKEN: randomly generated bearer secret, 32–512 printable ASCII characters; do not store it in Git, arguments, logs or settings.json.
- CLAUDE_MEM_PILOT_ALLOW_DIRS: a JSON array containing **exactly one** absolute, existing, canonical project directory. The normalized event's repository root must equal this directory. The project name must match the directory name.
- CLAUDE_MEM_DATA_DIR: a separate, existing data directory that is neither inside nor parent of the approved project. It MUST contain an explicit .synthetic-pilot-allow marker file; do not create this marker in an existing real memory database.
- CLAUDE_MEM_PILOT_CAPTURE_ENABLED=true: mandatory for writes. Omitting it disables capture.
- CLAUDE_MEM_PILOT_EXPIRES_AT: ISO 8601 UTC timestamp, no more than seven days in the future; after expiry the pilot rejects HTTP requests until a new explicit authorization window is configured.
- CLAUDE_MEM_CHROMA_ENABLED=false and no third-party AI provider for this experiment; pilot mode suppresses automatic observer/summarizer generator startup.
- Local worker binding is restricted to 127.0.0.1 or ::1.

Start scripts should generate a fresh secret in process memory, pass it to the dedicated child processes and remove it from the parent environment at shutdown. The pilot token is **not** a cloud credential and is not a substitute for per-user authorization.

## HTTP security behavior

- GET health/readiness/version only: public on loopback (no corpus data).
- GET search and bootstrap-memory only: bearer required and exact approved project query required.
- POST events/ingest, events/batch and memory/save only: bearer required; additional pre-write policies apply.
- All other HTTP endpoints, including the browser viewer, admin, imports, legacy writes, bulk data retrieval and project enumeration: 403.
- Requests with an Origin header or non-local Host are rejected.
- Pilot request body JSON is limited to 128 KB; normalized event at most 64 KB; batch at most 50 events.
- Token comparison is constant time for equal-length strings. No token or raw rejected payload is logged intentionally.

The client-side Codex event forwarder and MCP search wrapper inherit the secret from the isolated environment. An ordinary browser cannot use the secured local pilot UI.

The pilot MCP server exposes only __IMPORTANT, bootstrap_memory and search. Direct file readers (smart_search, smart_outline and smart_unfold), timeline and unrestricted observation retrieval are also blocked at call time. This closes a bypass where an authorized MCP process could otherwise read files outside the pilot project.

## Pre-write capture checks

1. Capture is explicitly enabled and no stop file is present.
2. The normalized event must come from Codex and have privacyState=normal.
3. Its cwd and repoRoot must resolve canonically within the **single allowed repository**. The root must match exactly. Missing or ambiguous paths fail closed.
4. Generic high-signal secret/PII patterns are checked against the full event and raw payload. Suspicious events are **rejected in their entirety before SQLite writes**; no false claim is made that all PII/secrets can be detected.
5. An entire batch is validated before any event within it is stored.

Manual memory writes additionally require the caller to supply the approved absolute cwd and matching project name. Unknown project names or secret-looking content are rejected.

## Stop, rollback and retention

- Create an empty file named pilot.stop in CLAUDE_MEM_DATA_DIR to stop writes **immediately** on the next request, without restarting the worker.
- Stop the isolated worker process by its owned PID. Do not call a production Worker or modify the main Codex config.
- Back up the **synthetic test database** and confirm a SQLite integrity check and matched table counts before testing restoration.
- The seven-day pilot **capture lease** is now enforced (requests fail closed on expiry), but this is not an automated retention/deletion mechanism. The earlier proposal of a 7-day raw-data retention limit is still a **policy proposal**, not yet an automated deletion mechanism. Do not claim it is implemented. Purge of any non-synthetic data requires a separate approved retention decision.
- No automatic cross-machine sync, GitHub upload of memory content or cloud service is added.

## Validation and gates

The security branch is stacked on top of the draft SQLite-corrections branch. Run local and Windows/Linux CI tests for credential rejection, allowlist bypass, suspected secrets, whole-batch rejection, immediate kill switch and compilation/packaging. Use a throwaway project and disposable database for live HTTP/Codex verification.

A successful isolated test **does not** authorize real Portenart capture. Before any real data: threat-model and access control review, DLP/PII minimization design, retention/erasure policy, approved model provider and costs, authorization gate and signed review. Keep the PR in DRAFT. Do not merge, install globally or publish npm without explicit approval.
