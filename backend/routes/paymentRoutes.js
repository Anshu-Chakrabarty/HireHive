import express from 'express';
import axios from 'axios';
import { pool } from '../db.js';
import dotenv from 'dotenv';
// NO uuid import to avoid crashes

dotenv.config();
const router = express.Router();

// ==================================================================
// 1. CONFIGURATION
// ==================================================================
const IS_PROD = process.env.PHONEPE_ENV === 'production';

// URLs
const HOST_URL = IS_PROD 
    ? "https://api.phonepe.com/apis/hermes" 
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";

const AUTH_ENDPOINT = IS_PROD
    ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";

const PAY_ENDPOINT = `${HOST_URL}/pg/v1/pay`; 

const BACKEND_URL = "https://hirehive-api.onrender.com";
const FRONTEND_URL = "https://hirehive.in";

const PLANS = {
    'worker': { amount: 1, name: "Worker Plan" },
    'colony': { amount: 4999, name: "Colony Plan" },
    'queen': { amount: 8999, name: "Queen Plan" },
    'hive_master': { amount: 14999, name: "Hive Master Plan" }
};

// ==================================================================
// 2. HELPER: GET TOKEN
// ==================================================================
const getAuthToken = async () => {
    try {
        console.log("🔑 [DEBUG] Requesting Auth Token...");
        const params = new URLSearchParams();
        params.append('client_id', process.env.PHONEPE_CLIENT_ID);
        params.append('client_secret', process.env.PHONEPE_CLIENT_SECRET);
        params.append('grant_type', 'client_credentials');
        params.append('client_version', process.env.PHONEPE_CLIENT_VERSION || '1');

        const response = await axios.post(AUTH_ENDPOINT, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        if (!response.data.access_token) {
            throw new Error("Token response received but access_token is missing");
        }

        console.log("✅ [DEBUG] Auth Token Received successfully");
        return response.data.access_token;
    } catch (error) {
        console.error("❌ [DEBUG] Auth Token Failed:", error.message);
        throw error;
    }
};

// ==================================================================
// 3. INITIATE PAYMENT
// ==================================================================
router.post('/pay', async (req, res) => {
    try {
        console.log("💰 [DEBUG] Step 1: Request Received:", req.body);
        const { planKey, userId } = req.body;

        // Validation
        if (!userId) return res.status(400).json({ error: "User ID missing" });
        if (!process.env.PHONEPE_CLIENT_ID) return res.status(500).json({ error: "Server config error: Client ID missing" });

        const plan = PLANS[planKey];
        if (!plan) return res.status(400).json({ error: `Invalid Plan: ${planKey}` });

        // Generate IDs (Vanilla JS)
        const uniqueId = Date.now().toString(36);
        const merchantTransactionId = `TXN_${uniqueId}`;
        const amountInPaise = plan.amount * 100; 

        // ✅ FIX: Clean User ID (Remove dashes, limit length)
        const cleanUserId = userId.toString().replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
        const merchantUserId = `USER${cleanUserId}`;

        // Step 2: Get Token
        const token = await getAuthToken();

        // Step 3: Prepare Payload
        const payload = {
            merchantId: process.env.PHONEPE_MERCHANT_ID, 
            merchantTransactionId: merchantTransactionId,
            merchantUserId: merchantUserId,
            amount: amountInPaise,
            redirectUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
            redirectMode: "POST",
            callbackUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
            mobileNumber: "9999999999", // ✅ REQUIRED by V2
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

        console.log(`📤 [DEBUG] Step 4: Sending Payload to ${PAY_ENDPOINT}`);
        console.log(`ℹ️ [DEBUG] Payload Preview:`, JSON.stringify(payload)); // Don't log this in public prod logs usually, but needed for debugging

        const response = await axios.post(PAY_ENDPOINT, 
            { request: base64Payload }, 
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `O-Bearer ${token}`
                }
            }
        );

        console.log("✅ [DEBUG] Step 5: PhonePe Response:", JSON.stringify(response.data));

        if (response.data.success) {
            // Save to DB
            try {
                await pool.query(
                    `INSERT INTO payments (transaction_id, user_id, amount, status, created_at) 
                     VALUES ($1, $2, $3, 'PENDING', NOW())`,
                    [merchantTransactionId, userId, plan.amount]
                );
            } catch (dbErr) {
                console.error("⚠️ [DEBUG] DB Insert Warning (Non-fatal):", dbErr.message);
                // We don't stop the payment if DB logging fails, but we should know about it
            }

            res.json({ 
                success: true,
                url: response.data.data.instrumentResponse.redirectInfo.url,
                transactionId: merchantTransactionId 
            });
        } else {
            console.error("❌ [DEBUG] PhonePe Logic Failure:", response.data);
            res.status(500).json({ error: "Payment Gateway Rejected Request" });
        }

    } catch (error) {
        // DETAILED ERROR LOGGING
        console.error("❌ [DEBUG] CRITICAL PAYMENT ERROR ❌");
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
            res.status(500).json({ error: "Gateway Error", details: error.response.data });
        } else if (error.request) {
            // The request was made but no response was received
            console.error("No Response Received:", error.request);
            res.status(500).json({ error: "No Response from Gateway" });
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error("Error Message:", error.message);
            console.error("Stack:", error.stack);
            res.status(500).json({ error: error.message });
        }
    }
});

// ==================================================================
// 4. CALLBACK
// ==================================================================
router.post('/callback/:txnId/:planKey/:userId', async (req, res) => {
    try {
        const { txnId, planKey, userId } = req.params;
        console.log(`🔄 [DEBUG] Callback for: ${txnId}`);

        const token = await getAuthToken();
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
        console.error("❌ [DEBUG] Callback Error:", error.message);
        res.redirect(`${FRONTEND_URL}/#dashboard?status=error`);
    }
});

export default router;