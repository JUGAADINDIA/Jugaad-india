const https = require("https");

/*
 * ============================================================
 * ENVIRONMENT VARIABLES
 * ============================================================
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID;

const RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET;

const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET;


/*
 * ============================================================
 * BASIC VALIDATION
 * ============================================================
 */

if (!SUPABASE_URL) {
  console.warn(
    "SUPABASE_URL / VITE_SUPABASE_URL is not configured."
  );
}


/*
 * ============================================================
 * SUPABASE REST API HELPER
 * ============================================================
 */

async function supabaseJson(
  path,
  options = {}
) {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is not configured"
    );
  }

  const {
    method = "GET",
    token,
    headers = {},
    body,
  } = options;

  const authToken =
    token ||
    SUPABASE_SERVICE_ROLE_KEY ||
    SUPABASE_ANON_KEY;

  const url =
    SUPABASE_URL.replace(/\/$/, "") +
    "/rest/v1/" +
    path;

  const response = await fetch(url, {
    method,
    headers: {
      apikey:
        SUPABASE_ANON_KEY ||
        authToken ||
        "",

      Authorization:
        `Bearer ${authToken || ""}`,

      "Content-Type":
        "application/json",

      ...headers,
    },

    body:
      body !== undefined
        ? body
        : undefined,
  });

  const text =
    await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const error =
      typeof data === "object" &&
      data !== null
        ? data.message ||
          data.error_description ||
          data.hint ||
          data.details ||
          JSON.stringify(data)
        : String(data);

    const err = new Error(
      error ||
        `Supabase request failed (${response.status})`
    );

    err.status =
      response.status;

    throw err;
  }

  return data;
}


/*
 * ============================================================
 * GET AUTHENTICATED SUPABASE USER
 * ============================================================
 */

async function getAuthenticatedUser(req) {
  const authorization =
    req.headers.authorization ||
    req.headers.Authorization;

  if (!authorization) {
    const error = new Error(
      "Authorization header is required"
    );

    error.status = 401;

    throw error;
  }

  const parts =
    authorization.split(" ");

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== "bearer"
  ) {
    const error = new Error(
      "Invalid Authorization header"
    );

    error.status = 401;

    throw error;
  }

  const accessToken =
    parts[1];

  if (!accessToken) {
    const error = new Error(
      "Access token is missing"
    );

    error.status = 401;

    throw error;
  }

  const user = await supabaseJson(
    "auth/v1/user",
    {
      token: accessToken,
    }
  );

  if (!user || !user.id) {
    const error = new Error(
      "Authenticated user not found"
    );

    error.status = 401;

    throw error;
  }

  return user;
}


/*
 * ============================================================
 * RAZORPAY API REQUEST
 * ============================================================
 */

function razorpayRequest(
  path,
  options = {}
) {
  return new Promise(
    (resolve, reject) => {
      if (
        !RAZORPAY_KEY_ID ||
        !RAZORPAY_KEY_SECRET
      ) {
        return reject(
          new Error(
            "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured"
          )
        );
      }

      const {
        method = "GET",
        body,
      } = options;

      const auth =
        Buffer.from(
          `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
        ).toString("base64");

      const requestBody =
        body || null;

      const requestOptions = {
        hostname:
          "api.razorpay.com",

        port: 443,

        path,

        method,

        headers: {
          Authorization:
            `Basic ${auth}`,

          "Content-Type":
            "application/json",

          ...(requestBody
            ? {
                "Content-Length":
                  Buffer.byteLength(
                    requestBody
                  ),
              }
            : {}),
        },
      };

      const request =
        https.request(
          requestOptions,
          (response) => {
            const chunks = [];

            response.on(
              "data",
              (chunk) => {
                chunks.push(chunk);
              }
            );

            response.on(
              "end",
              () => {
                const raw =
                  Buffer.concat(
                    chunks
                  ).toString("utf8");

                let data = null;

                try {
                  data = raw
                    ? JSON.parse(raw)
                    : null;
                } catch {
                  data = raw;
                }

                if (
                  response.statusCode < 200 ||
                  response.statusCode >= 300
                ) {
                  const message =
                    data?.error?.description ||
                    data?.error?.reason ||
                    data?.message ||
                    "Razorpay API request failed";

                  const error =
                    new Error(message);

                  error.status =
                    response.statusCode;

                  return reject(error);
                }

                resolve(data);
              }
            );
          }
        );

      request.on(
        "error",
        reject
      );

      if (requestBody) {
        request.write(
          requestBody
        );
      }

      request.end();
    }
  );
}


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,

  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,

  supabaseJson,
  getAuthenticatedUser,
  razorpayRequest,
};
