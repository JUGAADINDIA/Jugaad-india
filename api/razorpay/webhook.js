const crypto = require("crypto");

const {
  supabaseJson,
  SUPABASE_SERVICE_ROLE_KEY,
  RAZORPAY_WEBHOOK_SECRET,
} = require("./_helpers");

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk)
      );
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

function verifySignature(rawBody, signature) {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    throw new Error(
      "RAZORPAY_WEBHOOK_SECRET is not configured"
    );
  }

  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac(
      "sha256",
      RAZORPAY_WEBHOOK_SECRET
    )
    .update(rawBody)
    .digest("hex");

  const receivedBuffer = Buffer.from(
    String(signature),
    "utf8"
  );

  const expectedBuffer = Buffer.from(
    expected,
    "utf8"
  );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured"
      );
    }

    const signature =
      req.headers["x-razorpay-signature"];

    const eventId =
      req.headers["x-razorpay-event-id"] || null;

    const rawBody = await getRawBody(req);

    const valid = verifySignature(
      rawBody,
      signature
    );

    if (!valid) {
      return res.status(400).json({
        success: false,
        error: "Invalid Razorpay webhook signature",
      });
    }

    let payload;

    try {
      payload = JSON.parse(
        rawBody.toString("utf8")
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid webhook JSON",
      });
    }

    const event = payload.event;

    /*
     * PAYMENT CAPTURED
     */
    if (event === "payment.captured") {
      const payment =
        payload?.payload?.payment?.entity;

      const razorpayPaymentId = payment?.id;
      const razorpayOrderId = payment?.order_id;

      if (
        !razorpayPaymentId ||
        !razorpayOrderId
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Razorpay payment ID or order ID missing",
        });
      }

      const rows = await supabaseJson(
        "payments?select=*&payment_order_id=eq." +
          encodeURIComponent(razorpayOrderId) +
          "&limit=1",
        {
          token: SUPABASE_SERVICE_ROLE_KEY,
        }
      );

      const paymentRow = rows?.[0];

      if (!paymentRow) {
        return res.status(200).json({
          success: true,
          message:
            "Payment received but JUGAAD payment record was not found.",
        });
      }

      /*
       * Already processed
       */
      if (
        paymentRow.payment_status === "paid" &&
        paymentRow.gateway_payment_id ===
          razorpayPaymentId
      ) {
        return res.status(200).json({
          success: true,
          alreadyProcessed: true,
        });
      }

      await supabaseJson(
        "payments?id=eq." +
          encodeURIComponent(paymentRow.id),
        {
          method: "PATCH",
          token: SUPABASE_SERVICE_ROLE_KEY,
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            payment_status: "paid",
            gateway_payment_id:
              razorpayPaymentId,
            transaction_id:
              razorpayPaymentId,
            webhook_event_id: eventId,
            paid_at:
              new Date().toISOString(),
            notes:
              "Payment captured by Razorpay webhook.",
          }),
        }
      );

      return res.status(200).json({
        success: true,
        event: event,
        paymentStatus: "paid",
      });
    }

    /*
     * PAYMENT FAILED
     */
    if (event === "payment.failed") {
      const payment =
        payload?.payload?.payment?.entity;

      const razorpayPaymentId = payment?.id;
      const razorpayOrderId = payment?.order_id;

      if (!razorpayOrderId) {
        return res.status(200).json({
          success: true,
        });
      }

      const rows = await supabaseJson(
        "payments?select=*&payment_order_id=eq." +
          encodeURIComponent(razorpayOrderId) +
          "&limit=1",
        {
          token: SUPABASE_SERVICE_ROLE_KEY,
        }
      );

      const paymentRow = rows?.[0];

      if (paymentRow) {
        await supabaseJson(
          "payments?id=eq." +
            encodeURIComponent(paymentRow.id),
          {
            method: "PATCH",
            token: SUPABASE_SERVICE_ROLE_KEY,
            headers: {
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              payment_status: "failed",
              gateway_payment_id:
                razorpayPaymentId || null,
              webhook_event_id: eventId,
              notes:
                "Payment failed according to Razorpay.",
            }),
          }
        );
      }

      return res.status(200).json({
        success: true,
        event: event,
        paymentStatus: "failed",
      });
    }

    /*
     * REFUND PROCESSED
     */
    if (event === "refund.processed") {
      const refund =
        payload?.payload?.refund?.entity;

      const razorpayPaymentId =
        refund?.payment_id;

      if (razorpayPaymentId) {
        const rows = await supabaseJson(
          "payments?select=*&gateway_payment_id=eq." +
            encodeURIComponent(
              razorpayPaymentId
            ) +
            "&limit=1",
          {
            token:
              SUPABASE_SERVICE_ROLE_KEY,
          }
        );

        const paymentRow = rows?.[0];

        if (paymentRow) {
          await supabaseJson(
            "payments?id=eq." +
              encodeURIComponent(
                paymentRow.id
              ),
            {
              method: "PATCH",
              token:
                SUPABASE_SERVICE_ROLE_KEY,
              headers: {
                Prefer:
                  "return=representation",
              },
              body: JSON.stringify({
                payment_status: "refunded",
                webhook_event_id: eventId,
                notes:
                  "Refund processed by Razorpay.",
              }),
            }
          );
        }
      }

      return res.status(200).json({
        success: true,
        event: event,
        paymentStatus: "refunded",
      });
    }

    /*
     * Other Razorpay events
     */
    return res.status(200).json({
      success: true,
      event: event || "unknown",
      message: "Webhook received.",
    });

  } catch (error) {
    console.error(
      "Razorpay webhook error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Webhook processing failed",
    });
  }
};
