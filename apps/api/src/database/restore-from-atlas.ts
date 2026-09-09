/**
 * Disaster recovery: pull data from an Atlas cloud backup down into this machine's local
 * Mongo. Deliberately a guarded manual script, not a UI button or API endpoint — restoring
 * is rare and high-stakes enough (it overwrites the local database) that a confirmation
 * step is the right amount of friction. See HOST_MONGO_SETUP.md.
 *
 * Usage:
 *   npx ts-node --project tsconfig.seed.json src/database/restore-from-atlas.ts --atlas-uri="mongodb+srv://..." --dry-run
 *   npx ts-node --project tsconfig.seed.json src/database/restore-from-atlas.ts --atlas-uri="mongodb+srv://..." --yes
 *
 * The Atlas connection string is passed explicitly via --atlas-uri, not read from local
 * Settings — this runs on a freshly set-up Host machine that has no app data yet, so
 * there's nothing to read it from.
 */
import { PrismaClient } from '@prisma/client';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MODELS = [
  'clinic',
  'role',
  'user',
  'feeType',
  'patientFieldDefinition',
  'counter',
  'medicineFieldDefinition',
  'visitFieldDefinition',
  'patient',
  'medicine',
  'visit',
  'vital',
  'labTest',
  'followUp',
  'prescription',
  'prescriptionItem',
  'document',
  'compliance',
  'appointment',
  'certificate',
  'bill',
  'billItem',
  'paymentAccount',
  'payment',
] as const;

const BACKUP_DIR = join(process.cwd(), 'prisma', 'backups');

function parseArgs() {
  const args = process.argv.slice(2);
  const atlasUri = args.find((a) => a.startsWith('--atlas-uri='))?.slice('--atlas-uri='.length);
  const dryRun = args.includes('--dry-run');
  const confirmed = args.includes('--yes');
  return { atlasUri, dryRun, confirmed };
}

function dbNameFromUri(uri: string): string | null {
  try {
    const path = new URL(uri).pathname.replace(/^\//, '');
    return path || null;
  } catch {
    return null;
  }
}

function stripDbFromUri(uri: string): string {
  const url = new URL(uri);
  url.pathname = '/';
  return url.toString();
}

function resolveTool(name: 'mongodump' | 'mongorestore'): string {
  const toolsRoot = 'C:\\Program Files\\MongoDB\\Tools';
  if (existsSync(toolsRoot)) {
    const versions = readdirSync(toolsRoot).sort().reverse();
    for (const version of versions) {
      const candidate = join(toolsRoot, version, 'bin', `${name}.exe`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return name;
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`  $ ${command} ${args.join(' ')}`);
    execFile(command, args, { windowsHide: true }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve();
    });
  });
}

async function countAll(client: { [key: string]: any }): Promise<Record<string, number>> {
  const entries = await Promise.all(MODELS.map(async (model) => [model, await client[model].count()] as const));
  return Object.fromEntries(entries);
}

function printCounts(label: string, counts: Record<string, number>) {
  console.log(`\n${label}:`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const [model, count] of Object.entries(counts)) {
    if (count > 0) console.log(`  ${model}: ${count}`);
  }
  console.log(`  TOTAL: ${total}`);
}

async function main() {
  const { atlasUri, dryRun, confirmed } = parseArgs();
  if (!atlasUri) {
    console.error('Usage: --atlas-uri="mongodb+srv://..." [--dry-run | --yes]');
    process.exitCode = 1;
    return;
  }

  const localUri = process.env.DATABASE_URL ?? '';
  const localDb = dbNameFromUri(localUri);
  const atlasDb = dbNameFromUri(atlasUri);
  if (!localDb || !atlasDb) {
    console.error('Could not determine a database name from DATABASE_URL or --atlas-uri.');
    process.exitCode = 1;
    return;
  }

  console.log(`Local:  ${localDb} (from DATABASE_URL)`);
  console.log(`Atlas:  ${atlasDb} (from --atlas-uri)`);

  const atlasClient = new PrismaClient({ datasourceUrl: atlasUri });
  const localClient = new PrismaClient({ datasourceUrl: localUri });

  const atlasCounts = await countAll(atlasClient as unknown as { [key: string]: any });
  printCounts('Atlas has', atlasCounts);

  const localCountsBefore = await countAll(localClient as unknown as { [key: string]: any });
  printCounts('Local currently has (will be REPLACED)', localCountsBefore);

  if (dryRun) {
    console.log('\n--dry-run: no changes made.');
    await Promise.all([atlasClient.$disconnect(), localClient.$disconnect()]);
    return;
  }

  if (!confirmed) {
    console.log('\nThis will REPLACE all local data with what is shown above from Atlas.');
    console.log('Re-run with --yes to actually apply it.');
    await Promise.all([atlasClient.$disconnect(), localClient.$disconnect()]);
    return;
  }

  await Promise.all([atlasClient.$disconnect(), localClient.$disconnect()]);

  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

  // Belt-and-suspenders: take a safety dump of whatever's currently local (even if empty)
  // BEFORE touching anything, so a bad restore doesn't destroy a still-working local DB
  // with no way back.
  const safetyArchive = join(BACKUP_DIR, `pre-restore-safety-${new Date().toISOString().replace(/[:.]/g, '-')}.gz`);
  console.log(`\nTaking a safety dump of the current local DB to ${safetyArchive} ...`);
  await run(resolveTool('mongodump'), ['--uri', localUri, '--archive=' + safetyArchive, '--gzip']);

  // mongorestore has no "pull directly from a live remote database" mode — its source is
  // always a dump directory or --archive file, never another URI. Download from Atlas to a
  // local archive first, then restore from that (same nsFrom/nsTo db-rename technique as
  // the backup direction — see the comment in backup.service.ts's syncToAtlas for why the
  // restoring --uri can't also carry a db name alongside --nsFrom/--nsTo).
  const downloadedArchive = join(BACKUP_DIR, `from-atlas-${new Date().toISOString().replace(/[:.]/g, '-')}.gz`);
  console.log(`\nDownloading from Atlas to ${downloadedArchive} ...`);
  await run(resolveTool('mongodump'), ['--uri', atlasUri, '--archive=' + downloadedArchive, '--gzip']);

  console.log('\nRestoring into local Mongo ...');
  await run(resolveTool('mongorestore'), [
    '--uri',
    stripDbFromUri(localUri),
    '--archive=' + downloadedArchive,
    '--gzip',
    '--drop',
    `--nsFrom=${atlasDb}.*`,
    `--nsTo=${localDb}.*`,
  ]);

  const verifyClient = new PrismaClient({ datasourceUrl: localUri });
  const localCountsAfter = await countAll(verifyClient as unknown as { [key: string]: any });
  await verifyClient.$disconnect();
  printCounts('Local now has', localCountsAfter);

  console.log(`\nDone. If this restore was a mistake, the pre-restore state was saved to ${safetyArchive}`);
}

main().catch((error) => {
  console.error('Restore failed:', error);
  process.exitCode = 1;
});
