import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// --- CONFIGURATION ---
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;
const HOST_URL = process.env.PHONEPE_HOST_URL || "https://api.phonepe.com/apis/hermes";

// --- PLAN DETAILS ---
const PLANS = {
    'worker': { amount: 1999, name: "Worker Plan", limit: 5 },
    'colony': { amount: 4999, name: "Colony Plan", limit: 15 },
    'queen': { amount: 8999, name: "Queen Plan", limit: 30 },
    'hive_master': { amount: 14999, name: "Hive Master Plan", limit: 9999 }
};

// 1. INITIATE PAYMENT (Production)
router.post('/pay', async (req, res) => {
    try {
        const { planKey, userId } = req.body;
        const plan = PLANS[planKey];

        if (!plan) return res.status(400).json({ error: "Invalid Plan Selected" });
        if (!MERCHANT_ID || !SALT_KEY) return res.status(500).json({ error: "Server missing Payment Credentials" });

        const transactionId = "TXN_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        const amountInPaise = plan.amount * 100; 

        // User ID must be alphanumeric without special chars for PhonePe
        const cleanUserId = "USER" + userId.replace(/-/g, "").substring(0, 10);

        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: cleanUserId,
            amount: amountInPaise,
            // The URL where PhonePe sends the user after payment (Success or Failure)
            redirectUrl: `https://hirehive-api.onrender.com/api/payment/callback/${transactionId}/${planKey}/${userId}`,
            redirectMode: "POST", 
            // The Server-to-Server webhook (Optional but recommended)
            callbackUrl: `https://hirehive-api.onrender.com/api/payment/callback/${transactionId}/${planKey}/${userId}`,
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        // Encoding
        const bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
        const base64EncodedPayload = bufferObj.toString("base64");

        // X-VERIFY Checksum Calculation
        const stringToHash = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
        const sha256Value = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const xVerify = sha256Value + "###" + SALT_INDEX;

        const response = await axios.post(`${HOST_URL}/pg/v1/pay`, 
            { request: base64EncodedPayload }, 
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': xVerify
                }
            }
        );

        if (response.data.success) {
            res.json({ 
                url: response.data.data.instrumentResponse.redirectInfo.url,
                transactionId: transactionId 
            });
        } else {
            console.error("PhonePe Error:", response.data);
            res.status(500).json({ error: "Payment gateway rejected request" });
        }

    } catch (error) {
        console.error("Initiation Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Payment initiation failed. Check server logs." });
    }
});

// 2. PAYMENT CALLBACK & VERIFICATION
router.post('/callback/:txnId/:planKey/:userId', async (req, res) => {
    const { txnId, planKey, userId } = req.params;
    
    // Status Check Checksum
    const stringToHash = `/pg/v1/status/${MERCHANT_ID}/${txnId}` + SALT_KEY;
    const sha256Value = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const xVerify = sha256Value + "###" + SALT_INDEX;

    try {
        // Force check status with PhonePe Server (Double Check)
        const statusResponse = await axios.get(`${HOST_URL}/pg/v1/status/${MERCHANT_ID}/${txnId}`, {
            headers: {
                'Content-Type': 'application/json',
                'X-MERCHANT-ID': MERCHANT_ID,
                'X-VERIFY': xVerify
            }
        });

        if (statusResponse.data.code === 'PAYMENT_SUCCESS') {
            const plan = PLANS[planKey];
            
            // 1. Update User Subscription in DB
            await pool.query(
                `UPDATE users 
                 SET subscriptionstatus = $1, 
                     subscription_jsonb = jsonb_set(
                        COALESCE(subscription_jsonb, '{}'::jsonb), 
                        '{plan}', 
                        to_jsonb($1::text)
                     ) || '{"active": true}'::jsonb
                 WHERE id = $2`,
                [planKey, userId]
            );

            // 2. Log Transaction in DB
            // Ensure you have a 'payments' table or remove this query if not
            try {
                await pool.query(
                    `INSERT INTO payments (amount, status, transaction_id, user_id) VALUES ($1, 'success', $2, $3)`,
                    [plan.amount, txnId, userId]
                );
            } catch(dbErr) {
                console.warn("Could not log payment history, but subscription updated.", dbErr.message);
            }

            // 3. Redirect User to Frontend Success
            res.redirect(`https://hirehive.in/#dashboard?status=success&plan=${planKey}`);
        } else {
            // Payment Failed or Pending
            res.redirect(`https://hirehive.in/#dashboard?status=failed`);
        }

    } catch (error) {
        console.error("Verification Error:", error.message);
        res.redirect(`https://hirehive.in/#dashboard?status=error`);
    }
});

export default router;