console.log("🔥🔥🔥 paymentRoutes.js LOADED 🔥🔥🔥");


import express from 'express';
import axios from 'axios';
import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// ==================================================================
// 1. CONFIGURATION (PHONEPE PG V2 – STANDARD CHECKOUT)
// ==================================================================
const IS_PROD = process.env.PHONEPE_ENV === 'production';

const HOST_URL = IS_PROD 
    ? "https://api.phonepe.com/apis/pg"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";


const AUTH_ENDPOINT = IS_PROD
    ? "https://api.phonepe.com/apis/pg/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";


const PAY_ENDPOINT = `${HOST_URL}/checkout/v2/pay`;

const BACKEND_URL = 'https://hirehive-api.onrender.com';
const FRONTEND_URL = 'https://hirehive.in';

const PLANS = {
  worker: { amount: 1, name: 'Worker Plan' },
  colony: { amount: 4999, name: 'Colony Plan' },
  queen: { amount: 8999, name: 'Queen Plan' },
  hive_master: { amount: 14999, name: 'Hive Master Plan' }
};

// ==================================================================
// 2. AUTH TOKEN (OAUTH – PG V2)
// ==================================================================
const getAuthToken = async () => {
  try {
    const params = new URLSearchParams();
    params.append('client_id', process.env.PHONEPE_CLIENT_ID);
    params.append('client_secret', process.env.PHONEPE_CLIENT_SECRET);
    params.append('grant_type', 'client_credentials');
    params.append('client_version', process.env.PHONEPE_CLIENT_VERSION || '1');

    const response = await axios.post(AUTH_ENDPOINT, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return response.data.access_token;
  } catch (err) {
    console.error('❌ PhonePe Auth Error:', err.response?.data || err.message);
    throw new Error('PhonePe authentication failed');
  }
};

// ==================================================================
// 3. INITIATE PAYMENT (STANDARD CHECKOUT V2)
// ==================================================================
router.post('/pay', async (req, res) => {
  try {
    const { planKey, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID missing' });
    }

    const plan = PLANS[planKey];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const merchantTransactionId = `TXN_${Date.now().toString(36)}`;
    const amountInPaise = plan.amount * 100;

    const cleanUserId = userId.toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
    const merchantUserId = `USER${cleanUserId}`;

    const token = await getAuthToken();

    const payload = {
      merchantId: process.env.PHONEPE_MERCHANT_ID,
      merchantTransactionId,
      merchantUserId,
      amount: amountInPaise,
      redirectUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
      redirectMode: 'POST',
      callbackUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

const response = await axios.post(PAY_ENDPOINT, payload, {
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `O-Bearer ${token}`
    }
});


    if (!response.data.success) {
      console.error('❌ PhonePe rejected payment:', response.data);
      return res.status(500).json({ error: 'Payment initiation failed' });
    }

    // Log payment
    await pool.query(
      `INSERT INTO payments (transaction_id, user_id, amount, status, created_at)
       VALUES ($1, $2, $3, 'PENDING', NOW())`,
      [merchantTransactionId, userId, plan.amount]
    );

    return res.json({
      success: true,
      transactionId: merchantTransactionId,
      url: response.data.data.instrumentResponse.redirectInfo.url
    });

  } catch (err) {
    console.error('❌ Payment Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initiation error' });
  }
});

// ==================================================================
// 4. CALLBACK + ORDER STATUS VERIFY (PG V2)
// ==================================================================
router.post('/callback/:txnId/:planKey/:userId', async (req, res) => {
  const { txnId, planKey, userId } = req.params;

  try {
    const token = await getAuthToken();

    const statusUrl = `${HOST_URL}/checkout/v2/order/${txnId}`;

    const statusResponse = await axios.get(statusUrl, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    const isSuccess =
      statusResponse.data.success === true &&
      statusResponse.data.data.state === 'COMPLETED';

    if (isSuccess) {
      await pool.query(
        `UPDATE users
         SET subscriptionstatus = $1,
             jobpostcount = 0,
             subscription_jsonb =
               COALESCE(subscription_jsonb, '{}'::jsonb)
               || jsonb_build_object(
                    'plan', $1,
                    'active', true,
                    'last_payment', NOW()
                  )
         WHERE id = $2`,
        [planKey, userId]
      );

      await pool.query(
        `UPDATE payments SET status = 'SUCCESS' WHERE transaction_id = $1`,
        [txnId]
      );

      return res.redirect(
        `${FRONTEND_URL}/#dashboard?status=success&plan=${planKey}`
      );
    }

    await pool.query(
      `UPDATE payments SET status = 'FAILED' WHERE transaction_id = $1`,
      [txnId]
    );

    return res.redirect(`${FRONTEND_URL}/#dashboard?status=failed`);

  } catch (err) {
    console.error('❌ Callback Error:', err.response?.data || err.message);
    return res.redirect(`${FRONTEND_URL}/#dashboard?status=error`);
  }
});

export default router;
