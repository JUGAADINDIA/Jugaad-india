import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

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

function getBearerToken(req: VercelRequest) {
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
   * 🔐 Server configuration
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
   * 🔑 User session
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
     * 📋 Request ID
     */
    const {
      requestId,
    } = req.body || {};

    if (!requestId) {
      return send(res, 400, {
        error:
          "requestId is required",
      });
    }

    /*
     * 📦 Get request
     */
    const {
      data: request,
      error: requestError,
    } =
      await supabaseAdmin
        .from("requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();

    if (requestError) {
      console.error(
        "Request fetch error:",
        requestError
      );

      return send(res, 500, {
        error:
          "Request fetch nahi ho saki",
      });
    }

    if (!request) {
      return send(res, 404, {
        error:
          "JUGAAD request nahi mili",
      });
    }

    /*
     * 🔒 Customer ownership
     */
    if (
      request.user_id &&
      request.user_id !== customerId
    ) {
      return send(res, 403, {
        error:
          "Aap is request ke owner nahi ho",
      });
    }

    /*
     * 💳 Existing paid payment
     */
    const {
      data: existingPayments,
      error:
        existingPaymentError,
    } =
      await supabaseAdmin
        .from("payments")
        .select("*")
        .eq(
          "request_id",
          requestId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1);

    if (existingPaymentError) {
      console.error(
        "Payment lookup error:",
        existingPaymentError
      );
    }

    const existingPayment =
      existingPayments?.[0];

    if (
      existingPayment?.payment_status ===
        "paid" ||
      existingPayment?.status ===
        "paid"
    ) {
      return send(res, 200, {
        success: true,
        alreadyPaid: true,
        payment:
          existingPayment,
      });
    }

    /*
     * 🤝 Find accepted quote
     *
     * Existing JUGAAD flow mein
     * provider quote matches table
     * mein stored hota hai.
     */
    const {
      data: matches,
      error: matchError,
    } =
      await supabaseAdmin
        .from("matches")
        .select("*")
        .eq(
          "request_id",
          requestId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (matchError) {
      console.error(
        "Match lookup error:",
        matchError
      );

      return send(res, 500, {
        error:
          "Provider quote check nahi ho saka",
      });
    }

    const acceptedMatch =
      (matches || []).find(
        (match: any) => {
          const status =
            String(
              match.status ||
                match.matches_status ||
                ""
            ).toLowerCase();

          return (
            status === "accepted" ||
            status === "quote_pending" ||
            status ===
              "quote_accepted"
          );
        }
      ) ||
      (matches || []).find(
        (match: any) =>
          Number(
            match.quoted_amount
          ) > 0
      );

    /*
     * 💰 Amount
     */
    const quotedAmount = Number(
      acceptedMatch?.quoted_amount
    );

    /*
     * Fallback:
     * Agar request/payment mein amount
     * already stored hai.
     */
    const requestAmount = Number(
      request.amount ||
        request.price ||
        request.total_amount ||
        0
    );

    const amountRupees =
      Number.isFinite(
        quotedAmount
      ) &&
      quotedAmount > 0
        ? quotedAmount
        : requestAmount;

    if (
      !Number.isFinite(
        amountRupees
      ) ||
      amountRupees <= 0
    ) {
      return send(res, 400, {
        error:
          "Provider quote/amount available nahi hai. Pehle provider quote approve karo.",
      });
    }

    /*
     * ₹ ko paise mein convert
     *
     * Example:
     * ₹500 = 50000 paise
     */
    const amountPaise =
      Math.round(
        amountRupees * 100
      );

    if (amountPaise < 100) {
      return send(res, 400, {
        error:
          "Payment amount bahut kam hai.",
      });
    }

    /*
     * 🧾 Unique receipt
     *
     * Razorpay receipt ko short rakho.
     */
    const receipt =
      `JUGAAD_${String(
        requestId
      ).replace(
        /[^a-zA-Z0-9]/g,
        ""
      ).slice(0, 20)}_${Date.now()
        .toString()
        .slice(-8)}`;

    /*
     * 🚀 Create Razorpay order
     */
    const razorpayResponse =
      await fetch(
        `${RAZORPAY_API}/orders`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Basic ${razorpayAuth()}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            amount:
              amountPaise,

            currency: "INR",

            receipt,

            notes: {
              request_id:
                String(requestId),

              customer_id:
                String(customerId),

              app:
                "JUGAAD INDIA",
            },
          }),
        }
      );

    const razorpayData =
      await razorpayResponse
        .json()
        .catch(() => ({}));

    if (
      !razorpayResponse.ok
    ) {
      console.error(
        "Razorpay order error:",
        razorpayData
      );

      return send(
        res,
        razorpayResponse.status,
        {
          error:
            razorpayData?.error
              ?.description ||
            razorpayData?.error
              ?.reason ||
            "Razorpay order create nahi hua",
        }
      );
    }

    const orderId =
      razorpayData?.id;

    if (!orderId) {
      return send(res, 502, {
        error:
          "Razorpay ne order ID nahi di",
      });
    }

    /*
     * 📊 JUGAAD commission
     *
     * Current project logic:
     * Platform = 10%
     * Provider = 90%
     */
    const platformFee =
      Math.round(
        amountRupees * 0.10 * 100
      ) / 100;

    const providerAmount =
      Math.round(
        (amountRupees -
          platformFee) *
          100
      ) / 100;

    /*
     * 💾 Save payment record
     */
    const paymentPayload: any = {
      request_id:
        requestId,

      user_id:
        customerId,

      amount:
        amountRupees,

      currency:
        "INR",

      payment_status:
        "created",

      payment_gateway:
        "razorpay",

      payment_order_id:
        orderId,

      platform_fee:
        platformFee,

      provider_amount:
        providerAmount,
    };

    /*
     * Agar provider/match ID column
     * available ho to save karne ki
     * koshish.
     */
    if (acceptedMatch?.id) {
      paymentPayload.match_id =
        acceptedMatch.id;
    }

    /*
     * Existing payment update,
     * otherwise insert.
     */
    let savedPayment:
      any = null;

    if (existingPayment?.id) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from("payments")
          .update(
            paymentPayload
          )
          .eq(
            "id",
            existingPayment.id
          )
          .select("*")
          .single();

      if (error) {
        console.error(
          "Payment update error:",
          error
        );

        /*
         * Razorpay order create ho chuka
         * hai, isliye database failure ko
         * silently ignore nahi karna.
         */
        return send(res, 500, {
          error:
            "Razorpay order ban gaya, lekin payment record save nahi hua. Dobara payment order create mat karo; admin/database check required hai.",
          orderId,
        });
      }

      savedPayment = data;
    } else {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from("payments")
          .insert(
            paymentPayload
          )
          .select("*")
          .single();

      if (error) {
        console.error(
          "Payment insert error:",
          error
        );

        return send(res, 500, {
          error:
            "Razorpay order ban gaya, lekin payment record save nahi hua.",
          orderId,
        });
      }

      savedPayment = data;
    }

    /*
     * 🔔 Customer notification
     */
    try {
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id:
            customerId,

          type:
            "payment_created",

          title:
            "💳 Payment ready hai!",

          message:
            `JUGAAD ka ₹${amountRupees.toLocaleString(
              "en-IN"
            )} payment ready hai.`,

          read: false,
        });
    } catch {
      /*
       * Notification fail hone par
       * payment flow fail nahi karna.
       */
    }

    /*
     * 📤 Frontend response
     */
    return send(res, 200, {
      success: true,

      alreadyPaid:
        false,

      keyId:
        RAZORPAY_KEY_ID,

      orderId,

      amount:
        amountPaise,

      amountRupees,

      currency:
        "INR",

      customer: {
        name:
          authData.user.user_metadata
            ?.full_name ||
          authData.user.user_metadata
            ?.name ||
          "",

        email:
          authData.user.email ||
          "",

        contact:
          authData.user.phone ||
          "",
      },

      payment:
        savedPayment,

      commission: {
        platform:
          platformFee,

        provider:
          providerAmount,
      },
    });
  } catch (error: any) {
    console.error(
      "JUGAAD Razorpay create-order:",
      error
    );

    return send(res, 500, {
      error:
        error?.message ||
        "Payment order create failed",
    });
  }
}
