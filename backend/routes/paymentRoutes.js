import express from 'express';
import axios from 'axios';
import { pool } from '../db.js';
import dotenv from 'dotenv';
// We use vanilla JS for IDs now, no uuid import needed

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

const FRONTEND_URL = "https://hirehive.in";
const BACKEND_URL = "https://hirehive-api.onrender.com";

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
        const params = new URLSearchParams();
        params.append('client_id', process.env.PHONEPE_CLIENT_ID);
        params.append('client_secret', process.env.PHONEPE_CLIENT_SECRET);
        params.append('grant_type', 'client_credentials');
        params.append('client_version', process.env.PHONEPE_CLIENT_VERSION || '1');

        const response = await axios.post(AUTH_ENDPOINT, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("❌ Auth Token Error:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with PhonePe V2");
    }
};

// ==================================================================
// 3. INITIATE PAYMENT
// ==================================================================
router.post('/pay', async (req, res) => {
    try {
        console.log("💰 Payment Request Received:", req.body);
        const { planKey, userId } = req.body;

        if (!userId) return res.status(400).json({ error: "User ID missing" });
        if (!process.env.PHONEPE_CLIENT_ID) return res.status(500).json({ error: "Server config error" });

        const plan = PLANS[planKey];
        if (!plan) return res.status(400).json({ error: `Invalid Plan: ${planKey}` });

        // Generate IDs
        const uniqueId = Date.now().toString(36);
        const merchantTransactionId = `TXN_${uniqueId}`;
        const amountInPaise = plan.amount * 100; 

        // ✅ FIX 1: Shorten User ID to be safe (Max 36 chars allowed)
        // Taking last 12 chars of UUID ensures uniqueness but stays short
        const shortUserId = userId.replace(/-/g, "").slice(-12);
        const cleanMerchantUserId = `USER${shortUserId}`;

        const token = await getAuthToken();

        // ✅ FIX 2: Add Mobile Number (Often required)
        const payload = {
            merchantId: process.env.PHONEPE_MERCHANT_ID, 
            merchantTransactionId: merchantTransactionId,
            merchantUserId: cleanMerchantUserId,
            amount: amountInPaise,
            redirectUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
            redirectMode: "POST",
            callbackUrl: `${BACKEND_URL}/api/payment/callback/${merchantTransactionId}/${planKey}/${userId}`,
            mobileNumber: "9999999999", // Dummy number required by V2 standard
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

        console.log(`📤 Sending V2 Payment Request to ${PAY_ENDPOINT}...`);
        
        const response = await axios.post(PAY_ENDPOINT, 
            { request: base64Payload }, 
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `O-Bearer ${token}`
                }
            }
        );

        if (response.data.success) {
            // Save to DB
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
            console.error("❌ PhonePe Rejection:", JSON.stringify(response.data));
            res.status(500).json({ error: "Payment Gateway Rejected Request" });
        }

    } catch (error) {
        // ✅ FIX 3: Detailed Error Logging
        // This will print the EXACT reason PhonePe rejected it (e.g., "Invalid field")
        const errorData = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("❌ Payment Error (Full Details):", errorData);
        
        res.status(500).json({ error: "Payment initiation failed", details: errorData });
    }
});

// ==================================================================
// 4. CALLBACK
// ==================================================================
router.post('/callback/:txnId/:planKey/:userId', async (req, res) => {
    try {
        const { txnId, planKey, userId } = req.params;
        console.log(`🔄 Callback Received for TXN: ${txnId}`);

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
        console.error("❌ Verification Error:", error.message);
        res.redirect(`${FRONTEND_URL}/#dashboard?status=error`);
    }
});

export default router;