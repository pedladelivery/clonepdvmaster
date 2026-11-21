import { z } from "npm:zod@3";
import {
  corsHeaders, json, serviceClient, hashPassword, verifyPassword,
  randomToken, sha256Hex, logEvent, requireSession,
} from "../_shared/master.ts";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const SESSION_HOURS = 8;
// Used to keep response time similar when the username does not exist.
const DUMMY_HASH = "pbkdf2$150000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

const LoginSchema = z.object({
  action: z.literal("login"),
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});
const ChangeSchema = z.object({
  action: z.literal("change_password"),
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(10).max(200),
});
const EmailSchema = z.object({
  action: z.literal("change_email"),
  current_password: z.string().min(1).max(200),
  new_email: z.string().trim().toLowerCase().email("Informe um e-mail válido").max(254),
});
const SimpleSchema = z.object({ action: z.enum(["session", "logout", "revoke_all"]) });

function strongEnough(pw: string) {
  return /[A-Za-z]/.test(pw) && /\d/.test(pw) && pw.length >= 10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const db = serviceClient();
    const body = await req.json().catch(() => ({}));
    const action = (body as { action?: string })?.action;

    if (action === "login") {
      const parsed = LoginSchema.safeParse(body);
      if (!parsed.success) return json({ error: "Informe usuário e senha" }, 400);
      const username = parsed.data.username.toLowerCase();

      // First access: create the account from the protected initial credentials.
      const { count } = await db.from("master_users").select("id", { count: "exact", head: true });
      if (!count) {
        const initialUser = Deno.env.get("MASTER_INITIAL_USER")?.trim().toLowerCase();
        const initialPass = Deno.env.get("MASTER_INITIAL_PASSWORD");
        if (!initialUser || !initialPass) {
          return json({ error: "As credenciais iniciais da área Master ainda não foram configuradas." }, 503);
        }
        await db.from("master_users").insert({
          username: initialUser,
          password_hash: await hashPassword(initialPass),
          must_change_password: true,
        });
      }

      const { data: user } = await db
        .from("master_users")
        .select("id, username, password_hash, must_change_password, failed_attempts, locked_until")
        .eq("username", username)
        .maybeSingle();

      if (user?.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        const minutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
        return json({ error: `Muitas tentativas. Tente novamente em ${minutes} minuto(s).` }, 429);
      }

      const ok = await verifyPassword(parsed.data.password, user?.password_hash ?? DUMMY_HASH);
      if (!user || !ok) {
        if (user) {
          const attempts = (user.failed_attempts ?? 0) + 1;
          const lock = attempts >= MAX_ATTEMPTS;
          await db.from("master_users").update({
            failed_attempts: lock ? 0 : attempts,
            locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
          }).eq("id", user.id);
          if (lock) await logEvent(db, "auth_lock", "Login da área Master bloqueado por tentativas repetidas", { username });
        }
        await logEvent(db, "auth_failure", "Tentativa de login inválida na área Master", { username });
        return json({ error: "Usuário ou senha incorretos" }, 401);
      }

      const token = randomToken();
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString();
      await db.from("master_sessions").insert({
        master_user_id: user.id,
        token_hash: await sha256Hex(token),
        expires_at: expiresAt,
        user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      });
      await db.from("master_users").update({
        failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString(),
      }).eq("id", user.id);
      await logEvent(db, "auth_login", "Login na área Master", { username: user.username });

      return json({
        token,
        expires_at: expiresAt,
        username: user.username,
        must_change_password: user.must_change_password,
      });
    }

    const session = await requireSession(db, req);
    if (!session) return json({ error: "Sessão expirada. Entre novamente." }, 401);

    if (action === "change_password") {
      const parsed = ChangeSchema.safeParse(body);
      if (!parsed.success || !strongEnough(parsed.data.new_password)) {
        return json({ error: "A nova senha precisa ter pelo menos 10 caracteres, com letras e números." }, 400);
      }
      const { current_password, new_password } = parsed.data;
      if (current_password === new_password || new_password === Deno.env.get("MASTER_INITIAL_PASSWORD")) {
        return json({ error: "Escolha uma senha diferente da atual e da senha inicial." }, 400);
      }
      const { data: user } = await db.from("master_users").select("password_hash").eq("id", session.userId).single();
      if (!user || !(await verifyPassword(current_password, user.password_hash))) {
        return json({ error: "Senha atual incorreta" }, 401);
      }
      await db.from("master_users").update({
        password_hash: await hashPassword(new_password),
        must_change_password: false,
      }).eq("id", session.userId);
      // End every other session after a password change.
      await db.from("master_sessions").update({ revoked_at: new Date().toISOString() })
        .eq("master_user_id", session.userId).is("revoked_at", null).neq("id", session.sessionId);
      await logEvent(db, "auth_password", "Senha da área Master alterada", { username: session.username });
      return json({ success: true });
    }

    if (action === "change_email") {
      const parsed = EmailSchema.safeParse(body);
      if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, 400);
      const { current_password, new_email } = parsed.data;
      if (new_email === session.username) return json({ error: "Este já é o e-mail de acesso atual." }, 400);
      const { data: user } = await db.from("master_users").select("password_hash").eq("id", session.userId).single();
      if (!user || !(await verifyPassword(current_password, user.password_hash))) {
        return json({ error: "Senha atual incorreta" }, 401);
      }
      const { data: taken } = await db.from("master_users").select("id").eq("username", new_email).maybeSingle();
      if (taken) return json({ error: "Este e-mail já está em uso." }, 409);
      const { error } = await db.from("master_users").update({ username: new_email }).eq("id", session.userId);
      if (error) throw error;
      // End every other session after the login e-mail changes.
      await db.from("master_sessions").update({ revoked_at: new Date().toISOString() })
        .eq("master_user_id", session.userId).is("revoked_at", null).neq("id", session.sessionId);
      await logEvent(db, "auth_email", "E-mail de acesso da área Master alterado", { from: session.username, to: new_email });
      return json({ success: true, username: new_email });
    }

    const simple = SimpleSchema.safeParse(body);
    if (!simple.success) return json({ error: "Ação inválida" }, 400);

    if (simple.data.action === "session") {
      return json({
        username: session.username,
        must_change_password: session.mustChangePassword,
        expires_at: session.expiresAt,
      });
    }

    if (simple.data.action === "logout") {
      await db.from("master_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.sessionId);
      return json({ success: true });
    }

    // revoke_all
    const { data: revoked } = await db.from("master_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .is("revoked_at", null)
      .select("id");
    await logEvent(db, "auth_sessions", "Todas as sessões da área Master foram encerradas", {
      username: session.username, count: revoked?.length ?? 0,
    });
    return json({ success: true, count: revoked?.length ?? 0 });
  } catch (err) {
    console.error("master-auth error", err instanceof Error ? err.message : err);
    return json({ error: "Erro interno na área Master" }, 500);
  }
});
