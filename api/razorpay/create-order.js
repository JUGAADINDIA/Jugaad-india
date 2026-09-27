const { getAuthenticatedUser, supabaseJson, razorpayRequest, RAZORPAY_KEY_ID, SUPABASE_SERVICE_ROLE_KEY } = require('./_helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }

    const user = await getAuthenticatedUser(req);

    const { requestId } =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : (req.body || {});

    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    const requests = await supabaseJson(
      `requests?select=id,user_id,need,status,provider_id&id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { token: SUPABASE_SERVICE_ROLE_KEY }
    );

    const request = requests?.[0];

    if (!request) {
      return res.status(404).json({
        error: 'Request not found or not owned by customer'
      });
    }

    if (String(request.status) !== 'completed') {
      return res.status(400).json({
        error: 'Online payment is available after the service is completed.'
      });
    }

    const matches = await supabaseJson(
      `matches?select=id,request_id,provider_id,worker_id,quoted_amount,status,matches_status&request_id=eq.${encodeURIComponent(requestId)}&quoted_amount=not.is.null&order=created_at.desc&limit=1`,
      { token: SUPABASE_SERVICE_ROLE_KEY }
    );

    const match = matches?.[0];
    const amount = Number(match?.quoted_amount);

    if (!match || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Approved provider quote not found.'
      });
    }

    const existingRows = await supabaseJson(
      `payments?select=id,amount,payment_status,payment_order_id,payment_gateway&request_id=eq.${encodeURIComponent(requestId)}&payment_gateway=eq.razorpay&order=created_at.desc&limit=1`,
      { token: SUPABASE_SERVICE_ROLE_KEY }
    );

    const existing = existingRows?.[0];

    if (
      existing?.payment_status === 'paid' &&
      existing.payment_order_id
    ) {
      return res.status(200).json({
        alreadyPaid: true,
        keyId: RAZORPAY_KEY_ID,
        orderId: existing.payment_order_id,
        amount: Math.round(Number(existing.amount) * 100),
        currency: 'INR',
        paymentId: existing.id
      });
    }

    if (
      existing?.payment_order_id &&
      ['created', 'pending', 'authorized'].includes(
        String(existing.payment_status)
      )
    ) {
      return res.status(200).json({
        keyId: RAZORPAY_KEY_ID,
        orderId: existing.payment_order_id,
        amount: Math.round(Number(existing.amount) * 100),
        currency: 'INR',
        paymentId: existing.id,
        reused: true
      });
    }

    const amountPaise = Math.round(amount * 100);

    const order = await razorpayRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `jgd_${String(requestId)
          .replace(/-/g, '')
          .slice(0, 24)}_${Date.now().toString().slice(-8)}`,
        notes: {
          request_id: requestId,
          customer_id: user.id,
          match_id: match.id
        }
      })
    });

    const platformFee =
      Math.round(amount * 0.10 * 100) / 100;

    const providerAmount =
      Math.round((amount - platformFee) * 100) / 100;

    const providerId =
      match.provider_id ||
      match.worker_id ||
      request.provider_id ||
      null;

    const rows = await supabaseJson('payments', {
      method: 'POST',
      token: SUPABASE_SERVICE_ROLE_KEY,
      headers: {
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        request_id: requestId,
        match_id: match.id,
        customer_id: user.id,
        provider_id: providerId,
        amount,
        platform_fee: platformFee,
        commission_rate: 10,
        provider_amount: providerAmount,
        settlement_status: 'pending',
        payment_method: null,
        transaction_id: null,
        payment_status: 'created',
        payment_gateway: 'razorpay',
        payment_order_id: order.id,
        gateway_payment_id: null,
        gateway_signature: null,
        webhook_event_id: null,
        notes: 'Razorpay online payment order created by JUGAAD.'
      })
    });

    return res.status(200).json({
      keyId: RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      paymentId: rows?.[0]?.id || null,
      customer: {
        name:
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'JUGAAD Customer',
        email: user.email || undefined
      }
    });

  } catch (error) {
    console.error('create-order', error);

    return res.status(error.status || 500).json({
      error:
        error.message ||
        'Unable to create payment order'
    });
  }
};
