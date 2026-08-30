#!/usr/bin/env python3
"""Decide whether a DB URL may be written to Vercel Production or Preview.

Prints only project_ref / host_tail / database_name. Never prints passwords
or full connection strings.
"""

from __future__ import annotations

import argparse
import json
import sys
from urllib.parse import unquote, urlparse

PRODUCTION_SUPABASE_PROJECT_REF = "ukjjopridghvwzobrsus"


def fingerprint(url: str) -> dict[str, str | None]:
    raw = (url or "").strip()
    if not raw:
        return {
            "project_ref": None,
            "host_tail": None,
            "database_name": None,
        }
    parsed = urlparse(raw)
    host = parsed.hostname or ""
    labels = [part for part in host.split(".") if part]
    host_tail = ".".join(labels[-3:]) if labels else host
    user = unquote(parsed.username or "")
    project_ref = None
    if user.startswith("postgres.") and "." in user:
        project_ref = user.split(".", 1)[1] or None
    database_name = unquote((parsed.path or "/").lstrip("/")) or "postgres"
    return {
        "project_ref": project_ref,
        "host_tail": host_tail or None,
        "database_name": database_name,
    }


def decide(target: str, database_url: str, direct_url: str) -> dict:
    if target not in {"production", "preview"}:
        return {"ok": False, "reason": "invalid_target"}
    db = fingerprint(database_url)
    direct = fingerprint(direct_url)
    if not db["project_ref"] or not direct["project_ref"]:
        return {"ok": False, "reason": "unrecognized_database"}
    if db["project_ref"] != direct["project_ref"]:
        return {"ok": False, "reason": "database_and_direct_project_mismatch"}
    ref = db["project_ref"]
    if db["project_ref"] == direct["project_ref"] == PRODUCTION_SUPABASE_PROJECT_REF:
        if target == "production":
            return {
                "ok": True,
                "target": "production",
                "project_ref": ref,
                "host_tail": db["host_tail"],
                "database_name": db["database_name"],
            }
        return {"ok": False, "reason": "preview_must_not_use_production_project"}
    if target == "production":
        return {"ok": False, "reason": "production_must_use_official_project"}
    return {
        "ok": True,
        "target": "preview",
        "project_ref": ref,
        "host_tail": db["host_tail"],
        "database_name": db["database_name"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--direct-url", required=True)
    args = parser.parse_args()
    result = decide(args.target, args.database_url, args.direct_url)
    safe = {
        key: result[key]
        for key in ("ok", "reason", "target", "project_ref", "host_tail", "database_name")
        if key in result
    }
    print(json.dumps(safe, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
