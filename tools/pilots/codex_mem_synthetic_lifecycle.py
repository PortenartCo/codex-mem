#!/usr/bin/env python3
"""Offline, copy-on-write retention rehearsal for synthetic Codex-Mem pilots.

This utility NEVER changes the source database, installs hooks, modifies user
configuration, accesses real Portenart data, or performs a production purge.

It requires dedicated synthetic-only markers, a single synthetic project,
and a stopped pilot (pilot.stop) before preparing any candidate database.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

RETENTION_DAYS = 7
MARKER = ".synthetic-pilot-allow"
PROJECT_MARKER = ".synthetic-fixture-only"
DB_NAME = "claude-mem.db"
CANDIDATE_DIR = "retention-candidates"
ACK = "SYNTHETIC_COPY_ONLY"
CONTENT_TABLES_NOT_SUPPORTED = (
    "observation_queue",
    "transcript_events",
    "memories",
    "overviews",
    "diagnostics",
    "streaming_sessions",
    "session_summaries",
)
REQUIRED = {
    "raw_events": {"id", "project", "created_at_epoch", "payload_json"},
    "sdk_sessions": {"id", "project", "started_at_epoch", "user_prompt"},
    "user_prompts": {"id", "content_session_id", "created_at_epoch", "prompt_text", "raw_event_id"},
    "observations": {"id", "project", "raw_event_id"},
    "pending_messages": {"id", "status", "created_at_epoch", "raw_event_id"},
}
SQL_PREVIEW = {
    "raw_events": "SELECT COUNT(*) FROM raw_events WHERE created_at_epoch < ?",
    "user_prompts": "SELECT COUNT(*) FROM user_prompts WHERE created_at_epoch < ?",
    "sdk_session_prompts": "SELECT COUNT(*) FROM sdk_sessions WHERE started_at_epoch < ? AND user_prompt IS NOT NULL",
    "processed_pending_messages": (
        "SELECT COUNT(*) FROM pending_messages "
        "WHERE created_at_epoch < ? AND status IN ('failed','completed')"
    ),
}


def fail(message: str) -> None:
    raise ValueError(message)


def is_inside(parent: Path, child: Path) -> bool:
    return child == parent or parent in child.parents


def canonical_existing(path: str, expected: str) -> Path:
    entry = Path(path)
    if not entry.is_absolute() or not entry.exists() or entry.is_symlink():
        fail(expected + " must be an existing, non-symlink absolute path")
    actual = entry.resolve(strict=True)
    if expected == "project" and not actual.is_dir():
        fail("Project must be a directory")
    if expected == "database" and not actual.is_file():
        fail("Source must be a regular file")
    return actual


def validate_scope(source_arg: str, project_arg: str) -> tuple[Path, Path, Path]:
    source = canonical_existing(source_arg, "database")
    project = canonical_existing(project_arg, "project")
    data_dir = source.parent
    if source.name != DB_NAME or data_dir.is_symlink():
        fail("Only a dedicated synthetic claude-mem.db is supported")
    wal = Path(str(source) + "-wal")
    # Non-empty WAL is a valid, durable SQLite state. Refusing it would exclude
    # real snapshots following an interrupted worker and tempt unsafe deletion.
    # SQLite's online backup API will include committed WAL transactions.
    if wal.is_symlink():
        fail("Source WAL must not be a symlink")
    if not project.name.lower().startswith(("synthetic-", "fixture-")):
        fail("Project name must explicitly identify a synthetic or fixture repository")
    if not (project / PROJECT_MARKER).is_file():
        fail("Synthetic project marker missing")
    if (project / PROJECT_MARKER).read_text(encoding="utf-8").strip() != "SYNTHETIC_ONLY":
        fail("Synthetic project marker invalid")
    if not (data_dir / MARKER).is_file():
        fail("Isolated synthetic database marker missing")
    if (data_dir / MARKER).read_text(encoding="utf-8").strip() != "SYNTHETIC_ONLY":
        fail("Isolated synthetic database marker invalid")
    if is_inside(project, data_dir) or is_inside(data_dir, project):
        fail("Synthetic project and data directories must not overlap")
    # Never run this maintenance tool on the ordinary ~/.claude-mem database.
    default_data_dir = (Path.home() / ".claude-mem").resolve()
    if data_dir == default_data_dir:
        fail("Refusing to inspect the user's default memory database")
    if os.path.commonpath([str(source), str(data_dir)]) != str(data_dir):
        fail("Source file escaped synthetic directory")
    return source, project, data_dir


def parse_as_of(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        fail("as-of requires an ISO 8601 timestamp")
    if stamp.tzinfo is None:
        fail("as-of timestamp must include a timezone")
    return stamp.astimezone(timezone.utc)


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def sqlite_state_digest(source: Path) -> str:
    """Hash BOTH the main DB and committed WAL: the main file may be stale."""
    sha = hashlib.sha256()
    for kind, target in (("db", source), ("wal", Path(str(source) + "-wal"))):
        sha.update(kind.encode("ascii") + b"\x00")
        if target.exists():
            if target.is_symlink():
                fail("SQLite source sidecar must not be a symlink")
            sha.update(bytes.fromhex(digest(target)))
        else:
            sha.update(b"ABSENT")
    return sha.hexdigest()


def open_source(source: Path) -> sqlite3.Connection:
    db = sqlite3.connect(source.as_uri() + "?mode=ro", uri=True, timeout=0)
    db.execute("PRAGMA query_only=ON")
    return db


def validate_schema(db: sqlite3.Connection, project: str) -> None:
    present = {
        row[0] for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }
    for table, required_columns in REQUIRED.items():
        if table not in present:
            fail("Unsupported database: missing " + table)
        columns = {
            row[1] for row in db.execute('PRAGMA table_info("' + table + '")')
        }
        if not required_columns.issubset(columns):
            fail("Unsupported database: incompatible schema for " + table)
    if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        fail("Source database integrity_check failed")
    if db.execute("PRAGMA foreign_key_check").fetchone() is not None:
        fail("Source database foreign_key_check failed")

    for table in ("raw_events", "sdk_sessions", "observations", "session_summaries"):
        if table not in present:
            continue
        projects = {row[0] for row in db.execute("SELECT DISTINCT project FROM " + table)}
        if projects and projects != {project}:
            fail("Cross-project or unknown data detected in " + table)

    for table in CONTENT_TABLES_NOT_SUPPORTED:
        if table in present and db.execute("SELECT COUNT(*) FROM " + table).fetchone()[0]:
            fail("Unsupported content in " + table + ": refuse partial retention")

    # Pending work may contain sensitive tool input/response; do not attempt
    # a partial cleanup until the queue has been independently reconciled.
    statuses = db.execute(
        "SELECT DISTINCT status FROM pending_messages"
    ).fetchall()
    if any(row[0] not in ("failed", "completed") for row in statuses):
        fail("Nonterminal pending messages prevent safe retention preparation")
    # Preserve references only to known sessions in the same synthetic project.
    dangling = db.execute(
        "SELECT count(*) FROM user_prompts AS u "
        "LEFT JOIN sdk_sessions AS s ON s.content_session_id=u.content_session_id "
        "WHERE s.id IS NULL"
    ).fetchone()[0]
    if dangling:
        fail("Orphan user prompts detected")


def counts(db: sqlite3.Connection, cutoff_ms: int) -> dict[str, int]:
    return {name: int(db.execute(sql, (cutoff_ms,)).fetchone()[0])
            for name, sql in SQL_PREVIEW.items()}


def preview(source: Path, project: Path, stamp: datetime) -> dict[str, object]:
    cutoff = stamp - timedelta(days=RETENTION_DAYS)
    cutoff_ms = int(cutoff.timestamp() * 1000)
    before_state = sqlite_state_digest(source)
    with closing(open_source(source)) as db:
        validate_schema(db, project.name)
        table_counts = {
            table: db.execute("SELECT COUNT(*) FROM " + table).fetchone()[0]
            for table in REQUIRED
        }
        selected = counts(db, cutoff_ms)
    after_state = sqlite_state_digest(source)
    if before_state != after_state:
        fail("Source SQLite or WAL changed during preview; retry only once idle")
    return {
        "mode": "preview",
        "policy": "synthetic-only-copy-on-write",
        "retention_days": RETENTION_DAYS,
        "as_of_utc": stamp.isoformat(),
        "cutoff_utc": cutoff.isoformat(),
        "source_sha256": digest(source),
        "source_state_sha256": after_state,
        "source_wal_present": Path(str(source) + "-wal").exists(),
        "project": project.name,
        "total_rows": table_counts,
        "candidate_rows": selected,
        "note": "No file or row has been changed. Session and observation history is retained.",
    }


def prepare_copy(
    source: Path, project: Path, data_dir: Path,
    as_of: datetime, acknowledged: str, output_name: str,
) -> dict[str, object]:
    if acknowledged != ACK:
        fail("Preparing a candidate requires exact SYNTHETIC_COPY_ONLY approval")
    if not (data_dir / "pilot.stop").is_file():
        fail("Stop capture using pilot.stop before preparing a retention candidate")
    if not output_name.endswith(".sqlite") or Path(output_name).name != output_name:
        fail("Output must be a plain .sqlite filename in the synthetic candidates folder")
    if output_name.startswith(".") or len(output_name) > 100:
        fail("Invalid candidate filename")
    candidates = data_dir / CANDIDATE_DIR
    if candidates.exists() and (not candidates.is_dir() or candidates.is_symlink()):
        fail("Candidate destination is unsafe")
    dest = candidates / output_name
    if dest.exists() or dest.is_symlink():
        fail("Candidate destination already exists; never overwrite an existing file")

    baseline = preview(source, project, as_of)
    cutoff_ms = int((as_of - timedelta(days=RETENTION_DAYS)).timestamp() * 1000)
    candidates.mkdir(mode=0o700, exist_ok=True)
    output_created = False
    try:
        # Exclusive creation; refuse an overwrite even if a concurrent file appears.
        fd = os.open(dest, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
        output_created = True
        with closing(open_source(source)) as src, closing(sqlite3.connect(dest, timeout=0)) as dst:
            src.backup(dst)
            if sqlite_state_digest(source) != baseline["source_state_sha256"]:
                fail("Source SQLite/WAL changed during backup; aborting staged candidate")
            validate_schema(dst, project.name)
            dst.execute("PRAGMA foreign_keys=ON")
            dst.execute("PRAGMA secure_delete=ON")
            dst.execute("BEGIN IMMEDIATE")
            try:
                # Break references to raw events scheduled for deletion.
                for table in ("user_prompts", "observations", "session_summaries", "pending_messages"):
                    has_table = dst.execute(
                        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                        (table,),
                    ).fetchone()
                    if has_table:
                        dst.execute(
                            "UPDATE " + table + " SET raw_event_id=NULL "
                            "WHERE raw_event_id IN "
                            "(SELECT id FROM raw_events WHERE created_at_epoch < ?)",
                            (cutoff_ms,),
                        )
                dst.execute("DELETE FROM raw_events WHERE created_at_epoch < ?", (cutoff_ms,))
                dst.execute("DELETE FROM user_prompts WHERE created_at_epoch < ?", (cutoff_ms,))
                dst.execute(
                    "UPDATE sdk_sessions SET user_prompt=NULL "
                    "WHERE started_at_epoch < ? AND user_prompt IS NOT NULL",
                    (cutoff_ms,),
                )
                dst.execute(
                    "DELETE FROM pending_messages "
                    "WHERE created_at_epoch < ? AND status IN ('failed','completed')",
                    (cutoff_ms,),
                )
                dst.commit()
            except Exception:
                dst.rollback()
                raise
            dst.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            dst.execute("VACUUM")
            dst.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            if dst.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                fail("Candidate integrity_check failed")
            if dst.execute("PRAGMA foreign_key_check").fetchone() is not None:
                fail("Candidate foreign_key_check failed")
            if any(counts(dst, cutoff_ms).values()):
                fail("Candidate still contains expired raw data")
            after_totals = {
                table: dst.execute("SELECT COUNT(*) FROM " + table).fetchone()[0]
                for table in REQUIRED
            }
        if sqlite_state_digest(source) != baseline["source_state_sha256"]:
            fail("Source SQLite/WAL changed during candidate generation; aborting")
        return {
            "mode": "prepared_copy_only",
            "candidate": str(dest),
            "candidate_sha256": digest(dest),
            "source_sha256": baseline["source_sha256"],
            "source_state_sha256": baseline["source_state_sha256"],
            "source_unchanged": True,
            "eligible_rows_before": baseline["candidate_rows"],
            "rows_after": after_totals,
            "integrity_check": "ok",
            "promotion": "not_performed; requires explicit human review",
            "note": "No source row or live database was changed; plaintext candidate is synthetic-only.",
        }
    except Exception:
        if output_created:
            try:
                dest.unlink(missing_ok=True)
            except OSError:
                pass
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--project-dir", required=True)
    parser.add_argument("--as-of", default=None)
    parser.add_argument("--retention-days", type=int, default=RETENTION_DAYS)
    parser.add_argument("--mode", choices=("preview", "prepare"), default="preview")
    parser.add_argument("--output-name", default=None)
    parser.add_argument("--ack", default="")
    args = parser.parse_args(argv)
    try:
        if args.retention_days != RETENTION_DAYS:
            fail("This synthetic pilot only supports the provisional seven-day raw retention policy")
        source, project, data_dir = validate_scope(args.source, args.project_dir)
        as_of = parse_as_of(args.as_of)
        if args.mode == "preview":
            if args.output_name or args.ack:
                fail("Preview cannot contain candidate output or approval arguments")
            result = preview(source, project, as_of)
        else:
            if not args.output_name:
                fail("Preparing a candidate requires --output-name")
            result = prepare_copy(
                source, project, data_dir, as_of, args.ack, args.output_name
            )
        print(json.dumps(result, sort_keys=True, indent=2))
        return 0
    except (ValueError, OSError, sqlite3.Error) as error:
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
