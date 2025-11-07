import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import seekerRoutes from "./routes/seeker.js";
import employerRoutes from "./routes/employer.js";
import contactRoutes from "./routes/contact.js";

dotenv.config();

// --- CRITICAL STARTUP CHECK (MODIFIED) ---
if (!process.env.JWT_SECRET) {
    console.error("CRITICAL ERROR: JWT_SECRET environment variable is missing.");
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error(
        "CRITICAL ERROR: Supabase configuration environment variables is missing."
    );
}
// NEW CHECK FOR RAZORPAY
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn(
        "WARNING: Razorpay environment variables are missing. Payment API will fail."
    );
}

console.log(`Server starting on Node version: ${process.version}`);
console.log(`Running in environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Attempting to bind to PORT: ${process.env.PORT || 5005}`);

const app = express();

// --- Middleware Setup ---
const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    process.env.CLIENT_ORIGIN,
    "https://hirehive.in",
    "https://www.hirehive.in",
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            if (
                allowedOrigins.includes(origin) ||
                origin.endsWith(".onrender.com") ||
                origin.endsWith(".vercel.app")
            ) {
                callback(null, true);
            } else {
                console.warn(`CORS blocked request from origin: ${origin}`);
                callback(new Error(`Not allowed by CORS: ${origin}`), false);
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json());

// --- Status Check Endpoints ---
app.get("/api/status", (req, res) => {
    res.json({
        message: "HireHive API is alive and running!",
        port: process.env.PORT || 5005,
    });
});
app.get("/", (req, res) => res.send("HireHive API is running."));

// --- Route Mounting ---
app.use("/api/auth", authRoutes);
app.use("/api/seeker", seekerRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/contact", contactRoutes);

const PORT = process.env.PORT || 5005;

app.listen(PORT, () =>
    console.log(`Server successfully running and listening on port ${PORT}`)
);