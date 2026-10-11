"""Executable synthetic-only contract tests for copy-on-write retention."""
import importlib.util
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "tools" / "pilots" / "codex_mem_synthetic_lifecycle.py"
SPEC = importlib.util.spec_from_file_location("synthetic_lifecycle", SCRIPT)
assert SPEC and SPEC.loader
lifecycle = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(lifecycle)
AS_OF = datetime(2026, 10, 12, 12, tzinfo=timezone.utc)
OLD = int((AS_OF - timedelta(days=9)).timestamp() * 1000)
NEW = int((AS_OF - timedelta(days=1)).timestamp() * 1000)
EXPIRED = "SYNTHETIC_EXPIRED_TRANSCRIPT_SHOULD_GO"
RECENT = "SYNTHETIC_RECENT_TRANSCRIPT_KEEP"
OBSERVATION = "SYNTHETIC_TECHNICAL_MEMORY_KEEP"


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="codex-mem-synthetic-retention-")
        self.addCleanup(self.tmp.cleanup)
        self.parent = Path(self.tmp.name)
        self.project = self.parent / "synthetic-test"
        self.project.mkdir()
        (self.project / lifecycle.PROJECT_MARKER).write_text("SYNTHETIC_ONLY", encoding="utf-8")
        self.data = self.parent / "private-pilot"
        self.data.mkdir()
        (self.data / lifecycle.MARKER).write_text("SYNTHETIC_ONLY", encoding="utf-8")
        self.source = self.data / lifecycle.DB_NAME
        self.make_db()

    def make_db(self):
        with closing(sqlite3.connect(self.source)) as db:
            db.executescript("""
                PRAGMA foreign_keys=ON;
                CREATE TABLE sdk_sessions(
                    id INTEGER PRIMARY KEY, project TEXT NOT NULL,
                    content_session_id TEXT UNIQUE NOT NULL,
                    memory_session_id TEXT UNIQUE,
                    user_prompt TEXT, started_at_epoch INTEGER NOT NULL
                );
                CREATE TABLE raw_events(
                    id INTEGER PRIMARY KEY, project TEXT NOT NULL,
                    session_db_id INTEGER,
                    created_at_epoch INTEGER NOT NULL,
                    payload_json TEXT,
                    FOREIGN KEY(session_db_id) REFERENCES sdk_sessions(id) ON DELETE SET NULL
                );
                CREATE TABLE user_prompts(
                    id INTEGER PRIMARY KEY,
                    content_session_id TEXT NOT NULL,
                    created_at_epoch INTEGER NOT NULL,
                    prompt_text TEXT, raw_event_id INTEGER,
                    FOREIGN KEY(content_session_id) REFERENCES sdk_sessions(content_session_id) ON DELETE CASCADE
                );
                CREATE TABLE observations(
                    id INTEGER PRIMARY KEY, project TEXT NOT NULL,
                    memory_session_id TEXT NOT NULL, text TEXT, raw_event_id INTEGER,
                    FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
                );
                CREATE TABLE pending_messages(
                    id INTEGER PRIMARY KEY, session_db_id INTEGER,
                    status TEXT NOT NULL, created_at_epoch INTEGER NOT NULL,
                    raw_event_id INTEGER,
                    FOREIGN KEY(session_db_id) REFERENCES sdk_sessions(id) ON DELETE CASCADE
                );
                CREATE TABLE session_summaries(
                    id INTEGER PRIMARY KEY, project TEXT, raw_event_id INTEGER
                );
                CREATE VIRTUAL TABLE user_prompts_fts USING fts5(prompt_text);
                CREATE TRIGGER user_prompts_insert AFTER INSERT ON user_prompts BEGIN
                    INSERT INTO user_prompts_fts(rowid,prompt_text)
                    VALUES(new.id,new.prompt_text);
                END;
                CREATE TRIGGER user_prompts_delete AFTER DELETE ON user_prompts BEGIN
                    DELETE FROM user_prompts_fts WHERE rowid=old.id;
                END;
            """)
            db.execute(
                "INSERT INTO sdk_sessions VALUES(1,?,?,?, ?,?)",
                (self.project.name, "thread-old", "mem-old", EXPIRED, OLD),
            )
            db.execute(
                "INSERT INTO sdk_sessions VALUES(2,?,?,?, ?,?)",
                (self.project.name, "thread-new", "mem-new", RECENT, NEW),
            )
            db.execute(
                "INSERT INTO raw_events VALUES(1,?,?,?,?)",
                (self.project.name, 1, OLD, EXPIRED),
            )
            db.execute(
                "INSERT INTO raw_events VALUES(2,?,?,?,?)",
                (self.project.name, 2, NEW, RECENT),
            )
            db.execute(
                "INSERT INTO user_prompts VALUES(1,?,?,?,?)",
                ("thread-old", OLD, EXPIRED, 1),
            )
            db.execute(
                "INSERT INTO user_prompts VALUES(2,?,?,?,?)",
                ("thread-new", NEW, RECENT, 2),
            )
            db.execute(
                "INSERT INTO observations VALUES(1,?,?,?,?)",
                (self.project.name, "mem-old", OBSERVATION, 1),
            )
            db.execute(
                "INSERT INTO pending_messages VALUES(1,?,?,?,?)",
                (1, "completed", OLD, 1),
            )
            db.commit()

    def call_cli(self, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPT),
             "--source", str(self.source), "--project-dir", str(self.project),
             "--as-of", AS_OF.isoformat(), *args],
            capture_output=True, text=True, check=False
        )

    def preview(self):
        return lifecycle.preview(self.source, self.project, AS_OF)

    def test_preview_is_read_only_and_counts_sensitive_references(self):
        original_hash = lifecycle.digest(self.source)
        result = self.call_cli()
        self.assertEqual(result.returncode, 0, result.stderr)
        preview = json.loads(result.stdout)
        self.assertEqual(preview["candidate_rows"], {
            "raw_events": 1, "user_prompts": 1,
            "sdk_session_prompts": 1, "processed_pending_messages": 1,
        })
        self.assertEqual(lifecycle.digest(self.source), original_hash)
        self.assertFalse((self.data / lifecycle.CANDIDATE_DIR).exists())

    def test_copy_retains_manual_memories_and_does_not_modify_source(self):
        (self.data / "pilot.stop").touch()
        before = lifecycle.digest(self.source)
        result = self.call_cli(
            "--mode", "prepare", "--ack", lifecycle.ACK,
            "--output-name", "candidate.sqlite"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertTrue(report["source_unchanged"])
        self.assertEqual(lifecycle.digest(self.source), before)
        candidate = self.data / lifecycle.CANDIDATE_DIR / "candidate.sqlite"
        self.assertTrue(candidate.exists())
        with closing(sqlite3.connect(candidate)) as db:
            self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(db.execute("SELECT count(*) FROM raw_events").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT count(*) FROM user_prompts").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT user_prompt FROM sdk_sessions WHERE id=1").fetchone()[0], None)
            self.assertEqual(db.execute("SELECT count(*) FROM pending_messages").fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT raw_event_id FROM observations WHERE id=1").fetchone()[0], None)
            self.assertEqual(db.execute("SELECT text FROM observations WHERE id=1").fetchone()[0], OBSERVATION)
            self.assertEqual(db.execute("SELECT count(*) FROM user_prompts_fts").fetchone()[0], 1)
        # VACUUM + secure_delete should leave no test marker in staged SQLite.
        self.assertNotIn(EXPIRED.encode(), candidate.read_bytes())
        with closing(sqlite3.connect(self.source)) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM raw_events").fetchone()[0], 2)
            self.assertEqual(db.execute("SELECT count(*) FROM user_prompts").fetchone()[0], 2)

    def test_prevent_implicit_destructive_execution_or_overwrite(self):
        result = self.call_cli("--mode", "prepare", "--output-name", "candidate.sqlite")
        self.assertEqual(result.returncode, 2)
        self.assertIn("requires exact", result.stderr)
        self.assertFalse((self.data / lifecycle.CANDIDATE_DIR).exists())
        (self.data / "pilot.stop").touch()
        result = self.call_cli("--mode", "prepare", "--ack", lifecycle.ACK,
                               "--output-name", "candidate.sqlite")
        self.assertEqual(result.returncode, 0, result.stderr)
        candidate = self.data / lifecycle.CANDIDATE_DIR / "candidate.sqlite"
        original = lifecycle.digest(candidate)
        second = self.call_cli("--mode", "prepare", "--ack", lifecycle.ACK,
                               "--output-name", "candidate.sqlite")
        self.assertEqual(second.returncode, 2)
        self.assertIn("already exists", second.stderr)
        self.assertEqual(lifecycle.digest(candidate), original)

    def test_capture_stop_required(self):
        r = self.call_cli("--mode", "prepare", "--ack", lifecycle.ACK,
                          "--output-name", "candidate.sqlite")
        self.assertEqual(r.returncode, 2)
        self.assertIn("pilot.stop", r.stderr)

    def test_missing_markers_fail_closed(self):
        (self.data / lifecycle.MARKER).unlink()
        result = self.call_cli()
        self.assertEqual(result.returncode, 2)
        self.assertIn("marker missing", result.stderr)
        (self.data / lifecycle.MARKER).write_text("SYNTHETIC_ONLY", encoding="utf-8")
        (self.project / lifecycle.PROJECT_MARKER).unlink()
        result = self.call_cli()
        self.assertEqual(result.returncode, 2)
        self.assertIn("project marker missing", result.stderr)

    def test_refuses_other_project_and_unhandled_content(self):
        with closing(sqlite3.connect(self.source)) as db:
            db.execute("UPDATE raw_events SET project='another-project' WHERE id=1")
            db.commit()
        result = self.call_cli()
        self.assertEqual(result.returncode, 2)
        self.assertIn("Cross-project", result.stderr)
        with closing(sqlite3.connect(self.source)) as db:
            db.execute("UPDATE raw_events SET project=? WHERE id=1", (self.project.name,))
            db.execute("CREATE TABLE IF NOT EXISTS diagnostics (id INTEGER PRIMARY KEY, message TEXT)")
            db.execute("INSERT INTO diagnostics(message) VALUES(?)", ("potentially private",))
            db.commit()
        result = self.call_cli()
        self.assertEqual(result.returncode, 2)
        self.assertIn("Unsupported content", result.stderr)

    def test_refuses_active_pending_messages(self):
        with closing(sqlite3.connect(self.source)) as db:
            db.execute("UPDATE pending_messages SET status='pending' WHERE id=1")
            db.commit()
        result = self.call_cli()
        self.assertEqual(result.returncode, 2)
        self.assertIn("Nonterminal", result.stderr)

    def test_wal_commits_are_included_without_mutating_database_or_wal(self):
        live = sqlite3.connect(self.source)
        try:
            live.execute("PRAGMA journal_mode=WAL")
            live.execute("PRAGMA wal_autocheckpoint=0")
            live.execute(
                "INSERT INTO raw_events VALUES(3,?,?,?,?)",
                (self.project.name, 2, NEW, "SYNTHETIC_DURABLE_WAL_MARKER"),
            )
            live.commit()
            wal = Path(str(self.source) + "-wal")
            self.assertTrue(wal.exists())
            self.assertGreater(wal.stat().st_size, 0)
            state_before = lifecycle.sqlite_state_digest(self.source)
            preview = self.call_cli("--mode", "preview")
            self.assertEqual(preview.returncode, 0, preview.stderr)
            self.assertTrue(json.loads(preview.stdout)["source_wal_present"])
            self.assertEqual(json.loads(preview.stdout)["total_rows"]["raw_events"], 3)
            (self.data / "pilot.stop").touch()
            prepared = self.call_cli(
                "--mode", "prepare", "--ack", lifecycle.ACK,
                "--output-name", "wal-safe.sqlite"
            )
            self.assertEqual(prepared.returncode, 0, prepared.stderr)
            self.assertEqual(lifecycle.sqlite_state_digest(self.source), state_before)
            output = self.data / lifecycle.CANDIDATE_DIR / "wal-safe.sqlite"
            with closing(sqlite3.connect(output)) as db:
                rows = [x[0] for x in db.execute("SELECT payload_json FROM raw_events ORDER BY id")]
                self.assertIn("SYNTHETIC_DURABLE_WAL_MARKER", rows)
                self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
        finally:
            live.close()

    def test_refuses_unsafe_output_paths(self):
        (self.data / "pilot.stop").touch()
        for output in ("../escape.sqlite", "test.db", "other/child.sqlite"):
            result = self.call_cli("--mode", "prepare", "--ack", lifecycle.ACK,
                                   "--output-name", output)
            self.assertEqual(result.returncode, 2, output)
        self.assertFalse((self.parent / "escape.sqlite").exists())

    def test_full_copy_encrypt_restore_has_valid_sqlite_and_unchanged_source(self):
        (self.data / "pilot.stop").touch()
        pristine = lifecycle.digest(self.source)
        staged = self.call_cli(
            "--mode", "prepare", "--ack", lifecycle.ACK,
            "--output-name", "candidate.sqlite"
        )
        self.assertEqual(staged.returncode, 0, staged.stderr)
        crypto = SCRIPT.with_name("codex_mem_synthetic_crypto.mjs")
        key = os.urandom(32).hex()
        environment = {**os.environ, "CODEX_MEM_PILOT_KEY_HEX": key}

        def crypt(mode, source_name, output_name):
            return subprocess.run(
                ["node", str(crypto),
                 "--mode", mode,
                 "--data-dir", str(self.data),
                 "--project-dir", str(self.project),
                 "--input-name", source_name,
                 "--output-name", output_name,
                 "--ack", "SYNTHETIC_ENCRYPTION_TEST_ONLY"],
                env=environment, capture_output=True, text=True, check=False
            )

        encrypted = crypt("encrypt", "candidate.sqlite", "snapshot.cmem")
        self.assertEqual(encrypted.returncode, 0, encrypted.stderr)
        encrypted_bytes = (self.data / "encrypted-backups" / "snapshot.cmem").read_bytes()
        self.assertNotIn(OBSERVATION.encode(), encrypted_bytes)
        self.assertNotIn(RECENT.encode(), encrypted_bytes)
        restored = crypt("restore", "snapshot.cmem", "restored.sqlite")
        self.assertEqual(restored.returncode, 0, restored.stderr)
        restored_file = self.data / "restore-tests" / "restored.sqlite"
        with closing(sqlite3.connect(restored_file)) as db:
            self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(db.execute("SELECT count(*) FROM raw_events").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT text FROM observations").fetchone()[0], OBSERVATION)
        self.assertEqual(lifecycle.digest(self.source), pristine)

    def test_wrong_retention_days_and_invalid_time(self):
        self.assertEqual(self.call_cli("--retention-days", "365").returncode, 2)
        self.assertEqual(self.call_cli("--as-of", "2026-10-12").returncode, 2)


if __name__ == "__main__":
    unittest.main()
