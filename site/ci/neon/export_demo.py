"""Export only the already public TEST views for the original browser DEMO.

No database credentials, business writes, grants or production endpoints.
The browser receives one immutable dataset from its own Pages origin.
"""
import argparse
import concurrent.futures
import hashlib
import json
import shutil
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

ROOT = "https://ep-fragrant-feather-zaribpm5.apirest.c-2.eu-west-2.aws.neon.tech/neondb/rest/v1"
AUTH = "https://ep-fragrant-feather-zaribpm5.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth/token/anonymous"
DATASET = "RECON_CYCLE_0027"
PAGE = 100


def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--cache-directory", type=Path)
    parser.add_argument("--require-cache", action="store_true")
    args = parser.parse_args()
    with urllib.request.urlopen(AUTH, timeout=30) as response:
        token = json.load(response)["token"]
    if not isinstance(token, str) or token.count(".") != 2:
        raise RuntimeError("DEMO_EXPORT_AUTH_INVALID")

    def read(view, **params):
        url = ROOT + "/" + view + "?" + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, headers={"Accept": "application/json", "Authorization": "Bearer " + token, "Prefer": "count=exact"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    body, content_range = json.load(response), response.headers.get("Content-Range", "")
                if not isinstance(body, list) or not content_range.rsplit("/", 1)[-1].isdigit():
                    raise RuntimeError("DEMO_EXPORT_ROWSET_INVALID")
                return body, int(content_range.rsplit("/", 1)[-1])
            except OSError:
                if attempt == 2:
                    raise RuntimeError("DEMO_EXPORT_READ_FAILED: " + view) from None
                time.sleep(attempt + 1)

    def all_rows(view, **params):
        first, total = read(view, limit=PAGE, offset=0, **params)
        if total > 200000:
            raise RuntimeError("DEMO_EXPORT_ROW_LIMIT")
        pages = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            pending = {pool.submit(read,view,limit=PAGE,offset=offset,**params):offset for offset in range(PAGE,total,PAGE)}
            for index, future in enumerate(concurrent.futures.as_completed(pending),1):
                pages.append((pending[future],future.result()[0]))
                if index % 200 == 0:
                    print(f"EFHC_DEMO_EXPORT_PROGRESS view={view} pages={index}/{len(pending)}", flush=True)
        rows = first + [row for _,page in sorted(pages) for row in page]
        if len(rows) != total:
            raise RuntimeError("DEMO_EXPORT_TRUNCATED: " + view)
        return rows

    seed_rows, _ = read("bootstrap_snapshot", select="bank,users,panels,intents,bonus_events,referrals,tasks", limit=1)
    if len(seed_rows) != 1:
        raise RuntimeError("DEMO_EXPORT_OPENING_INVALID")
    seed = seed_rows[0]
    if len(seed["users"]) != 1000 or len(seed["panels"]) != 4000 or len(seed["intents"]) != 1000:
        raise RuntimeError("DEMO_EXPORT_OPENING_INCOMPLETE")
    facts = seed["bank"]["facts"]
    if seed["bank"]["database_scope"] != "EFHC_Nektron_Test" or seed["bank"]["dataset"] != DATASET or facts["bank_metrics_integrity_ok"] != "1":
        raise RuntimeError("DEMO_EXPORT_SCOPE_OR_MASS_ERROR")
    if sum(Decimal(p["generated_kwh"]) for p in seed["panels"]) != Decimal(facts["bank_metrics_generated_kwh"]):
        raise RuntimeError("DEMO_EXPORT_GENERATION_MISMATCH")
    # Avoid a new dataset identity for a read-time timestamp alone.
    seed["bank"]["ts"] = max(u["updated_at"] for u in seed["users"])
    if "bank_metrics_updated_at" in facts:
        facts["bank_metrics_updated_at"] = seed["bank"]["ts"]
    counts = all_rows("table_counts", select="table_name,rows_count", order="table_name.asc")
    # A code-only edit must not download the 88k immutable history again.
    # Revalidate the current opening and public catalog before cache reuse.
    for index, user in enumerate(seed["users"]):
        user["username"] = f"efhc_demo_{index + 1:04d}"
    catalog_head = all_rows("catalog_rows", select="table_name,id,item", table_name="in.(shop_items,hub_links,task_catalog)", order="table_name.asc,id.asc")
    fingerprint = hashlib.sha256(encode({"seed":seed,"counts":counts,"catalog":catalog_head,
                                         "exporter":hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})).hexdigest()

    def write_build(identity):
        config = args.target / "src/reconstruction/demoDataBuild.json"
        config.parent.mkdir(parents=True, exist_ok=True)
        config.write_bytes(encode({"schema":"efhc.demo.snapshot.v1","snapshot_id":identity,"dataset":DATASET}))

    if args.cache_directory and (args.cache_directory / "source.json").is_file():
        cached = json.loads((args.cache_directory / "source.json").read_text())
        cached_root = args.cache_directory / cached["snapshot_id"]
        if cached.get("fingerprint") == fingerprint and (cached_root / "manifest.json").is_file():
            cached_manifest = json.loads((cached_root / "manifest.json").read_text())
            if all(hashlib.sha256((cached_root / name).read_bytes()).hexdigest() == digest for name,digest in cached_manifest["files"].items()):
                shutil.copytree(cached_root, args.target / "public/demo/data" / cached["snapshot_id"], dirs_exist_ok=True)
                write_build(cached["snapshot_id"])
                print("EFHC_DEMO_SNAPSHOT_CACHE=PASS current_source_fingerprint=" + fingerprint, flush=True)
                return
    if args.require_cache:
        raise RuntimeError("DEMO_EXPORT_CACHE_NOT_MATCHED")
    print("EFHC_DEMO_SNAPSHOT_EXPORT=START immutable_history", flush=True)
    ledger = all_rows("transfers_all", select="id,global_id,system_entity,direction,reason,created_at,amount_efhc,balance_type,event_id,dataset", order="id.asc")
    events = all_rows("economic_events", select="id,global_id,reason,created_at,amount_efhc,amount_kwh,event_id,dataset", order="id.asc")
    catalog = all_rows("catalog_rows", select="table_name,id,item", table_name="in.(shop_items,hub_links,task_catalog,referrals,referral_bonuses,ad_reward_sessions,task_submissions)", order="table_name.asc,id.asc")
    expected = {r["table_name"]: r["rows_count"] for r in counts}
    if len(ledger) != expected["ledger_entries"] or len({r["id"] for r in ledger}) != len(ledger):
        raise RuntimeError("DEMO_EXPORT_LEDGER_COUNT_ERROR")
    if any(r["dataset"] != DATASET for r in ledger + events):
        raise RuntimeError("DEMO_EXPORT_DATASET_MISMATCH")
    # The public projections themselves require meta.demo=true + the C27
    # synthetic cycle. Never export real identities or server admin/settings.
    # Replace display-only names with deterministic fictional aliases as well.
    owners = {u["global_id"] for u in seed["users"]}
    if any(not str(gid).isdigit() or len(str(gid)) != 10 for gid in owners):
        raise RuntimeError("DEMO_EXPORT_GLOBAL_ID_INVALID")
    for index, user in enumerate(seed["users"]):
        user["username"] = f"efhc_demo_{index + 1:04d}"
    if any(r["global_id"] is not None and r["global_id"] not in owners for r in ledger + events):
        raise RuntimeError("DEMO_EXPORT_FOREIGN_ACCOUNT")
    files = {"bootstrap.json": seed, "table_counts.json": counts}
    by_owner, exchanges, catalogs = defaultdict(list), defaultdict(list), defaultdict(list)
    for row in ledger:
        row["amount"] = row["amount_efhc"]
        if row["global_id"] is not None:
            by_owner[row["global_id"]].append(row)
    for gid, rows in by_owner.items():
        rows.sort(key=lambda r: (r["created_at"], int(r["id"])), reverse=True)
        files["ledger/" + gid + ".json"] = rows
    for event in events:
        if event["reason"] == "exchange_kwh":
            exchanges[event["global_id"]].append(event)
    for user in seed["users"]:
        gid = user["global_id"]
        files.setdefault("ledger/" + gid + ".json", [])
        files["exchanges/" + gid + ".json"] = sorted(exchanges[gid], key=lambda r: (r["created_at"], int(r["id"])), reverse=True)
    files["deposits.json"] = [r for r in events if r["reason"] == "efhc_external_deposit"]
    for row in catalog:
        catalogs[row["table_name"]].append(row)
    # Browser role selection is a public simulator fixture, never backend RBAC.
    catalogs["admin_roles"] = [{"id":"demo-user","item":{"id":"demo-user","role":"user","mode":"demo"}},
                               {"id":"demo-admin","item":{"id":"demo-admin","role":"superadmin","mode":"demo"}}]
    catalogs["settings"] = []
    for name, rows in catalogs.items():
        files["catalog/" + name + ".json"] = rows
    collections = {}
    for name, rows in (("transfers_all", ledger), ("bank_transfers", [r for r in ledger if r["system_entity"] is not None])):
        rows.sort(key=lambda r: int(r["id"]), reverse=True)
        collections[name] = {"total": len(rows), "page_size": 1000}
        for index in range(0, len(rows), 1000):
            files[f"{name}/{index // 1000}.json"] = rows[index:index + 1000]
    hashes = {name: hashlib.sha256(encode(value)).hexdigest() for name, value in files.items()}
    identity = hashlib.sha256(encode(hashes)).hexdigest()
    manifest = {"schema": "efhc.demo.snapshot.v1", "snapshot_id": identity, "dataset": DATASET,
                "collections": collections, "files": hashes, "counts": expected}
    files["manifest.json"] = manifest
    destination = args.target / "public/demo/data" / identity
    destination.mkdir(parents=True, exist_ok=True)
    for name, value in files.items():
        path = destination / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encode(value))
    write_build(identity)
    if args.cache_directory:
        args.cache_directory.mkdir(parents=True, exist_ok=True)
        shutil.copytree(destination, args.cache_directory / identity, dirs_exist_ok=True)
        (args.cache_directory / "source.json").write_bytes(encode({"snapshot_id":identity,"fingerprint":fingerprint}))
    print(f"EFHC_DEMO_SNAPSHOT=PASS users=1000 panels=4000 ledger={len(ledger)} files={len(files)} snapshot={identity}")


if __name__ == "__main__":
    main()
