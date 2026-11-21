// Installation management for /master: communication backup, restore and preparing a fresh identity.
// Backups carry the token still encrypted with MASTER_ENCRYPTION_KEY; integrity is an HMAC derived from that key,
// so a backup only restores where a compatible key exists. The key itself is never exported.

export const BACKUP_FORMAT = "pdv-salao-master-backup";
export const BACKUP_VERSION = 1;

export interface BackupConfig {
  base_url: string | null;
  installation_id: string | null;
  token_encrypted: string | null;
  token_last4: string | null;
  store_name: string | null;
  sync_interval_seconds: number;
  log_retention_days: number;
}

export interface Backup {
  format: string;
  version: number;
  created_at: string;
  key_fingerprint: string;
  config: BackupConfig;
  integrity: string;
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");

export async function keyFingerprint(secret: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(`pdv-backup-fp:${secret}`))).slice(0, 16);
}

/** Stable serialization of everything the integrity code protects. */
export function canonical(b: Omit<Backup, "integrity">): string {
  const c = b.config;
  return JSON.stringify([b.format, b.version, b.created_at, b.key_fingerprint,
    c.base_url, c.installation_id, c.token_encrypted, c.token_last4, c.store_name,
    c.sync_interval_seconds, c.log_retention_days]);
}

async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(`pdv-backup-hmac:${secret}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}

export async function buildBackup(secret: string, config: BackupConfig, now = new Date()): Promise<Backup> {
  const base = { format: BACKUP_FORMAT, version: BACKUP_VERSION, created_at: now.toISOString(),
    key_fingerprint: await keyFingerprint(secret), config };
  return { ...base, integrity: await hmac(secret, canonical(base)) };
}

export type BackupCheck = { ok: true; backup: Backup } | { ok: false; reason: string };

const isStrOrNull = (v: unknown) => v === null || typeof v === "string";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Structure, version, key compatibility and integrity. Decryptability is checked by the caller. */
export async function verifyBackup(secret: string, raw: unknown): Promise<BackupCheck> {
  const b = raw as Backup;
  if (!b || typeof b !== "object" || b.format !== BACKUP_FORMAT) return { ok: false, reason: "O arquivo não é um backup de comunicação do PDV Salão." };
  if (b.version !== BACKUP_VERSION) return { ok: false, reason: `Versão de backup não suportada (${String(b.version)}).` };
  const c = b.config;
  if (!c || typeof b.created_at !== "string" || typeof b.key_fingerprint !== "string" || typeof b.integrity !== "string"
    || ![c.base_url, c.installation_id, c.token_encrypted, c.token_last4, c.store_name].every(isStrOrNull)
    || !Number.isInteger(c.sync_interval_seconds) || !Number.isInteger(c.log_retention_days)) {
    return { ok: false, reason: "Estrutura do backup inválida." };
  }
  if (!c.base_url?.startsWith("https://") || !c.installation_id || !UUID.test(c.installation_id) || !c.token_encrypted) {
    return { ok: false, reason: "O backup não contém uma instalação completa (URL, ID e token)." };
  }
  if (b.key_fingerprint !== await keyFingerprint(secret)) {
    return { ok: false, reason: "Este backup foi criado com outra chave de criptografia e não pode ser restaurado aqui." };
  }
  if (b.integrity !== await hmac(secret, canonical(b))) return { ok: false, reason: "O backup foi alterado ou está corrompido." };
  return { ok: true, backup: b };
}

/** Fields cleared when preparing for a new identity. license_status is kept: the Master sets it on the first sync,
 * so a suspended store is never unlocked just by clearing the identity. */
export const PREPARE_RESET = {
  installation_id: null, token_encrypted: null, token_last4: null, store_name: null,
  status: "disconnected", last_verify_at: null, last_heartbeat_at: null, last_sync_at: null,
  last_commands_at: null, last_report_at: null, last_sync_error_at: null, last_error: null, sync_lock_until: null,
} as const;
