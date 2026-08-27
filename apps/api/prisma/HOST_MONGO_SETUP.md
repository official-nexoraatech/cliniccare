# Host machine: MongoDB setup

One-time setup for whichever computer runs as the clinic's **Host** (the machine that runs
the API server and holds the database — every other computer just connects to it over the
LAN, see the desktop app's Host/Client setup screen). Client machines need none of this.

## 1. Install MongoDB Community Server

```powershell
winget install --id MongoDB.Server -e
```

Installs and starts it as a Windows service (`MongoDB`) automatically, listening on
`127.0.0.1:27017`.

## 2. Turn it into a single-node replica set

Required because Prisma's MongoDB connector needs a replica set for transactions and for
cascading deletes (Prescription → its items, Bill → its items/payments) — a plain
standalone `mongod` will reject those. A single-node replica set is enough; it does **not**
add redundancy by itself (that's what Phase 4's Atlas backup is for), it just satisfies
Mongo's transaction requirement.

Open **PowerShell as Administrator**:

```powershell
$cfgPath = "C:\Program Files\MongoDB\Server\8.3\bin\mongod.cfg"   # adjust version folder if different
(Get-Content $cfgPath -Raw) -replace "#replication:", "replication:`n  replSetName: rs0" | Set-Content -Path $cfgPath -Encoding utf8
Restart-Service MongoDB
Start-Sleep -Seconds 3
mongosh --eval "rs.initiate()"
```

Converting a `mongod` that already has data in its dbpath into a replica set is safe — no
re-import needed, `rs.initiate()` works against an existing dbpath as-is.

## 3. Install the MongoDB Shell and Database Tools

```powershell
winget install --id MongoDB.Shell -e
winget install --id MongoDB.DatabaseTools -e
```

- `mongosh` — for the replica-set step above and any manual troubleshooting.
- `mongodump` / `mongorestore` — used by the app's Backup & Sync feature (Settings → Backup
  & Sync, Host only) if you choose to enable cloud backups. Not required if you're skipping
  that and using local Mongo only.

## 4. Point the app at it

`apps/api/.env`:

```
DATABASE_URL="mongodb://127.0.0.1:27017/clinic_care?replicaSet=rs0"
```

Then `npm run prisma:push -w apps/api` (creates collections/indexes) and
`npm run db:ensure-indexes -w apps/api` (creates the one index Prisma's schema can't
express — see the comment on `Bill.visitId` in `schema.prisma`). Both run automatically as
part of `start:prod`.

## Optional: authentication

If you turn on `--auth` on this Mongo instance (recommended, since it holds patient and
billing data), a replica set additionally needs a keyfile for internal member
authentication between replica set members — one extra one-time step beyond what's above,
not required to get started. See MongoDB's own docs on "replica set keyfile
authentication" when you're ready for it.

## Disaster recovery: restoring from an Atlas backup

If this Host machine is lost or its disk fails, and cloud backup was enabled: set up a
fresh Host machine using steps 1-4 above, then run the restore script (see
`apps/api/src/database/restore-from-atlas.ts` / its README) — it's deliberately a guarded
manual command, not a UI button, since restoring is rare and high-stakes enough that a
confirmation step is the right amount of friction.
