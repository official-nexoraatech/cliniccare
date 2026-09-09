import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { BackupAttempt, BackupStatus, RestorePreview, RestoreResult } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBackupSettingsDto } from './dto/update-backup-settings.dto';

const SETTING_KEYS = {
  enabled: 'backup_enabled',
  atlasConnectionString: 'atlas_connection_string',
  retentionCount: 'local_retention_count',
} as const;

const DEFAULT_RETENTION_COUNT = 7;
const BACKUP_DIR = join(process.cwd(), 'prisma', 'backups');

// Used here only to compare per-collection counts between local Mongo and Atlas after a restore.
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

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<BackupStatus> {
    const [enabled, atlasConnectionString] = await Promise.all([
      this.getSetting(SETTING_KEYS.enabled),
      this.getSetting(SETTING_KEYS.atlasConnectionString),
    ]);

    const [lastLocalDump, lastAtlasSync, recent] = await Promise.all([
      this.prisma.backupLog.findFirst({ where: { stage: 'LOCAL_DUMP', status: 'SUCCESS' }, orderBy: { startedAt: 'desc' } }),
      this.prisma.backupLog.findFirst({ where: { stage: 'ATLAS_SYNC', status: 'SUCCESS' }, orderBy: { startedAt: 'desc' } }),
      this.prisma.backupLog.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
    ]);

    return {
      enabled: enabled === 'true',
      atlasConfigured: Boolean(atlasConnectionString),
      lastLocalDumpAt: lastLocalDump?.startedAt.toISOString() ?? null,
      lastAtlasSyncAt: lastAtlasSync?.startedAt.toISOString() ?? null,
      recentAttempts: recent.map((row): BackupAttempt => ({
        id: row.id,
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
        stage: row.stage,
        status: row.status,
        message: row.message,
        localCount: row.localCount,
        atlasCount: row.atlasCount,
      })),
    };
  }

  /** Rejects with a clear reason (bad format, unreachable, wrong credentials, ...) instead
   * of ever silently persisting a connection string that can't actually be used — see
   * testAtlasConnection(). */
  async updateSettings(dto: UpdateBackupSettingsDto): Promise<BackupStatus> {
    if (dto.atlasConnectionString !== undefined && dto.atlasConnectionString !== '') {
      const check = await this.testAtlasConnection(dto.atlasConnectionString);
      if (!check.ok) {
        throw new BadRequestException(check.message ?? 'Could not connect using this connection string.');
      }
    }
    await this.setSetting(SETTING_KEYS.enabled, dto.enabled ? 'true' : 'false');
    if (dto.atlasConnectionString !== undefined) {
      await this.setSetting(SETTING_KEYS.atlasConnectionString, dto.atlasConnectionString);
    }
    return this.getStatus();
  }

  /** Manual "Backup Now" — runs the local dump, then the Atlas sync if configured, and
   * waits for both so the caller can show a real result instead of "started". */
  async runNow(): Promise<BackupStatus> {
    if ((await this.getSetting(SETTING_KEYS.enabled)) !== 'true') {
      return this.getStatus();
    }
    const archivePath = await this.runLocalDump();
    await this.syncToAtlasIfConfigured(archivePath);
    return this.getStatus();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleNightly(): Promise<void> {
    if ((await this.getSetting(SETTING_KEYS.enabled)) !== 'true') return;
    const archivePath = await this.runLocalDump();
    await this.syncToAtlasIfConfigured(archivePath);
  }

  // Logs an explicit SKIPPED attempt when Atlas isn't configured, instead of just quietly
  // doing nothing — "Recent attempts" must never leave the admin guessing whether cloud
  // sync ran. If the local dump itself failed, that failure is already logged on its own;
  // no need for a second, misleading "skipped" entry alongside it.
  private async syncToAtlasIfConfigured(archivePath: string | null): Promise<void> {
    const atlasUri = await this.getSetting(SETTING_KEYS.atlasConnectionString);
    if (!atlasUri) {
      await this.prisma.backupLog.create({
        data: {
          stage: 'ATLAS_SYNC',
          status: 'SKIPPED',
          message: 'No Atlas connection string configured — only a local snapshot was taken.',
          finishedAt: new Date(),
        },
      });
      return;
    }
    if (archivePath) {
      await this.syncToAtlas(archivePath, atlasUri);
    }
  }

  /** Cheap retry loop for a flaky/offline connection: if the most recent Atlas-sync attempt
   * didn't succeed, try again using the archive it already has — no re-dump — instead of
   * waiting for tomorrow's nightly run. Naturally stops retrying once one succeeds. */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyRetry(): Promise<void> {
    if ((await this.getSetting(SETTING_KEYS.enabled)) !== 'true') return;
    const atlasUri = await this.getSetting(SETTING_KEYS.atlasConnectionString);
    if (!atlasUri) return;

    const lastSync = await this.prisma.backupLog.findFirst({ where: { stage: 'ATLAS_SYNC' }, orderBy: { startedAt: 'desc' } });
    if (!lastSync || lastSync.status === 'SUCCESS') return;

    const lastDump = await this.prisma.backupLog.findFirst({
      where: { stage: 'LOCAL_DUMP', status: 'SUCCESS', archivePath: { not: null } },
      orderBy: { startedAt: 'desc' },
    });
    if (!lastDump?.archivePath || !existsSync(lastDump.archivePath)) return;

    await this.syncToAtlas(lastDump.archivePath, atlasUri);
  }

  private async runLocalDump(): Promise<string | null> {
    const log = await this.prisma.backupLog.create({ data: { stage: 'LOCAL_DUMP', status: 'RETRYING' } });
    try {
      const mongodump = this.resolveTool('mongodump');
      if (!mongodump) {
        await this.finishLog(log.id, 'FAILED', 'mongodump not found — install MongoDB Database Tools, see HOST_MONGO_SETUP.md');
        return null;
      }
      if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

      const archivePath = join(BACKUP_DIR, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.gz`);
      const databaseUrl = process.env.DATABASE_URL ?? '';
      // --oplog (a consistent point-in-time snapshot across collections even mid-write)
      // only works on a whole-instance dump, not one scoped to a single database by URI —
      // and DATABASE_URL is scoped to just `clinic_care`. Not worth widening the dump to
      // the whole mongod instance (admin/local/config included) just to keep it; this
      // clinic's dataset dumps in well under a second, so the inconsistency window without
      // --oplog is negligible in practice.
      await this.execFile(mongodump, ['--uri', databaseUrl, '--archive=' + archivePath, '--gzip']);

      const localCount = await this.countAll(this.prisma);
      await this.finishLog(log.id, 'SUCCESS', null, archivePath, localCount);
      this.pruneOldArchives();
      return archivePath;
    } catch (error) {
      this.logger.warn(`Local Mongo dump failed: ${(error as Error).message}`);
      await this.finishLog(log.id, 'FAILED', (error as Error).message);
      return null;
    }
  }

  private async syncToAtlas(archivePath: string, atlasUri: string): Promise<void> {
    const log = await this.prisma.backupLog.create({ data: { stage: 'ATLAS_SYNC', status: 'RETRYING', archivePath } });
    try {
      const mongorestore = this.resolveTool('mongorestore');
      if (!mongorestore) {
        await this.finishLog(log.id, 'FAILED', 'mongorestore not found — install MongoDB Database Tools, see HOST_MONGO_SETUP.md');
        return;
      }
      // mongorestore replays the database name embedded IN THE ARCHIVE, not the db-path
      // segment of --uri — without explicit remapping, a target URI naming a different
      // database (or a typo) would silently restore into a namespace that isn't the one
      // the admin configured, which with --drop is exactly the kind of mistake this can't
      // afford. Force it explicitly: local source db -> the db actually named in atlasUri.
      //
      // Verified live (not just from docs): --nsFrom/--nsTo and a --uri that ALSO names a
      // database conflict silently — mongorestore reports "0 documents restored, 0 failed"
      // with no error at all. The fix is to strip the db segment from --uri (nsTo controls
      // the destination instead) — confirmed this actually restores real documents.
      const sourceDb = this.dbNameFromUri(process.env.DATABASE_URL ?? '');
      const targetDb = this.dbNameFromUri(atlasUri);
      if (!sourceDb || !targetDb) {
        throw new Error('Could not determine a database name from DATABASE_URL or the Atlas connection string');
      }
      await this.execFile(mongorestore, [
        '--uri',
        this.stripDbFromUri(atlasUri),
        '--archive=' + archivePath,
        '--gzip',
        '--drop',
        `--nsFrom=${sourceDb}.*`,
        `--nsTo=${targetDb}.*`,
      ]);

      const [localCount, atlasCount] = await Promise.all([this.countAll(this.prisma), this.countAllAtlas(atlasUri)]);
      const mismatch = localCount !== atlasCount;
      await this.finishLog(
        log.id,
        'SUCCESS',
        mismatch ? `Restored, but counts differ: local=${localCount} atlas=${atlasCount}` : null,
        archivePath,
        localCount,
        atlasCount,
      );
    } catch (error) {
      // Offline/DNS/auth failure — logged, never thrown further. The hourly retry job
      // picks this up and tries again using the same archive, no re-dump needed.
      this.logger.warn(`Atlas sync failed (will retry hourly): ${(error as Error).message}`);
      await this.finishLog(log.id, 'FAILED', (error as Error).message, archivePath);
    }
  }

  async getRestorePreview(): Promise<RestorePreview> {
    const atlasUri = await this.getSetting(SETTING_KEYS.atlasConnectionString);
    const localCount = await this.countAll(this.prisma);
    if (!atlasUri) {
      return { atlasConfigured: false, atlasCount: null, localCount };
    }
    try {
      const atlasCount = await this.countAllAtlas(atlasUri);
      return { atlasConfigured: true, atlasCount, localCount };
    } catch (error) {
      return { atlasConfigured: true, atlasCount: null, localCount, error: this.friendlyAtlasError(error) };
    }
  }

  /** Atlas -> local, the reverse of the normal backup direction — triggered from Settings.
   * Always takes a safety dump of whatever's currently local FIRST (even if empty), before
   * touching anything, so a bad restore doesn't destroy a still-working local DB with no way
   * back. Mirrors src/database/restore-from-atlas.ts, the CLI equivalent used to bootstrap a
   * brand-new Host machine that has nobody logged in yet to click this button. */
  async restoreFromAtlas(): Promise<RestoreResult> {
    const atlasUri = await this.getSetting(SETTING_KEYS.atlasConnectionString);
    if (!atlasUri) {
      throw new BadRequestException('No Atlas connection string configured.');
    }

    const startedAt = new Date();
    const localCountBefore = await this.countAll(this.prisma);

    // Deliberately NOT a create-then-update-by-id like the other two directions: --drop
    // below wipes BackupLog along with every other local collection (it's part of the same
    // database being replaced), so a row created beforehand would already be gone by the
    // time this tries to record the outcome — confirmed live, that update threw P2025 "no
    // record found" right after a restore that had actually succeeded. Record the outcome
    // as one fresh insert at the end instead, after the drop has already happened.
    const record = (status: 'SUCCESS' | 'FAILED', message: string | null, archivePath?: string, localCountAfter?: number) =>
      this.prisma.backupLog
        .create({
          data: { startedAt, finishedAt: new Date(), stage: 'RESTORE', status, message, archivePath, localCount: localCountAfter },
        })
        .catch((e) => this.logger.warn(`Could not record restore outcome: ${(e as Error).message}`));

    try {
      const mongodump = this.resolveTool('mongodump');
      const mongorestore = this.resolveTool('mongorestore');
      if (!mongodump || !mongorestore) {
        const message = 'mongodump/mongorestore not found — install MongoDB Database Tools, see HOST_MONGO_SETUP.md';
        await record('FAILED', message);
        return { ok: false, message, localCountBefore, localCountAfter: null };
      }
      if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

      const databaseUrl = process.env.DATABASE_URL ?? '';
      const sourceDb = this.dbNameFromUri(atlasUri); // Atlas is the SOURCE this time
      const targetDb = this.dbNameFromUri(databaseUrl); // local is the TARGET this time
      if (!sourceDb || !targetDb) {
        throw new Error('Could not determine a database name from DATABASE_URL or the Atlas connection string');
      }

      const timestamp = startedAt.toISOString().replace(/[:.]/g, '-');
      const safetyArchive = join(BACKUP_DIR, `pre-restore-safety-${timestamp}.gz`);
      await this.execFile(mongodump, ['--uri', databaseUrl, '--archive=' + safetyArchive, '--gzip']);

      // mongorestore has no "pull directly from a live remote database" mode — its source
      // is always a dump/archive file, never another URI. Download from Atlas first, then
      // restore from that (same nsFrom/nsTo db-rename technique as the backup direction —
      // see the comment in syncToAtlas for why the target --uri can't also carry a db name).
      const downloadedArchive = join(BACKUP_DIR, `from-atlas-${timestamp}.gz`);
      await this.execFile(mongodump, ['--uri', atlasUri, '--archive=' + downloadedArchive, '--gzip']);
      await this.execFile(mongorestore, [
        '--uri',
        this.stripDbFromUri(databaseUrl),
        '--archive=' + downloadedArchive,
        '--gzip',
        '--drop',
        `--nsFrom=${sourceDb}.*`,
        `--nsTo=${targetDb}.*`,
      ]);

      const localCountAfter = await this.countAll(this.prisma);
      await record('SUCCESS', `Pre-restore safety dump saved to ${safetyArchive}`, downloadedArchive, localCountAfter);
      return { ok: true, localCountBefore, localCountAfter };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Restore from Atlas failed: ${message}`);
      await record('FAILED', message);
      return { ok: false, message, localCountBefore, localCountAfter: null };
    }
  }

  private async countAll(client: { [key: string]: any }): Promise<number> {
    const counts = await Promise.all(MODELS.map((model) => client[model].count()));
    return counts.reduce((sum: number, n: number) => sum + n, 0);
  }

  private async countAllAtlas(atlasUri: string): Promise<number> {
    const atlasClient = new PrismaClient({ datasourceUrl: atlasUri });
    try {
      return await this.countAll(atlasClient as unknown as { [key: string]: any });
    } finally {
      await atlasClient.$disconnect();
    }
  }

  private pruneOldArchives(): void {
    if (!existsSync(BACKUP_DIR)) return;
    const files = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.gz'))
      .sort()
      .reverse();
    const retention = Number(this.getSettingSync(SETTING_KEYS.retentionCount) ?? DEFAULT_RETENTION_COUNT) || DEFAULT_RETENTION_COUNT;
    for (const file of files.slice(retention)) {
      try {
        unlinkSync(join(BACKUP_DIR, file));
      } catch (error) {
        this.logger.warn(`Failed to prune old backup archive ${file}: ${(error as Error).message}`);
      }
    }
  }

  private getSettingSync(_key: string): string | undefined {
    // Retention count isn't exposed in the UI yet (see BackupSettingsPage) — always falls
    // through to DEFAULT_RETENTION_COUNT for now. Kept as a method (not inlined) so wiring
    // it up later is a one-line change here, not a new code path.
    return undefined;
  }

  private async finishLog(
    id: string,
    status: 'SUCCESS' | 'FAILED',
    message: string | null,
    archivePath?: string,
    localCount?: number,
    atlasCount?: number,
  ): Promise<void> {
    await this.prisma.backupLog.update({
      where: { id },
      data: { finishedAt: new Date(), status, message, archivePath, localCount, atlasCount },
    });
  }

  private async getSetting(key: string): Promise<string | undefined> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value;
  }

  private async setSetting(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  // Validates format, then actually opens a connection — a typo'd host, wrong credentials,
  // an Atlas cluster that hasn't allow-listed this machine's IP, or no internet at all are
  // all caught HERE, before anything is ever saved, rather than surfacing as a mysterious
  // failure the next time a scheduled backup silently doesn't happen.
  private async testAtlasConnection(uri: string): Promise<{ ok: boolean; message?: string }> {
    if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
      return { ok: false, message: 'Connection string must start with mongodb:// or mongodb+srv://' };
    }
    const dbName = this.dbNameFromUri(uri);
    if (!dbName) {
      return { ok: false, message: 'Connection string must include a database name, e.g. mongodb+srv://.../clinic_care' };
    }

    const client = new PrismaClient({ datasourceUrl: uri });
    const TEST_TIMEOUT_MS = 10000;
    try {
      await Promise.race([
        client.$connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), TEST_TIMEOUT_MS)),
      ]);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: this.friendlyAtlasError(error) };
    } finally {
      await client.$disconnect().catch(() => {});
    }
  }

  private friendlyAtlasError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    if (raw === 'TIMEOUT' || /timed? ?out/i.test(raw)) {
      return 'Connection timed out — check your internet connection and that this machine\'s IP is allowed in Atlas → Network Access.';
    }
    if (/auth(entication)? failed|bad auth|unauthorized/i.test(raw)) {
      return 'Authentication failed — check the username and password in the connection string.';
    }
    if (/ENOTFOUND|getaddrinfo|querySrv|could not resolve|DNS resolution|no record found/i.test(raw)) {
      return 'Could not resolve the Atlas host — check your internet connection and that the connection string is correct.';
    }
    if (/ECONNREFUSED/i.test(raw)) {
      return 'Connection refused by the server — check the host and port in the connection string.';
    }
    // Fall through to the raw driver message rather than hiding it — better an unpolished
    // message than a swallowed one for an edge case not covered above.
    return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
  }

  private dbNameFromUri(uri: string): string | null {
    try {
      const path = new URL(uri).pathname.replace(/^\//, '');
      return path || null;
    } catch {
      return null;
    }
  }

  private stripDbFromUri(uri: string): string {
    const url = new URL(uri);
    url.pathname = '/';
    return url.toString();
  }

  private resolveTool(name: 'mongodump' | 'mongorestore'): string | null {
    const toolsRoot = 'C:\\Program Files\\MongoDB\\Tools';
    if (existsSync(toolsRoot)) {
      const versions = readdirSync(toolsRoot).sort().reverse();
      for (const version of versions) {
        const candidate = join(toolsRoot, version, 'bin', `${name}.exe`);
        if (existsSync(candidate)) return candidate;
      }
    }
    // Falls back to PATH resolution (works if the operator added it themselves).
    return name;
  }

  private execFile(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(command, args, { windowsHide: true }, (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve();
      });
    });
  }
}
