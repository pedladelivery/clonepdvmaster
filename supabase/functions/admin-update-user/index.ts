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
      return json({ error: "Sessão inválida ou expirada. Saia e entre novamente no sistema." }, 401);
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", claimsData.claims.sub)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return json({ error: "Apenas administradores podem alterar dados de acesso" }, 403);
    }

    // Painel Master: a suspended license refuses every operation (it prevails over the admin lock).
    if (await isLicenseSuspended(adminClient)) return json(licenseSuspendedBody(), 403);

    const lockMessage = await adminLockMessage(adminClient);
    if (lockMessage) return json({ error: lockMessage }, 423);

    const body = await req.json().catch(() => ({}));
    const { action, user_id, email, password } = body as {
      action?: string;
      user_id?: string;
      email?: string;
      password?: string;
    };

    if (action === "list_emails") {
      const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) {
        console.error("list users error", error);
        return json({ error: "Não foi possível carregar os e-mails" }, 500);
      }
      const emails: Record<string, string> = {};
      for (const u of data.users) {
        if (u.email) emails[u.id] = u.email;
      }
      return json({ success: true, emails });
    }

    if (!user_id) return json({ error: "Usuário não informado" }, 400);
    if (!email && !password) return json({ error: "Informe um novo e-mail ou uma nova senha" }, 400);

    const payload: { email?: string; password?: string; email_confirm?: boolean } = {};

    if (email) {
      const normalized = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
        return json({ error: "E-mail inválido" }, 400);
      }
      const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listErr) {
        console.error("list users error", listErr);
        return json({ error: "Não foi possível validar o e-mail" }, 500);
      }
      const conflict = list.users.find(
        (u) => u.email?.toLowerCase() === normalized && u.id !== user_id,
      );
      if (conflict) return json({ error: "Este e-mail já está em uso por outro usuário" }, 400);
      payload.email = normalized;
      payload.email_confirm = true;
    }

    if (password) {
      if (password.length < 6) {
        return json({ error: "A senha deve ter ao menos 6 caracteres" }, 400);
      }
      payload.password = password;
    }

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, payload);
    if (updateErr) {
      console.error("update user error", updateErr);
      return json({ error: updateErr.message || "Falha ao atualizar dados de acesso" }, 400);
    }

    return json({ success: true });
  } catch (e) {
    console.error("admin-update-user unhandled", e);
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
