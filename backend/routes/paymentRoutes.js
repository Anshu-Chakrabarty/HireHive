import express from 'express';
import axios from 'axios';
import { pool } from '../db.js';
import dotenv from 'dotenv';
// No uuid or crypto needed for this flow

dotenv.config();
const router = express.Router();

// ==================================================================
// 1. CONFIGURATION (V2 CHECKOUT)
// ==================================================================
const IS_PROD = process.env.PHONEPE_ENV === 'production';

// URLs
const HOST_URL = IS_PROD 
    ? "https://api.phonepe.com/apis/hermes" 
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";

const AUTH_ENDPOINT = IS_PROD
    ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";

// ✅ CHANGED: Using the V2 Endpoint
const PAY_ENDPOINT = `${HOST_URL}/checkout/v2/pay`; 

const BACKEND_URL = "https://hirehive-api.onrender.com";
const FRONTEND_URL = "https://hirehive.in";

const PLANS = {
    'worker': { amount: 1, name: "Worker Plan" },
    'colony': { amount: 4999, name: "Colony Plan" },
    'queen': { amount: 8999, name: "Queen Plan" },
    'hive_master': { amount: 14999, name: "Hive Master Plan" }
};

// ==================================================================
// 2. HELPER: GET AUTH TOKEN
// ==================================================================
const getAuthToken = async () => {
    try {
        console.log("🔑 [DEBUG] Fetching Auth Token...");
        const params = new URLSearchParams();
        params.append('client_id', process.env.PHONEPE_CLIENT_ID);
        params.append('client_secret', process.env.PHONEPE_CLIENT_SECRET);
        params.append('grant_type', 'client_credentials');
        params.append('client_version', process.env.PHONEPE_CLIENT_VERSION || '1');

        const response = await axios.post(AUTH_ENDPOINT, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        console.log("✅ [DEBUG] Token Received");
        return response.data.access_token;
    } catch (error) {
        console.error("❌ Auth Token Error:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with PhonePe V2");
    }
};

// ==================================================================
// 3. INITIATE PAYMENT (V2)
// ==================================================================
router.post('/pay', async (req, res) => {
    try {
        console.log("💰 [DEBUG] V2 Payment Request:", req.body);
        const { planKey, userId } = req.body;

        if (!userId) return res.status(400).json({ error: "User ID missing" });
        if (!process.env.PHONEPE_CLIENT_ID) return res.status(500).json({ error: "Client ID missing in Env" });

        const plan = PLANS[planKey];
        if (!plan) return res.status(400).json({ error: `Invalid Plan: ${planKey}` });

        // Generate IDs
        const uniqueId = Date.now().toString(36);
        const merchantTransactionId = `TXN_${uniqueId}`;
        const amountInPaise = plan.amount * 100; 

        // Clean User ID
        const cleanUserId = userId.toString().replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
        const merchantUserId = `USER${cleanUserId}`;

        // 1. Get Token
        const token = await getAuthToken();

        // 2. Prepare Payload (Standard V2)
        const payload = {
            merchantId: process.env.PHONEPE_MERCHANT_ID, 
            merchantTransactionId: merchantTransactionId,
            merchantUserId: merchantUserId,
            amount: amountInPaise,
            redirectUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
            redirectMode: "POST",
            callbackUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
            mobileNumber: "9999999999", 
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        // 3. V2 often accepts RAW JSON with Content-Type application/json
        // But some documentation suggests sticking to { request: base64 } structure even for V2.
        // We will try the Base64 wrapper first as it is the most common PhonePe standard.
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

        console.log(`📤 [DEBUG] Sending to ${PAY_ENDPOINT}`);

        const response = await axios.post(PAY_ENDPOINT, 
            { request: base64Payload }, 
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `O-Bearer ${token}` // ✅ Using Bearer Token
                }
            }
        );

        console.log("✅ [DEBUG] PhonePe V2 Success:", response.data);

        if (response.data.success) {
            // Log to DB
            try {
                await pool.query(
                    `INSERT INTO payments (transaction_id, user_id, amount, status, created_at) 
                     VALUES ($1, $2, $3, 'PENDING', NOW())`,
                    [merchantTransactionId, userId, plan.amount]
                );
            } catch (e) { console.error("DB Error:", e.message); }

            res.json({ 
                success: true,
                url: response.data.data.instrumentResponse.redirectInfo.url,
                transactionId: merchantTransactionId 
            });
        } else {
            console.error("❌ [DEBUG] Rejection:", response.data);
            res.status(500).json({ error: "Payment Gateway Rejected Request" });
        }

    } catch (error) {
        const errorData = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("❌ [DEBUG] Payment Error:", errorData);
        // Important: If V2 endpoint returns 404, it means your account isn't migrated to V2 yet
        res.status(500).json({ error: "Payment initiation failed", details: errorData });
    }
});

// ==================================================================
// 4. CALLBACK
// ==================================================================
router.post('/callback/:txnId/:planKey/:userId', async (req, res) => {
    try {
        const { txnId, planKey, userId } = req.params;
        console.log(`🔄 [DEBUG] Callback: ${txnId}`);

        const token = await getAuthToken();
        
        // V2 Status Check Endpoint
        const statusUrl = `${HOST_URL}/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${txnId}`;
        
        const statusResponse = await axios.get(statusUrl, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `O-Bearer ${token}`
            }
        });

        if (statusResponse.data.code === 'PAYMENT_SUCCESS') {
            await pool.query(
                `UPDATE users 
                 SET subscriptionstatus = $1, 
                     jobpostcount = 0,
                     subscription_jsonb = jsonb_set(
                        COALESCE(subscription_jsonb, '{}'::jsonb), 
                        '{plan}', 
                        to_jsonb($1::text)
                     ) || '{"active": true, "last_payment": "${new Date().toISOString()}"}'::jsonb
                 WHERE id = $2`,
                [planKey, userId]
            );
            await pool.query("UPDATE payments SET status = 'SUCCESS' WHERE transaction_id = $1", [txnId]);
            res.redirect(`${FRONTEND_URL}/#dashboard?status=success&plan=${planKey}`);
        } else {
            await pool.query("UPDATE payments SET status = 'FAILED' WHERE transaction_id = $1", [txnId]);
            res.redirect(`${FRONTEND_URL}/#dashboard?status=failed`);
        }

    } catch (error) {
        console.error("❌ Callback Error:", error.message);
        res.redirect(`${FRONTEND_URL}/#dashboard?status=error`);
    }
});

export default router;