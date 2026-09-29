import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_URL = "https://api.openai.com/v1";

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body);
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function transcribeAudio(dataUrl: string, apiKey: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid audio data");
  }

  const mime = match[1] || "audio/webm";
  const bytes = Buffer.from(match[2], "base64");

  const ext = mime.includes("mp4")
    ? "m4a"
    : mime.includes("ogg")
      ? "ogg"
      : "webm";

  const form = new FormData();

  form.append(
    "file",
    new Blob([bytes], { type: mime }),
    `jugaad.${ext}`
  );

  form.append(
    "model",
    process.env.OPENAI_TRANSCRIBE_MODEL ||
      "gpt-4o-mini-transcribe"
  );

  form.append("language", "hi");

  const response = await fetch(
    `${OPENAI_URL}/audio/transcriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "Audio transcription failed"
    );
  }

  return String(data?.text || "").trim();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return json(res, 405, {
      error: "Method not allowed",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return json(res, 500, {
      error:
        "OPENAI_API_KEY is not configured",
    });
  }

  try {
    const {
      text = "",
      imageDataUrl = "",
      audioDataUrl = "",
    } = req.body || {};

    let spokenText = "";

    /*
     * 🎙️ VOICE
     */
    if (audioDataUrl) {
      spokenText = await transcribeAudio(
        String(audioDataUrl),
        apiKey
      );
    }

    /*
     * Text + voice ko combine karo
     */
    const combinedText = [
      String(text).trim(),
      spokenText,
    ]
      .filter(Boolean)
      .join("\n");

    if (!combinedText && !imageDataUrl) {
      return json(res, 400, {
        error:
          "Text, voice or photo is required",
      });
    }

    /*
     * 🤖 JUGAAD AI PROMPT
     */
    const content: any[] = [
      {
        type: "input_text",
        text: `
You are JUGAAD India, an Indian real-world
service/help request understanding assistant.

Your job is to understand what a customer
actually needs.

The customer may speak or write in:

- Hindi
- Hinglish
- English
- Indian local/common phrases

Understand the actual requirement.

Do NOT invent facts.

If the request appears illegal or dangerous,
do not provide instructions for illegal activity.
Instead explain the concern in safety_note.

Return ONLY valid JSON.

Use exactly these fields:

{
  "need": "short customer-friendly requirement",
  "problem": "what is wrong or needed",
  "category": "Home | Repair | Delivery | Personal | Business | Education | Travel | Digital | Other",
  "suggested_service": "best service/provider type",
  "confidence": 0.0,
  "safety_note": "",
  "next_step": "",
  "solution": ""
}

Rules:

1. confidence must be between 0 and 1.

2. Do not invent the customer's location.

3. Do not invent a price.

4. Do not invent a provider.

5. If the requirement is unclear,
   keep confidence low.

6. If a photo is provided, use the photo
   to understand the visible problem.

7. If voice is provided, use its transcript.

8. Keep "need" short and understandable.

9. "suggested_service" should describe
   the type of provider needed.

10. JUGAAD India is NOT an e-commerce
    marketplace. It connects real-world
    customer needs with suitable help/service.

Customer input:

${combinedText || "(No text; inspect the photo.)"}
`,
      },
    ];

    /*
     * 📸 PHOTO
     */
    if (imageDataUrl) {
      content.push({
        type: "input_image",
        image_url: String(imageDataUrl),
      });
    }

    /*
     * 🤖 OPENAI
     */
    const response = await fetch(
      `${OPENAI_URL}/responses`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model:
            process.env.OPENAI_ANALYZE_MODEL ||
            "gpt-5.6-luna",

          input: [
            {
              role: "user",
              content,
            },
          ],

          max_output_tokens: 500,
        }),
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      return json(res, response.status, {
        error:
          data?.error?.message ||
          "OpenAI analysis failed",
      });
    }

    /*
     * OpenAI response se text nikalo
     */
    const outputText =
      String(
        data?.output_text || ""
      ).trim() ||
      (Array.isArray(data?.output)
        ? data.output
            .flatMap(
              (item: any) =>
                item?.content || []
            )
            .map(
              (item: any) =>
                item?.text || ""
            )
            .join("")
        : "");

    if (!outputText) {
      return json(res, 502, {
        error:
          "AI returned an empty response",
      });
    }

    /*
     * JSON parse
     */
    let result: any;

    try {
      result = JSON.parse(
        stripCodeFence(outputText)
      );
    } catch {
      return json(res, 502, {
        error:
          "AI returned invalid JSON",
        raw: outputText.slice(0, 1000),
      });
    }

    /*
     * Confidence safety
     */
    result.confidence = Math.max(
      0,
      Math.min(
        1,
        Number(result.confidence || 0)
      )
    );

    /*
     * Default values
     */
    result.need =
      String(result.need || "").trim();

    result.problem =
      String(result.problem || "").trim();

    result.category =
      String(result.category || "Other").trim();

    result.suggested_service =
      String(
        result.suggested_service || ""
      ).trim();

    result.safety_note =
      String(
        result.safety_note || ""
      ).trim();

    result.next_step =
      String(
        result.next_step || ""
      ).trim();

    result.solution =
      String(
        result.solution || ""
      ).trim();

    /*
     * 🎯 FINAL RESPONSE
     */
    return json(res, 200, {
      result,

      /*
       * Voice use hua tha to transcript bhi
       * frontend ko milega.
       */
      transcript:
        spokenText || undefined,
    });
  } catch (error: any) {
    console.error(
      "JUGAAD analyze-need:",
      error
    );

    return json(res, 500, {
      error:
        error?.message ||
        "AI analysis failed",
    });
  }
}
