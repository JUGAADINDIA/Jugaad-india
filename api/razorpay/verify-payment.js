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

const RAZORPAY_API =
  "https://api.razorpay.com/v1";

function send(
  res: VercelResponse,
  status: number,
  body: unknown
) {
  return res.status(status).json(body);
}

function getBearerToken(
  req: VercelRequest
) {
  const authorization =
    req.headers.authorization || "";

  if (
    !authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return "";
  }

  return authorization
    .slice(7)
    .trim();
}

function razorpayAuth() {
  return Buffer.from(
    `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
  ).toString("base64");
}

/*
 * 🔐 Timing-safe signature comparison
 */
function safeCompare(
  expected: string,
  received: string
) {
  const expectedBuffer =
    Buffer.from(expected, "utf8");

  const receivedBuffer =
    Buffer.from(received, "utf8");

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
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

  /*
   * ⚙️ Server configuration
   */
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return send(res, 500, {
      error:
        "Supabase server configuration missing",
    });
  }

  if (
    !RAZORPAY_KEY_ID ||
    !RAZORPAY_KEY_SECRET
  ) {
    return send(res, 500, {
      error:
        "Razorpay server configuration missing",
    });
  }

  /*
   * 🔑 Login token
   */
  const token =
    getBearerToken(req);

  if (!token) {
    return send(res, 401, {
      error:
        "Authorization token required",
    });
  }

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
     * 👤 Verify logged-in user
     */
    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.getUser(
        token
      );

    if (
      authError ||
      !authData?.user
    ) {
      return send(res, 401, {
        error:
          "Invalid login session",
      });
    }

    const customerId =
      authData.user.id;

    /*
     * 💳 Razorpay checkout response
     */
    const {
      razorpay_payment_id:
        paymentId,

      razorpay_order_id:
        orderId,

      razorpay_signature:
        signature,
    } = req.body || {};

    if (
      !paymentId ||
      !orderId ||
      !signature
    ) {
      return send(res, 400, {
        error:
          "Razorpay payment details incomplete",
      });
    }

    /*
     * 🔒 Payment record database se
     * trusted order ID ke through nikalo.
     *
     * Browser se aaye order ID ko
     * blindly trust nahi kar rahe.
     */
    const {
      data: payment,
      error: paymentError,
    } =
      await supabaseAdmin
        .from("payments")
        .select("*")
        .eq(
          "payment_order_id",
          orderId
        )
        .maybeSingle();

    if (paymentError) {
      console.error(
        "Payment lookup error:",
        paymentError
      );

      return send(res, 500, {
        error:
          "Payment record check nahi ho saka",
      });
    }

    if (!payment) {
      return send(res, 404, {
        error:
          "Payment order database mein nahi mila",
      });
    }

    /*
     * 🔐 Customer ownership
     */
    if (
      payment.user_id &&
      payment.user_id !== customerId
    ) {
      return send(res, 403, {
        error:
          "Aap is payment ke owner nahi ho",
      });
    }

    /*
     * 🧾 Razorpay signature
     *
     * HMAC SHA256:
     * order_id + "|" + payment_id
     */
    const generatedSignature =
      crypto
        .createHmac(
          "sha256",
          RAZORPAY_KEY_SECRET
        )
        .update(
          `${orderId}|${paymentId}`
        )
        .digest("hex");

    const signatureValid =
      safeCompare(
        generatedSignature,
        String(signature)
      );

    if (!signatureValid) {
      console.error(
        "Invalid Razorpay signature",
        {
          orderId,
          paymentId,
        }
      );

      return send(res, 400, {
        error:
          "Payment signature verification failed",
      });
    }

    /*
     * 🛡️ Order ID database mein jo hai
     * wahi trusted source hai.
     */
    if (
      String(
        payment.payment_order_id
      ) !== String(orderId)
    ) {
      return send(res, 400, {
        error:
          "Payment order mismatch",
      });
    }

    /*
     * 🔎 Razorpay se actual payment
     * status fetch karo.
     */
    const razorpayPaymentResponse =
      await fetch(
        `${RAZORPAY_API}/payments/${encodeURIComponent(
          paymentId
        )}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Basic ${razorpayAuth()}`,
          },
        }
      );

    const razorpayPayment =
      await razorpayPaymentResponse
        .json()
        .catch(() => ({}));

    if (
      !razorpayPaymentResponse.ok
    ) {
      console.error(
        "Razorpay payment fetch error:",
        razorpayPayment
      );

      return send(res, 502, {
        error:
          razorpayPayment?.error
            ?.description ||
          "Razorpay payment status fetch nahi hua",
      });
    }

    /*
     * 💰 Amount verification
     *
     * Razorpay amount paise mein deta hai.
     */
    const gatewayAmount =
      Number(
        razorpayPayment?.amount
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
        "Payment amount mismatch:",
        {
          gatewayAmount,
          databaseAmount,
        }
      );

      return send(res, 400, {
        error:
          "Payment amount mismatch detected",
      });
    }

    /*
     * Currency verification
     */
    const gatewayCurrency =
      String(
        razorpayPayment?.currency ||
          ""
      ).toUpperCase();

    const databaseCurrency =
      String(
        payment.currency ||
          "INR"
      ).toUpperCase();

    if (
      gatewayCurrency &&
      gatewayCurrency !==
        databaseCurrency
    ) {
      return send(res, 400, {
        error:
          "Payment currency mismatch",
      });
    }

    /*
     * 🔎 Payment status
     *
     * captured = successful
     * authorized = payment authorized
     * failed = failed
     * others = processing
     */
    const gatewayStatus =
      String(
        razorpayPayment?.status ||
          ""
      ).toLowerCase();

    let finalStatus:
      | "paid"
      | "failed"
      | "processing";

    if (
      gatewayStatus ===
      "captured"
    ) {
      finalStatus = "paid";
    } else if (
      gatewayStatus ===
      "failed"
    ) {
      finalStatus = "failed";
    } else {
      finalStatus = "processing";
    }

    /*
     * 💾 Update payment
     */
    const updatePayload: any = {
      payment_status:
        finalStatus,

      transaction_id:
        paymentId,

      payment_method:
        razorpayPayment?.method ||
        "razorpay",

      payment_gateway:
        "razorpay",
    };

    /*
     * Optional Razorpay fields
     */
    if (
      razorpayPayment?.email
    ) {
      updatePayload.gateway_email =
        razorpayPayment.email;
    }

    if (
      razorpayPayment?.contact
    ) {
      updatePayload.gateway_contact =
        razorpayPayment.contact;
    }

    const {
      data: updatedPayment,
      error: updateError,
    } =
      await supabaseAdmin
        .from("payments")
        .update(updatePayload)
        .eq(
          "id",
          payment.id
        )
        .select("*")
        .single();

    if (updateError) {
      console.error(
        "Payment update error:",
        updateError
      );

      return send(res, 500, {
        error:
          "Payment verify hua lekin database update nahi hua",
      });
    }

    /*
     * 🎉 Successful payment
     */
    if (
      finalStatus === "paid"
    ) {
      /*
       * Customer notification
       */
      try {
        await supabaseAdmin
          .from("notifications")
          .insert({
            user_id:
              customerId,

            type:
              "payment_paid",

            title:
              "🎉 Payment successful!",

            message:
              "JUGAAD payment verify ho gaya. Provider settlement process mein hai.",

            read: false,
          });
      } catch {
        /*
         * Notification failure should
         * not reverse a successful payment.
         */
      }

      /*
       * Provider notification
       */
      try {
        const providerId =
          payment.provider_id;

        if (providerId) {
          await supabaseAdmin
            .from("notifications")
            .insert({
              user_id:
                providerId,

              type:
                "payment_paid",

              title:
                "💰 JUGAAD payment receive hua!",

              message:
                "Customer ka payment successfully verify ho gaya.",

              read: false,
            });
        }
      } catch {
        /*
         * Non-critical.
         */
      }
    }

    /*
     * ❌ Failed payment
     */
    if (
      finalStatus === "failed"
    ) {
      try {
        await supabaseAdmin
          .from("notifications")
          .insert({
            user_id:
              customerId,

            type:
              "payment_failed",

            title:
              "❌ Payment fail ho gaya",

            message:
              "Razorpay payment complete nahi ho saka. Dobara try kar sakte ho.",

            read: false,
          });
      } catch {
        /*
         * Non-critical.
         */
      }
    }

    /*
     * 📤 Frontend response
     */
    return send(res, 200, {
      success: true,

      status:
        finalStatus,

      paymentId,

      orderId,

      gatewayStatus,

      payment:
        updatedPayment,

      message:
        finalStatus === "paid"
          ? "Payment successfully verified."
          : finalStatus === "failed"
            ? "Payment failed."
            : "Payment received; final gateway confirmation is pending.",
    });
  } catch (error: any) {
    console.error(
      "JUGAAD Razorpay verify-payment:",
      error
    );

    return send(res, 500, {
      error:
        error?.message ||
        "Payment verification failed",
    });
  }
}
