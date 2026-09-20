"""One-off migration verification (safe to delete)."""
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

backend = Path(__file__).resolve().parent / "backend"
db = Path(tempfile.mkdtemp(prefix="mig-check-")) / "check.db"

env = dict(os.environ)
env["DATABASE_URL"] = f"sqlite:///{db.as_posix()}"

for step in ("upgrade", "downgrade", "upgrade"):
    result = subprocess.run(
        [sys.executable, "-m", "alembic", step, "head"],
        cwd=backend, env=env, capture_output=True, text=True,
    )
    print(f"{step}: exit={result.returncode}")
    if result.returncode != 0:
        print(result.stdout[-1500:])
        print(result.stderr[-1500:])
        sys.exit(1)

conn = sqlite3.connect(db)
tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
conn.close()
for table in ("department_requests", "department_records", "complaint_tokens", "role_signing_keys"):
    print(f"{'PASS' if table in tables else 'FAIL'}  {table}")
print("MIGRATIONS OK" if all(t in tables for t in ("department_requests", "department_records", "complaint_tokens")) else "MIGRATION FAILURES")
