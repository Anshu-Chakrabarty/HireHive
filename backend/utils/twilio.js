import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Load credentials from environment variables
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SID;
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const TWILIO_BASE_URL = `https://verify.twilio.com/v2/Services/${VERIFY_SERVICE_SID}`;
// Create Basic Auth header (Base64 encoding of SID:Token)
const AUTH_HEADER = 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');

/**
 * Initiates the SMS verification process via Twilio Verify.
 * @param {string} toPhoneNumber - Phone number in E.164 format (e.g., +917477800284)
 */
export async function startVerification(toPhoneNumber) {
    const url = `${TWILIO_BASE_URL}/Verifications`;
    const body = new URLSearchParams({
        To: toPhoneNumber,
        Channel: 'sms',
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': AUTH_HEADER,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("Twilio Start Verification Error:", data);
        // Twilio often returns messages in data.message or data.detail
        throw new Error(data.message || data.detail || "Failed to start phone verification. Check API configuration.");
    }
    return data;
}

/**
 * Checks the verification code entered by the user.
 * @param {string} toPhoneNumber - Phone number in E.164 format.
 * @param {string} code - The 6-digit code provided by the user.
 */
export async function checkVerification(toPhoneNumber, code) {
    const url = `${TWILIO_BASE_URL}/VerificationChecks`;
    const body = new URLSearchParams({
        To: toPhoneNumber,
        Code: code,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': AUTH_HEADER,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok || data.status !== 'approved') {
        // Twilio failed the verification (invalid/expired code or API error)
        console.error("Twilio Check Verification Failure:", data);
        throw new Error(data.message || data.detail || "Invalid or expired verification code.");
    }
    return data; // Returns status 'approved'
}