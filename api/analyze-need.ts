const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

function sendJson(res: any, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(body);
}

function extractJson(text: string) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI returned invalid JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function parseDataUrl(value: string) {
  const match = String(value || "").match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid media data");
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

async function transcribeAudio(dataUrl: string) {
  const { mime, buffer } = parseDataUrl(dataUrl);
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error("Voice recording bahut badi hai. 30 seconds ke andar dobara record karo.");
  }

  const form = new FormData();
  const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
  form.append("file", new Blob([buffer], { type: mime }), `jugaad-voice.${extension}`);
  form.append("model", TRANSCRIBE_MODEL);
  form.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    throw new Error(data?.error?.message || raw.slice(0, 180) || "Voice transcription failed");
  }
  return String(data?.text || "").trim();
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  if (!OPENAI_API_KEY) return sendJson(res, 500, { error: "OPENAI_API_KEY Vercel mein configured nahi hai." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const text = String(body.text || "").trim();
    const imageDataUrl = String(body.imageDataUrl || "");
    const audioDataUrl = String(body.audioDataUrl || "");

    // Protect the Vercel function from oversized base64 payloads.
    if (imageDataUrl.length > 3_500_000) {
      return sendJson(res, 413, { error: "Photo AI ke liye bahut badi hai. Photo dobara upload karo; app use automatically compress karegi." });
    }

    let transcript = "";
    if (audioDataUrl) transcript = await transcribeAudio(audioDataUrl);

    const combined = [text, transcript].filter(Boolean).join("\n");
    if (!combined && !imageDataUrl) {
      return sendJson(res, 400, { error: "Text, voice ya photo required hai." });
    }

    const instruction = `You are JUGAAD India AI, a practical Indian real-world service/help request assistant.
Understand Hindi, Hinglish, English and regional-language speech. A user may describe a problem or show a photo.
Identify the likely service/help needed. Do not claim a dangerous medical, electrical, gas or structural diagnosis.
Return ONLY valid JSON with exactly these keys:
need, problem, category, suggested_service, confidence, safety_note, next_step, solution.
category must be one of: Home, Repair, Delivery, Personal, Business, Sab.
confidence must be a number from 0 to 1.
If uncertain, lower confidence. Do not invent details.
The solution must be a practical, safe JUGAAD action or the appropriate professional service to contact. For a photo, use only what is visibly supported by the image; do not pretend to know hidden internal faults.

User text/transcript:
${combined || "(none)"}`;

    const content: any[] = [{ type: "input_text", text: instruction }];
    if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: "user", content }],
        text: { format: { type: "json_object" } },
      }),
    });

    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!response.ok) {
      throw new Error(data?.error?.message || raw.slice(0, 240) || "AI analysis failed");
    }

    const outputText = String(data?.output_text || "").trim();
    if (!outputText) {
      throw new Error("AI ne empty response diya. OPENAI_MODEL/API configuration check karo.");
    }
    const result = extractJson(outputText);
    result.need = String(result.need || combined || "").trim();
    result.problem = String(result.problem || result.need || "").trim();
    result.category = ["Home", "Repair", "Delivery", "Personal", "Business", "Sab"].includes(String(result.category))
      ? String(result.category)
      : "Sab";
    result.suggested_service = String(result.suggested_service || "General JUGAAD").trim();
    result.solution = String(result.solution || result.next_step || "Appropriate service/provider se JUGAAD karvao.").trim();
    result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));

    return sendJson(res, 200, { result, transcript });
  } catch (error) {
    console.error("JUGAAD AI error", error);
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "AI analysis failed",
    });
  }
}
