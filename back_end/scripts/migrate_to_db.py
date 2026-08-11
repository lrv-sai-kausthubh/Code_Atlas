"""One-shot migration: copy the existing data_base/ JSON layout into PostgreSQL.

Usage (from back_end/):

    DATABASE_URL="postgresql://user:pass@host/db" python -m scripts.migrate_to_db

Safe to re-run: collections are overwritten, audit rows are appended
(duplicates on re-run are acceptable for a one-shot tool).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import store  # noqa: E402


def main() -> None:
    if not store.DB_ENABLED:
        print("DATABASE_URL is not set; nothing to migrate.")
        return 1

    base = Path(__file__).resolve().parents[1] / "data_base"
    print(f"Migrating {base} -> database...")
    counts = store.migrate_from_files(base)
    for name, count in sorted(counts.items()):
        print(f"  {name}: {count}")
    print("Done. Set DATABASE_URL on the backend and restart to use the DB.")


if __name__ == "__main__":
    sys.exit(main())
