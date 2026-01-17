import express from 'express';
import axios from 'axios';
import { pool } from '../db.js';
import dotenv from 'dotenv';
// REMOVED: uuid import to prevent "Module Not Found" crashes

dotenv.config();
const router = express.Router();

// ==================================================================
// 1. CONFIGURATION (V2 STANDARD)
// ==================================================================

// Determine Environment
const IS_PROD = process.env.PHONEPE_ENV === 'production';

// ✅ FIXED: Hardcoded correct URLs to prevent 404 errors
const HOST_URL = IS_PROD 
    ? "https://api.phonepe.com/apis/hermes" 
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";

const AUTH_ENDPOINT = IS_PROD
    ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";

// Standard V2 Endpoint
const PAY_ENDPOINT = `${HOST_URL}/pg/v1/pay`; 

// Your Frontend URL
const FRONTEND_URL = "https://hirehive.in";
const BACKEND_URL = "https://hirehive-api.onrender.com";

// Plan Details
const PLANS = {
    'worker': { amount: 1, name: "Worker Plan" },
    'colony': { amount: 4999, name: "Colony Plan" },
    'queen': { amount: 8999, name: "Queen Plan" },
    'hive_master': { amount: 14999, name: "Hive Master Plan" }
};

// ==================================================================
// 2. HELPER: GET OAUTH TOKEN
// ==================================================================
const getAuthToken = async () => {
    try {
        const params = new URLSearchParams();
        params.append('client_id', process.env.PHONEPE_CLIENT_ID);
        params.append('client_secret', process.env.PHONEPE_CLIENT_SECRET);
        params.append('grant_type', 'client_credentials');
        params.append('client_version', process.env.PHONEPE_CLIENT_VERSION || '1');

        console.log("🔑 Fetching Auth Token...");

        const response = await axios.post(AUTH_ENDPOINT, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        console.log("✅ Auth Token Received");
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
        console.log("💰 Payment Request Received:", req.body);
        
        const { planKey, userId } = req.body;

        // Validation
        if (!userId) return res.status(400).json({ error: "User ID missing" });
        if (!process.env.PHONEPE_CLIENT_ID || !process.env.PHONEPE_CLIENT_SECRET) {
            console.error("❌ CRITICAL: V2 Credentials missing in env.");
            return res.status(500).json({ error: "Server config error" });
        }

        const plan = PLANS[planKey];
        if (!plan) return res.status(400).json({ error: `Invalid Plan: ${planKey}` });

        // ✅ FIXED: Vanilla JS ID Generation (No 'uuid' dependency needed)
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const merchantTransactionId = `TXN_${uniqueId}`;
        const amountInPaise = plan.amount * 100; 

        // ✅ FIXED: CLEAN USER ID (Remove dashes)
        // PhonePe throws 400 Error if ID has special chars. We strip them here.
        const cleanUserId = userId.toString().replace(/[^a-zA-Z0-9]/g, "");

        // 1. Get OAuth Token
        const token = await getAuthToken();

       
        // 2. Prepare Payload
        const payload = {
            merchantId: process.env.PHONEPE_MERCHANT_ID, 
            merchantTransactionId: merchantTransactionId,
            merchantUserId: `USER${cleanUserId}`,
            amount: amountInPaise,
            redirectUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
            redirectMode: "POST",
            callbackUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
            mobileNumber: "9999999999", // 👈 ADD THIS (PhonePe sometimes requires it)
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        // 3. Encode Base64
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

        // 4. Send Request with Bearer Token
        console.log(`📤 Sending V2 Payment Request (${amountInPaise} paise) to ${PAY_ENDPOINT}...`);
        
        const response = await axios.post(PAY_ENDPOINT, 
            { request: base64Payload }, 
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `O-Bearer ${token}` // V2 Auth Header
                }
            }
        );

        console.log("✅ PhonePe Response:", response.data);

        if (response.data.success) {
            // Log Pending Transaction
            await pool.query(
                `INSERT INTO payments (transaction_id, user_id, amount, status, created_at) 
                 VALUES ($1, $2, $3, 'PENDING', NOW())`,
                [merchantTransactionId, userId, plan.amount]
            );

            res.json({ 
                success: true,
                url: response.data.data.instrumentResponse.redirectInfo.url,
                transactionId: merchantTransactionId 
            });
        } else {
            console.error("❌ PhonePe Rejection:", response.data);
            res.status(500).json({ error: "Payment Gateway Rejected Request" });
        }

    } catch (error) {
        console.error("❌ Payment Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Payment initiation failed" });
    }
});

// ==================================================================
// 4. CALLBACK & STATUS CHECK (V2)
// ==================================================================
router.post('/callback/:txnId/:planKey/:userId', async (req, res) => {
    try {
        const { txnId, planKey, userId } = req.params;
        console.log(`🔄 Callback Received for TXN: ${txnId}`);

        // 1. Get Token again for Status Check
        const token = await getAuthToken();

        // 2. Check Status
        const statusUrl = `${HOST_URL}/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${txnId}`;
        
        const statusResponse = await axios.get(statusUrl, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `O-Bearer ${token}`
            }
        });

        if (statusResponse.data.code === 'PAYMENT_SUCCESS') {
            console.log(`✅ Payment SUCCESS: ${txnId}`);

            // Update Database
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
            console.warn(`⚠️ Payment FAILED/PENDING: ${statusResponse.data.code}`);
            await pool.query("UPDATE payments SET status = 'FAILED' WHERE transaction_id = $1", [txnId]);
            res.redirect(`${FRONTEND_URL}/#dashboard?status=failed`);
        }

    } catch (error) {
        console.error("❌ Verification Error:", error.message);
        res.redirect(`${FRONTEND_URL}/#dashboard?status=error`);
    }
});

export default router;