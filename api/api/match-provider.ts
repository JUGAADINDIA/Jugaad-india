import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(
  res: VercelResponse,
  status: number,
  body: unknown
) {
  return res.status(status).json(body);
}

function getBearerToken(req: VercelRequest) {
  const header = req.headers.authorization || "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function textMatches(
  source: unknown,
  search: string
) {
  if (!source || !search) return false;

  const sourceText = normalize(source);
  const searchText = normalize(search);

  return (
    sourceText.includes(searchText) ||
    searchText.includes(sourceText)
  );
}

function skillMatches(
  skills: unknown,
  need: string,
  category: string
) {
  if (!skills) return false;

  const skillText = normalize(skills);

  const words = [
    ...need.split(/[\s,./-]+/),
    ...category.split(/[\s,./-]+/),
  ]
    .map((x) => normalize(x))
    .filter((x) => x.length >= 3);

  return words.some((word) =>
    skillText.includes(word)
  );
}

function serviceAreaMatches(
  serviceArea: unknown,
  location: string
) {
  if (!serviceArea || !location) return false;

  const area = normalize(serviceArea);
  const loc = normalize(location);

  const locationWords = loc
    .split(/[,|/-]+|\s+/)
    .map((x) => normalize(x))
    .filter((x) => x.length >= 3);

  return locationWords.some((word) =>
    area.includes(word)
  );
}

function isProviderAvailable(provider: any) {
  if (provider?.is_active === false) {
    return false;
  }

  if (
    provider?.available === false ||
    provider?.is_available === false
  ) {
    return false;
  }

  return true;
}

function getRating(provider: any) {
  const rating = Number(provider?.rating);

  if (!Number.isFinite(rating)) {
    return 0;
  }

  return Math.max(0, Math.min(5, rating));
}

function getVerificationScore(provider: any) {
  if (
    provider?.is_verified === true ||
    provider?.verified === true
  ) {
    return 20;
  }

  return 0;
}

function calculateScore(
  provider: any,
  need: string,
  category: string,
  location: string
) {
  let score = 0;

  /*
   * 🧠 Skill match
   */
  if (
    skillMatches(
      provider.skills,
      need,
      category
    )
  ) {
    score += 45;
  }

  /*
   * 📍 Service area
   */
  if (
    serviceAreaMatches(
      provider.service_area,
      location
    )
  ) {
    score += 20;
  }

  /*
   * ⭐ Rating
   */
  score += getRating(provider) * 4;

  /*
   * ✅ Verification
   */
  score += getVerificationScore(provider);

  /*
   * 🟢 Active/available
   */
  if (isProviderAvailable(provider)) {
    score += 10;
  }

  return Math.round(score);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return send(res, 405, {
      error: "Method not allowed",
    });
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return send(res, 500, {
      error:
        "Supabase server configuration missing",
    });
  }

  const token = getBearerToken(req);

  if (!token) {
    return send(res, 401, {
      error: "Authorization token required",
    });
  }

  const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  try {
    /*
     * 🔐 Authenticated user
     */
    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.getUser(token);

    if (
      authError ||
      !authData?.user
    ) {
      return send(res, 401, {
        error: "Invalid login session",
      });
    }

    const customerId =
      authData.user.id;

    const {
      requestId,
      need = "",
      category = "",
      location = "",
      backup = false,
