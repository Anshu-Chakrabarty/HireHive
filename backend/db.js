import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Environment Safety Check
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERROR: Supabase environment variables missing!");
} else {
    console.log("🔗 Connecting to Supabase Database...");
}

// Initialize Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false, // Prevent server-side session caching issues
    },
});

// 🔍 Connection Verification (Async)
(async() => {
    try {
        const { data, error } = await supabase.from("users").select("id").limit(1);
        if (error) {
            console.error("⚠️ Supabase Test Query Failed:", error.message);
        } else {
            console.log("🟢 Supabase Connected Successfully!");
        }
    } catch (err) {
        console.error("🔥 Supabase Initialization Failure:", err.message);
    }
})();