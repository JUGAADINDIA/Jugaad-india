import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID;

const RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET;

const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET;

function send(
  res: VercelResponse,
  status: number,
  body: unknown
) {
  return res.status(status).json(body);
}

/*
 * Razorpay webhook signature
 *
 * IMPORTANT:
 * Signature must be calculated from
 * the ORIGINAL raw request body.
 */
function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string,
  secret: string
) {
  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(rawBody)
      .digest("hex");

  const expected =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  const received =
    Buffer.from(
      receivedSignature,
      "utf8"
    );

  if (
    expected.length !==
    received.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expected,
    received
  );
}

/*
 * Vercel request body ko raw form mein
 * lene ki koshish.
 *
 * Agar rawBody already available hai,
 * wahi use hoga.
 */
function getRawBody(
  req: VercelRequest
): string {
  const requestWithRaw =
    req as VercelRequest & {
      rawBody?: string | Buffer;
    };

  if (
    typeof requestWithRaw.rawBody ===
    "string"
  ) {
    return requestWithRaw.rawBody;
  }

  if (
    Buffer.isBuffer(
      requestWithRaw.rawBody
    )
  ) {
    return requestWithRaw.rawBody.toString(
      "utf8"
    );
  }

  /*
   * Some Vercel runtimes expose the
   * body as a Buffer/string.
   */
  if (
    typeof req.body === "string"
  ) {
    return req.body;
  }

  if (
    Buffer.isBuffer(req.body)
  ) {
    return req.body.toString(
      "utf8"
    );
  }

  /*
   * Last fallback.
   *
   * NOTE:
   * Production webhook signature should
   * ideally always use the original body.
   */
  if (req.body) {
    return JSON.stringify(
      req.body
    );
  }

  return "";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  /*
   * Only POST
   */
  if (req.method !== "POST") {
    return send(res, 405, {
      error:
        "Method not allowed",
    });
  }

  /*
   * Environment validation
   */
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error(
      "Supabase webhook configuration missing"
    );

    return send(res, 500, {
      error:
        "Supabase server configuration missing",
    });
  }

  if (
    !RAZORPAY_KEY_ID ||
    !RAZORPAY_KEY_SECRET
  ) {
    console.error(
      "Razorpay API configuration missing"
    );

    return send(res, 500, {
      error:
        "Razorpay server configuration missing",
    });
  }

  if (
    !RAZORPAY_WEBHOOK_SECRET
  ) {
    console.error(
      "RAZORPAY_WEBHOOK_SECRET missing"
    );

    return send(res, 500, {
      error:
        "Razorpay webhook secret missing",
    });
  }

  /*
   * Razorpay signature
   */
  const receivedSignature =
    String(
      req.headers[
        "x-razorpay-signature"
      ] || ""
    );

  if (!receivedSignature) {
    return send(res, 400, {
      error:
        "Razorpay webhook signature missing",
    });
  }

  /*
   * Original request body
   */
  const rawBody =
    getRawBody(req);

  if (!rawBody) {
    return send(res, 400, {
      error:
        "Webhook body missing",
    });
  }

  /*
   * 🔐 HMAC verification
   */
  const validSignature =
    verifyWebhookSignature(
      rawBody,
      receivedSignature,
      RAZORPAY_WEBHOOK_SECRET
    );

  if (!validSignature) {
    console.error(
      "Invalid Razorpay webhook signature"
    );

    return send(res, 400, {
      error:
        "Invalid webhook signature",
    });
  }

  /*
   * Parse verified body
   */
  let payload: any;

  try {
    payload =
      JSON.parse(rawBody);
  } catch {
    return send(res, 400, {
      error:
        "Invalid webhook JSON",
    });
  }

  const event =
    String(
      payload?.event || ""
    );

  const paymentEntity =
    payload?.payload?.payment?.entity ||
    null;

  const orderEntity =
    payload?.payload?.order?.entity ||
    null;

  /*
   * Razorpay webhook ID.
   *
   * Razorpay may provide x-razorpay-event-id.
   * We don't make processing dependent on it,
   * but log it for traceability.
   */
  const webhookEventId =
    String(
      req.headers[
        "x-razorpay-event-id"
      ] || ""
    );

  console.log(
    "JUGAAD Razorpay webhook:",
    {
      event,
      webhookEventId,
    }
  );

  /*
   * We are mainly interested in
   * payment lifecycle events.
   *
   * Other verified events get 200 so
   * Razorpay does not repeatedly retry
   * unsupported events.
   */
  const supportedEvents = [
    "payment.captured",
    "payment.authorized",
    "payment.failed",
  ];

  if (
    !supportedEvents.includes(event)
  ) {
    return send(res, 200, {
      success: true,
      received: true,
      ignored: true,
      event,
    });
  }

  /*
   * Payment entity required
   */
  if (!paymentEntity) {
    return send(res, 400, {
      error:
        "Payment entity missing",
    });
  }

  const razorpayPaymentId =
    String(
      paymentEntity.id || ""
    );

  const razorpayOrderId =
    String(
      paymentEntity.order_id || ""
    );

  if (
    !razorpayPaymentId ||
    !razorpayOrderId
  ) {
    return send(res, 400, {
      error:
        "Razorpay payment/order ID missing",
    });
  }

  /*
   * Supabase service client
   */
  const supabaseAdmin =
    createClient(
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
     * 🔎 Find our payment using the
     * trusted Razorpay order ID.
     */
    const {
      data: payment,
      error: paymentLookupError,
    } =
      await supabaseAdmin
        .from("payments")
        .select("*")
        .eq(
          "payment_order_id",
          razorpayOrderId
        )
        .maybeSingle();

    if (paymentLookupError) {
      console.error(
        "Webhook payment lookup error:",
        paymentLookupError
      );

      return send(res, 500, {
        error:
          "Payment lookup failed",
      });
    }

    if (!payment) {
      /*
       * Webhook verified hai, but this order
       * doesn't belong to our database.
       *
       * Return 200 so Razorpay does not keep
       * retrying an unrelated/old order.
       */
      console.warn(
        "Verified Razorpay order not found in JUGAAD DB:",
        razorpayOrderId
      );

      return send(res, 200, {
        success: true,
        received: true,
        ignored: true,
        reason:
          "Order not found in JUGAAD database",
      });
    }

    /*
     * 💰 Server-side amount validation
     *
     * Razorpay amount = paise
     * JUGAAD DB amount = rupees
     */
    const gatewayAmount =
      Number(
        paymentEntity.amount
      );

    const databaseAmount =
      Math.round(
        Number(
          payment.amount || 0
        ) * 100
      );

    if (
      !Number.isFinite(
        gatewayAmount
      ) ||
      gatewayAmount !==
        databaseAmount
    ) {
      console.error(
        "Webhook amount mismatch:",
        {
          razorpayOrderId,
          razorpayPaymentId,
          gatewayAmount,
          databaseAmount,
        }
      );

      /*
       * Do NOT mark payment as paid.
       */
      return send(res, 400, {
        error:
          "Payment amount mismatch",
      });
    }

    /*
     * Currency validation
     */
    const gatewayCurrency =
      String(
        paymentEntity.currency ||
          "INR"
      ).toUpperCase();

    const databaseCurrency =
     
