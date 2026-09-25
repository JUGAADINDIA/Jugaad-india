import { createClient } from "@supabase/supabase-js";

const providerRoles = ["provider", "worker", "service_provider"];
const MAX_MATCHES = 5;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function scoreProvider(provider: any, request: any) {
  let score = 0;
  if (provider.is_active !== false) score += 50;
  if (provider.is_verified) score += 20;
  score += Math.min(20, Number(provider.rating || 0) * 4);
  score += Math.min(10, Number(provider.completed_job || 0));

  const haystack = [
    provider.service_area,
    provider.preferred_address,
    provider.full_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const location = clean(request.location).toLowerCase();

  if (location && haystack && haystack.includes(location)) score += 30;
  if (location) {
    const parts = location.split(/[ ,]+/).filter((x) => x.length >= 3);
    if (parts.some((part) => haystack.includes(part))) score += 10;
  }

  return score;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: "Supabase server environment variables missing.",
    });
  }

  const authHeader = String(req.headers?.authorization || "");
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return res.status(401).json({ error: "Login session missing." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: "Invalid login session." });
  }

  const { requestId, category, service, location } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ error: "requestId required." });
  }

  const { data: request, error: requestError } = await admin
    .from("requests")
    .select("id,user_id,need,category,location,status")
    .eq("id", requestId)
    .eq("user_id", authData.user.id)
    .single();

  if (requestError || !request) {
    return res.status(404).json({ error: "Request nahi mili." });
  }

  const { data: existingMatches } = await admin
    .from("matches")
    .select("provider_id,worker_id")
    .eq("request_id", requestId);

  const alreadyMatched = new Set(
    (existingMatches || [])
      .map((m: any) => m.provider_id || m.worker_id)
      .filter(Boolean)
  );

  const { data: providers, error: providerError } = await admin
    .from("profiles")
    .select("id,full_name,role,preferred_address,service_area,is_verified,is_active,rating,completed_job")
    .in("role", providerRoles)
    .neq("id", authData.user.id)
    .limit(100);

  if (providerError) {
    return res.status(500).json({ error: providerError.message });
  }

  const requestForScoring = {
    ...request,
    category: clean(category) || request.category,
    service: clean(service),
    location: clean(location) || request.location,
  };

  const ranked = (providers || [])
    .filter((p: any) => p.is_active !== false && !alreadyMatched.has(p.id))
    .map((provider: any) => ({
      provider,
      score: scoreProvider(provider, requestForScoring),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES);

  if (!ranked.length) {
    return res.status(200).json({ matched_count: 0, providers: [] });
  }

  const rows = ranked.map(({ provider }) => ({
    request_id: requestId,
    provider_id: provider.id,
    worker_id: provider.id,
    status: "pending",
    matches_status: "pending",
  }));

  const { error: matchError } = await admin.from("matches").insert(rows);
  if (matchError) {
    // A duplicate can happen if two calls race. In that case, return the already-created state.
    if (!/duplicate|unique/i.test(matchError.message)) {
      return res.status(500).json({ error: matchError.message });
    }
  }

  // Notifications are best-effort; matching should not fail if notification RLS/schema differs.
  const notificationRows = ranked.map(({ provider }) => ({
    user_id: provider.id,
    title: "🛵 Naya JUGAAD kaam",
    message: `Customer ko ${clean(service) || clean(category) || "help"} chahiye: ${clean(request.need).slice(0, 140)}`,
    type: "new_request",
    request_id: requestId,
    is_read: false,
  }));
  if (notificationRows.length) {
    await admin.from("notifications").insert(notificationRows);
  }

  return res.status(200).json({
    matched_count: ranked.length,
    providers: ranked.map(({ provider }) => ({
      id: provider.id,
      name: provider.full_name || "JUGAAD Provider",
    })),
  });
}

