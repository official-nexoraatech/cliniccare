import { app } from 'electron';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

// jwtSecret is generated once on first Host setup (see main.ts's setup:choose-host handler)
// and persisted here — the packaged app ships no .env, so there's nothing else to read a
// real secret from, and every Client just trusts whatever token the Host's API issues.
export type AppConfig = { role: 'HOST'; jwtSecret: string } | { role: 'CLIENT'; hostUrl: string };

export function generateJwtSecret(): string {
  return randomBytes(32).toString('hex');
}

function configPath(): string {
  return path.join(app.getPath('userData'), 'clinic-care-config.json');
}

export function readConfig(): AppConfig | null {
  const file = configPath();
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as AppConfig;
  } catch {
    return null;
  }
}

export function writeConfig(config: AppConfig): void {
  writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8');
}

export function clearConfig(): void {
  const file = configPath();
  if (existsSync(file)) unlinkSync(file);
}
