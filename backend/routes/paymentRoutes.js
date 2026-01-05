import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// --- 1. CONFIGURATION & DIAGNOSTICS ---
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;
const HOST_URL = process.env.PHONEPE_HOST_URL || "https://api.phonepe.com/apis/hermes";
const BACKEND_URL = "https://hirehive-api.onrender.com"; // Ensure this matches your live URL

// Print connection status to logs (Masked for security)
console.log("🔌 PHONEPE CONFIG CHECK:");
console.log(`   MID: ${MERCHANT_ID ? "✅ Loaded" : "❌ MISSING"}`);
console.log(`   KEY: ${SALT_KEY ? "✅ Loaded" : "❌ MISSING"}`);
console.log(`   URL: ${HOST_URL}`);

// --- PLAN DETAILS ---
const PLANS = {
    // ⚠️ TEST MODE: Price is set to 1 (₹1) for testing. Change amount to 1999 before public launch.
    'worker': { amount: 1, name: "Worker Plan", limit: 5 }, 
    
    'colony': { amount: 4999, name: "Colony Plan", limit: 15 },
    'queen': { amount: 8999, name: "Queen Plan", limit: 30 },
    'hive_master': { amount: 14999, name: "Hive Master Plan", limit: 9999 }
};

// ==================================================================
// 1. INITIATE PAYMENT
// ==================================================================
router.post('/pay', async (req, res) => {
    try {
        console.log("💰 Payment Request Received:", req.body);
        
        const { planKey, userId } = req.body;

        // 1. Validation
        if (!userId) return res.status(400).json({ error: "User ID missing" });
        if (!MERCHANT_ID || !SALT_KEY) {
            console.error("❌ CRITICAL: Credentials missing in environment variables.");
            return res.status(500).json({ error: "Server configuration error (Missing Keys)" });
        }

        const plan = PLANS[planKey];
        if (!plan) return res.status(400).json({ error: `Invalid Plan: ${planKey}` });

        // 2. Prepare Data
        const transactionId = "TXN_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        const amountInPaise = plan.amount * 100; 
        
        // Safety: Convert userId to string to prevent ".replace is not a function" error
        const cleanUserId = "USER" + String(userId).replace(/[^a-zA-Z0-9]/g, "").substring(0, 10);

        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: cleanUserId,
            amount: amountInPaise,
            redirectUrl: `${BACKEND_URL}/api/payment/callback/${transactionId}/${planKey}/${userId}`,
            redirectMode: "POST",
            callbackUrl: `${BACKEND_URL}/api/payment/callback/${transactionId}/${planKey}/${userId}`,
            paymentInstrument: { type: "PAY_PAGE" }
        };

        // 3. Cryptography
        const bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
        const base64EncodedPayload = bufferObj.toString("base64");
        const stringToHash = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
        const sha256Value = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const xVerify = sha256Value + "###" + SALT_INDEX;

        // 4. Send Request
        console.log(`📤 Sending to PhonePe (${amountInPaise} paise)...`);
        
        const response = await axios.post(`${HOST_URL}/pg/v1/pay`, 
            { request: base64EncodedPayload }, 
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': xVerify
                }
            }
        );

        console.log("✅ PhonePe Response:", response.data);

        if (response.data.success) {
            res.json({ 
                url: response.data.data.instrumentResponse.redirectInfo.url,
                transactionId: transactionId 
            });
        } else {
            console.error("❌ PhonePe Error:", response.data);
            res.status(500).json({ error: "Payment Gateway Rejected Request" });
        }

    } catch (error) {
        // Detailed Error Logging
        if (error.response) {
            console.error("❌ Axios Error:", error.response.status, error.response.data);
            res.status(500).json({ error: error.response.data.message || "Payment Gateway Error" });
        } else {
            console.error("❌ Internal Server Error:", error.message);
            res.status(500).json({ error: "Internal Server Error during Payment" });
        }
    }
});

// ==================================================================
// 2. PAYMENT CALLBACK & VERIFICATION
// ==================================================================
router.post('/callback/:txnId/:planKey/:userId', async (req, res) => {
    const { txnId, planKey, userId } = req.params;
    
    console.log(`🔄 Callback Received for TXN: ${txnId}`);

    const stringToHash = `/pg/v1/status/${MERCHANT_ID}/${txnId}` + SALT_KEY;
    const sha256Value = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const xVerify = sha256Value + "###" + SALT_INDEX;

    try {
        const statusResponse = await axios.get(`${HOST_URL}/pg/v1/status/${MERCHANT_ID}/${txnId}`, {
            headers: {
                'Content-Type': 'application/json',
                'X-MERCHANT-ID': MERCHANT_ID,
                'X-VERIFY': xVerify
            }
        });

        if (statusResponse.data.code === 'PAYMENT_SUCCESS') {
            const plan = PLANS[planKey];
            
            // ✅ Success: Update DB
            // We set jobpostcount = 0 so they get a fresh start with their new limit
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

            // Log Transaction
            try {
                await pool.query(
                    `INSERT INTO payments (amount, status, transaction_id, user_id) VALUES ($1, 'success', $2, $3)`,
                    [plan.amount, txnId, userId]
                );
            } catch(dbErr) {
                console.warn("⚠️ Could not log payment history (non-critical):", dbErr.message);
            }

            console.log(`✅ Payment Verified & User Upgraded: ${userId}`);
            res.redirect(`https://hirehive.in/#dashboard?status=success&plan=${planKey}`);
        } else {
            console.warn(`⚠️ Payment Failed/Pending: ${statusResponse.data.code}`);
            res.redirect(`https://hirehive.in/#dashboard?status=failed`);
        }

    } catch (error) {
        console.error("❌ Verification Error:", error.message);
        res.redirect(`https://hirehive.in/#dashboard?status=error`);
    }
});

export default router;