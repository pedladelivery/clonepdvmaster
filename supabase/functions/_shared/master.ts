import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-master-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("server_misconfigured");
  return createClient(url, key, { auth: { persistSession: false } });
}

const enc = new TextEncoder();

export function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
export function unb64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64url(bytes: Uint8Array): string {
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
  return Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const PBKDF2_ITERATIONS = 150_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !hash) return false;
  const computed = await pbkdf2(password, unb64(salt), Number(iter));
  return timingSafeEqual(computed, unb64(hash));
}

async function aesKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("MASTER_ENCRYPTION_KEY");
  if (!secret) throw new Error("encryption_key_missing");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), enc.encode(plain)));
  return `${b64(iv)}:${b64(ct)}`;
}

export async function decryptSecret(stored: string): Promise<string> {
  const [iv, ct] = stored.split(":");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(), unb64(ct));
  return new TextDecoder().decode(plain);
}

export async function logEvent(
  db: SupabaseClient,
  kind: string,
  message: string,
  details?: Record<string, unknown>,
) {
  const { error } = await db.from("master_events").insert({ kind, message, details: details ?? null });
  if (error) console.error("master_events insert failed", error.message);
}

export interface MasterSession {
  sessionId: string;
  userId: string;
  username: string;
  mustChangePassword: boolean;
  expiresAt: string;
}

/** Validates the x-master-session header against stored (hashed) sessions. */
export async function requireSession(db: SupabaseClient, req: Request): Promise<MasterSession | null> {
  const token = req.headers.get("x-master-session")?.trim();
  if (!token || token.length < 20 || token.length > 200) return null;
  const tokenHash = await sha256Hex(token);
  const { data } = await db
    .from("master_sessions")
    .select("id, expires_at, revoked_at, master_user_id, master_users(username, must_change_password)")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  const user = (data as any).master_users;
  if (!user) return null;
  return {
    sessionId: data.id,
    userId: data.master_user_id,
    username: user.username,
    mustChangePassword: Boolean(user.must_change_password),
    expiresAt: data.expires_at,
  };
}

// ---------------------------------------------------------------------------
// Painel Master HTTP client. Only endpoints from the approved contract may be
// called. The token is decrypted server-side and never logged or returned.

const SECRET_KEY = /token|secret|password|senha|authorization|api[_-]?key/i;

/** Removes anything that looks like a credential and caps size before logging/returning. */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "[oculto]" : sanitize(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 500) return value.slice(0, 500) + "…";
  return value;
}

export interface MasterReply {
  ok: boolean;
  status: number;
  data: unknown;
  message: string | null;
}

export interface IntegrationCreds {
  baseUrl: string;
  installationId: string;
  token: string;
}

export async function loadCredentials(db: SupabaseClient): Promise<IntegrationCreds | null> {
  const { data } = await db.from("master_integration")
    .select("base_url, installation_id, token_encrypted").eq("id", 1).maybeSingle();
  if (!data?.base_url || !data?.installation_id || !data?.token_encrypted) return null;
  return {
    baseUrl: String(data.base_url).replace(/\/+$/, ""),
    installationId: String(data.installation_id),
    token: await decryptSecret(data.token_encrypted),
  };
}

/** Route prefix the Painel Master publishes for the PDV Salão product. */
export const PDV_API_PREFIX = "/api/public/master/pdv/v1";
/** Product header the PDV Salão routes require. */
export const PDV_PRODUCT_HEADERS = { "X-Product": "pdv_salao" };

/** `path` may contain `{id}`, replaced by the installation id. */
export async function masterRequest(
  creds: IntegrationCreds,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<MasterReply> {
  // Avoid doubling the PDV prefix if it was saved as part of the base URL.
  const base = path.startsWith(PDV_API_PREFIX) && creds.baseUrl.endsWith(PDV_API_PREFIX)
    ? creds.baseUrl.slice(0, -PDV_API_PREFIX.length)
    : creds.baseUrl;
  const url = base + path.replace("{id}", encodeURIComponent(creds.installationId));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.token}`,
    "X-Installation-Id": creds.installationId,
    Accept: "application/json",
    ...extraHeaders,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
    const data = isJson ? await res.json().catch(() => null) : null;
    if (!isJson) await res.body?.cancel();
    const d = data as Record<string, unknown> | null;
    const message = !isJson
      ? `O Painel Master não respondeu como API neste endereço (HTTP ${res.status}). O serviço pode não estar publicado.`
      : typeof d?.message === "string" ? d.message : typeof d?.error === "string" ? d.error : null;
    const flaggedFail = d?.ok === false || d?.success === false || d?.valid === false;
    return { ok: res.ok && isJson && !flaggedFail, status: res.status, data: sanitize(data), message };
  } catch (err) {
    const timeout = err instanceof DOMException && err.name === "TimeoutError";
    return {
      ok: false,
      status: 0,
      data: null,
      message: timeout ? "O Painel Master não respondeu a tempo." : "Não foi possível alcançar o Painel Master.",
    };
  }
}
