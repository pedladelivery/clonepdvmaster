import { createClient } from "npm:@supabase/supabase-js@2";
import { isLicenseSuspended, licenseSuspendedBody } from "../_shared/license.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
      console.error("Missing Supabase environment variables");
      return json({ error: "Configuração do servidor incompleta" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Sessão não enviada. Saia e entre novamente no sistema." }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);

    if (claimsErr || !claimsData?.claims?.sub) {
      console.error("getClaims error", claimsErr);
      return json({ error: "Sessão inválida ou expirada. Saia e entre novamente no sistema." }, 401);
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", claimsData.claims.sub)
      .maybeSingle();

    if (profileErr) console.error("profile lookup error", profileErr);
    if (profile?.role !== "admin") {
      return json({ error: "Apenas administradores podem criar usuários" }, 403);
    }

    // Painel Master: a suspended license refuses every operation (it prevails over the admin lock).
    if (await isLicenseSuspended(adminClient)) return json(licenseSuspendedBody(), 403);

    const lockMessage = await adminLockMessage(adminClient);
    if (lockMessage) return json({ error: lockMessage }, 423);

    const body = await req.json().catch(() => ({}));
    const { email, password, full_name, role, permissions, store_id } = body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: string;
      permissions?: Record<string, boolean>;
      store_id?: string | null;
    };

    if (!email || !password) {
      return json({ error: "Email e senha são obrigatórios" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Senha deve ter ao menos 6 caracteres" }, 400);
    }
    const normalizedEmail = email.trim().toLowerCase();
    const VALID_ROLES = new Set(["admin", "manager", "cashier", "operator"]);
    const finalRole = VALID_ROLES.has(String(role)) ? String(role) : "operator";
    // Super admin (admin) has no fixed store; every other role must belong to one store
    const finalStoreId = finalRole === "admin" ? (store_id || null) : (store_id || null);
    if (finalRole !== "admin" && !finalStoreId) {
      return json({ error: "Selecione a loja do usuário" }, 400);
    }

    // Sanitize permissions to a known shape (snake_case keys, booleans)
    const ALLOWED = new Set([
      "catalog","customers","suppliers","sellers","pending_sales",
      "sales","returns","stock","financial","reports","settings","subscription",
    ]);
    const cleanPerms: Record<string, boolean> = {};
    if (permissions && typeof permissions === "object") {
      for (const [k, v] of Object.entries(permissions)) {
        const key = k.replace(/-/g, "_");
        if (ALLOWED.has(key)) cleanPerms[key] = Boolean(v);
      }
    }
    // Admins ignore permissions map (they have full access via role)
    const permsForDb = finalRole === "admin"
      ? { catalog: true, customers: true, suppliers: true, sellers: true, pending_sales: true, sales: true, returns: true, stock: true, financial: true, reports: true, settings: true, subscription: true }
      : (Object.keys(cleanPerms).length ? cleanPerms : { sales: true, pending_sales: true });

    let targetUserId: string | null = null;
    const { data: created, error: createErr } = await adminClient.auth.admin
      .createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "Usuário" },
      });

    if (created.user) {
      targetUserId = created.user.id;
    }

    if (createErr) {
      console.error("auth create user error", createErr);

      const alreadyExists = createErr.message?.toLowerCase().includes("already")
        || createErr.message?.toLowerCase().includes("registered");

      if (!alreadyExists) {
        return json({ error: createErr.message ?? "Falha ao criar usuário" }, 400);
      }

      const { data: existingUsers, error: listErr } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listErr) {
        console.error("list users error", listErr);
        return json({ error: "Este email já existe, mas não foi possível validar o cadastro" }, 400);
      }

      const existingUser = existingUsers.users.find(
        (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
      );
      if (!existingUser) {
        return json({ error: "Este email já está cadastrado. Use outro email." }, 400);
      }

      const { data: existingProfile, error: existingProfileErr } = await adminClient
        .from("profiles")
        .select("id")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingProfileErr) console.error("existing profile lookup error", existingProfileErr);
      if (existingProfile) {
        return json({ error: "Este email já está cadastrado. Edite o usuário existente ou use outro email." }, 400);
      }

      targetUserId = existingUser.id;
    }

    if (!targetUserId) return json({ error: "Falha ao identificar o usuário criado" }, 500);

    const { error: profileSaveErr } = await adminClient
      .from("profiles")
      .upsert({
        user_id: targetUserId,
        full_name: full_name?.trim() || "Usuário",
        role: finalRole,
        permissions: permsForDb,
        store_id: finalStoreId,
      }, { onConflict: "user_id" });

    if (profileSaveErr) {
      console.error("profile save error", profileSaveErr);
      if (created.user) {
        await adminClient.auth.admin.deleteUser(created.user.id).catch((deleteErr) => {
          console.error("rollback delete user error", deleteErr);
        });
      }
      return json({ error: profileSaveErr.message || "Usuário criado no Auth, mas falhou ao salvar permissões" }, 500);
    }

    return json({ success: true, user_id: targetUserId });
  } catch (e) {
    console.error("create-admin-user unhandled", e);
    return json({ error: (e as Error).message ?? "Erro interno" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Painel Master: while the admin control is blocked, administrative changes are refused.
async function adminLockMessage(client: any): Promise<string | null> {
  const { data } = await client.from("pdv_controls").select("blocked, message").eq("key", "admin").maybeSingle();
  if (!data?.blocked) return null;
  const extra = (data.message ?? "").trim();
  return "O acesso administrativo está bloqueado pelo Painel Master." + (extra ? ` ${extra}` : "");
}
