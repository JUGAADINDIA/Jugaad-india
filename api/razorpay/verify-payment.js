const crypto = require('crypto');
const {
  getAuthenticatedUser,
  supabaseJson,
  SUPABASE_SERVICE_ROLE_KEY,
  RAZORPAY_KEY_SECRET
} = require('./_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    if (!RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_SECRET is not configured');
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }

    const user = await getAuthenticatedUser(req);

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : (req.body || {});

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId
    } = body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        error: 'Razorpay payment details are incomplete.'
      });
    }

    /*
     * Razorpay signature verification
     *
     * Signature =
     * HMAC_SHA256(
     *   razorpay_order_id + "|" + razorpay_payment_id,
     *   RAZORPAY_KEY_SECRET
     * )
     */

    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest('hex');

    const receivedBuffer =
      Buffer.from(razorpay_signature, 'utf8');

    const generatedBuffer =
      Buffer.from(generatedSignature, 'utf8');

    if (
      receivedBuffer.length !== generatedBuffer.length ||
      !crypto.timingSafeEqual(
        receivedBuffer,
        generatedBuffer
      )
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Razorpay payment signature.'
      });
    }

    /*
     * Find the payment record.
     * We verify customer ownership so another user
     * cannot update someone else's payment.
     */

    let paymentRows = [];

    if (paymentId) {
      paymentRows = await supabaseJson(
        `payments?select=*&id=eq.${encodeURIComponent(
          paymentId
        )}&customer_id=eq.${encodeURIComponent(
          user.id
        )}&limit=1`,
        {
          token: SUPABASE_SERVICE_ROLE_KEY
        }
      );
    }

    if (!paymentRows?.length) {
      paymentRows = await supabaseJson(
        `payments?select=*&payment_order_id=eq.${encodeURIComponent(
          razorpay_order_id
        )}&customer_id=eq.${encodeURIComponent(
          user.id
        )}&limit=1`,
        {
          token: SUPABASE_SERVICE_ROLE_KEY
        }
      );
    }

    const payment = paymentRows?.[0];

    if (!payment) {
      return res.status(404).json({
        error: 'JUGAAD payment record not found.'
      });
    }

    /*
     * Prevent accidental double-processing.
     */

    if (
      payment.payment_status === 'paid' &&
      payment.gateway_payment_id === razorpay_payment_id
    ) {
      return res.status(200).json({
        success: true,
        alreadyPaid: true,
        message: 'Payment already verified.'
      });
    }

    /*
     * Make sure the Razorpay order belongs to
     * the payment record we are updating.
     */

    if (
      String(payment.payment_order_id) !==
      String(razorpay_order_id)
    ) {
      return res.status(400).json({
        error: 'Razorpay order does not match JUGAAD payment.'
      });
    }

    const updatedRows = await supabaseJson(
      `payments?id=eq.${encodeURIComponent(payment.id)}&customer_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: 'PATCH',
        token: SUPABASE_SERVICE_ROLE_KEY,
        headers: {
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          payment_status: 'paid',
          gateway_payment_id: razorpay_payment_id,
          gateway_signature: razorpay_signature,
          transaction_id: razorpay_payment_id,
          paid_at: new Date().toISOString(),
          notes:
            'Razorpay payment verified successfully by JUGAAD.'
        })
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully.',
      paymentId:
        updatedRows?.[0]?.id || payment.id,
      razorpayPaymentId: razorpay_payment_id
    });

  } catch (error) {
    console.error('verify-payment', error);

    return res.status(error.status || 500).json({
      success: false,
      error:
        error.message ||
        'Unable to verify Razorpay payment.'
    });
  }
};
