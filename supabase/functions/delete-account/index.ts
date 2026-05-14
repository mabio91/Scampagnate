import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONFIRMATION_PHRASE = "CANCELLA IL MIO ACCOUNT";
const userOwnedTables = [
  "discount_code_usage",
  "ios_device_tokens",
  "notifications",
  "onesignal_players",
  "phone_otps",
  "points_history",
  "push_subscriptions",
  "saved_events",
  "user_badges",
  "user_consents",
  "user_mission_history",
  "user_mission_progress",
  "user_missions",
  "user_rewards",
  "user_roles",
];

type DeleteBody = {
  dry_run?: boolean;
  confirmation?: string;
  user_id?: string;
  target_user_id?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const readBody = async (req: Request): Promise<DeleteBody> => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, deleted: false, error: "Metodo non consentito" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, deleted: false, error: "Configurazione Supabase mancante" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return json({ success: false, deleted: false, error: "Utente non autenticato" }, 401);
  }

  const supabaseClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader ?? "" } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const body = await readBody(req);
  const dryRun = body.dry_run === true;

  try {
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) {
      return json({ success: false, deleted: false, dry_run: dryRun, error: "Utente non autenticato" }, 401);
    }

    const requestedUserId = body.user_id ?? body.target_user_id;
    if (requestedUserId && requestedUserId !== user.id) {
      return json({ success: false, deleted: false, dry_run: dryRun, error: "Non puoi cancellare un altro account" }, 403);
    }

    if (!dryRun && body.confirmation !== CONFIRMATION_PHRASE) {
      return json({ success: false, deleted: false, dry_run: false, error: "Conferma cancellazione non valida" }, 400);
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesError) throw rolesError;

    const roleNames = (roles ?? []).map((row) => row.role);
    if (roleNames.some((role) => role === "admin" || role === "organizer")) {
      return json(
        {
          success: false,
          deleted: false,
          dry_run: dryRun,
          error: "Gli account admin o organizer devono essere gestiti dal backend.",
        },
        403,
      );
    }

    const countRows = async (table: string, column: string) => {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(column, user.id);
      if (error) throw error;
      return count ?? 0;
    };

    const summary: Record<string, number> = {};
    for (const table of userOwnedTables) {
      summary[table] = await countRows(table, "user_id");
    }
    summary.profiles = await countRows("profiles", "id");
    summary.event_registrations = await countRows("event_registrations", "user_id");
    summary.activity_proposals = await countRows("activity_proposals", "proposer_id");
    summary.issues_reported = await countRows("issues", "reporter_id");
    summary.email_send_log = await countRows("email_send_log", "user_id");
    summary.admin_action_log_user = await countRows("admin_action_log", "user_id");
    summary.discount_codes_assigned = await countRows("discount_codes", "assigned_user_id");
    summary.organized_events = await countRows("events", "organizer_id");

    if (summary.organized_events > 0) {
      return json(
        {
          success: false,
          deleted: false,
          dry_run: true,
          error: "Questo account risulta collegato come organizer di eventi. Serve gestione backend.",
          summary,
        },
        409,
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const { data: avatarObjects, error: avatarListError } = await supabaseAdmin.storage
      .from("avatars")
      .list(user.id, { limit: 100 });
    if (avatarListError) throw avatarListError;

    const avatarPaths = (avatarObjects ?? []).map((object) => `${user.id}/${object.name}`);

    if (dryRun) {
      return json({
        success: true,
        deleted: false,
        dry_run: true,
        confirmation_required: CONFIRMATION_PHRASE,
        user_id: user.id,
        email: user.email,
        summary,
        avatar_paths: avatarPaths,
      });
    }

    const { error: anonymizeProfileError } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: "Utente",
        last_name: "Eliminato",
        phone: "",
        avatar_url: null,
        bio: null,
        preferences: [],
        trekking_experience: null,
        activity_frequency: null,
        experience_grade: null,
        self_level: null,
        has_car: null,
        interests: [],
        event_motivation: null,
        email: null,
        phone_verified: false,
        phone_verified_at: null,
        phone_verification_method: null,
        birth_date: null,
        birth_place: null,
        province_of_birth: null,
        residential_address: null,
        city_of_residence: null,
        province_of_residence: null,
        membership_status: "Inactive",
        account_status: "Suspended",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (anonymizeProfileError) throw anonymizeProfileError;

    const { error: proposalError } = await supabaseAdmin
      .from("activity_proposals")
      .update({ proposer_name: "Utente eliminato" })
      .eq("proposer_id", user.id);
    if (proposalError) throw proposalError;

    const { error: issuesError } = await supabaseAdmin
      .from("issues")
      .update({ reporter_name: "Utente eliminato" })
      .eq("reporter_id", user.id);
    if (issuesError) throw issuesError;

    const { error: emailLogError } = await supabaseAdmin
      .from("email_send_log")
      .update({ recipient_email: `deleted-user-${user.id}@deleted.local` })
      .eq("user_id", user.id);
    if (emailLogError) throw emailLogError;

    const { error: discountCodeError } = await supabaseAdmin
      .from("discount_codes")
      .update({ assigned_user_id: null })
      .eq("assigned_user_id", user.id);
    if (discountCodeError) throw discountCodeError;

    const { error: adminLogError } = await supabaseAdmin
      .from("admin_action_log")
      .update({ details: { account_deleted: true } })
      .eq("user_id", user.id);
    if (adminLogError) throw adminLogError;

    if (avatarPaths.length > 0) {
      const { error: removeAvatarError } = await supabaseAdmin.storage.from("avatars").remove(avatarPaths);
      if (removeAvatarError) throw removeAvatarError;
    } else if (typeof profile?.avatar_url === "string" && profile.avatar_url.includes(`/avatars/${user.id}/`)) {
      const path = profile.avatar_url.split("/avatars/")[1]?.split("?")[0];
      if (path) {
        const { error: removeAvatarError } = await supabaseAdmin.storage.from("avatars").remove([path]);
        if (removeAvatarError) throw removeAvatarError;
      }
    }

    for (const table of userOwnedTables) {
      const { error } = await supabaseAdmin.from(table).delete().eq("user_id", user.id);
      if (error) throw error;
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (authDeleteError) throw authDeleteError;

    return json({ success: true, deleted: true, dry_run: false, summary });
  } catch (error) {
    console.error("Delete account error:", error);
    const message = error instanceof Error ? error.message : "Errore durante la cancellazione account";
    return json({ success: false, deleted: false, dry_run: dryRun, error: message }, 500);
  }
});
