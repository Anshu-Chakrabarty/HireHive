import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import seekerRoutes from "./routes/seeker.js";
import employerRoutes from "./routes/employer.js";
import contactRoutes from "./routes/contact.js";

dotenv.config();

const app = express();

// ---------------- ENVIRONMENT SAFETY CHECKS ----------------
console.log(`\n🚀 HireHive API Booting…`);
console.log(`Node: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

if (!process.env.JWT_SECRET) console.error("❌ JWT_SECRET missing!");
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    console.error("❌ Supabase keys missing!");

const PORT = process.env.PORT || 5005;

// ---------------- CORS POLICY (STRICT PRODUCTION) ----------------
const allowedOrigins = [
    "https://hirehive.vercel.app",
    "https://www.hirehive.vercel.app",
    "https://hirehive.in",
    "https://www.hirehive.in",
];

app.use(
    cors({
        origin: function(origin, callback) {
            if (!origin) return callback(null, true);

            if (
                allowedOrigins.includes(origin) ||
                origin.endsWith(".onrender.com")
            ) {
                callback(null, true);
            } else {
                console.warn(`🔒 CORS BLOCKED → ${origin}`);
                callback(new Error("Not allowed by CORS"), false);
            }
        },
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PUT", "DELETE"],
    })
);

app.use(express.json());

// ---------------- STATUS & BASE CHECKS ----------------
app.get("/", (req, res) => {
    res.send("HireHive Backend Running… ✨");
});

app.get("/api/status", (req, res) => {
    res.json({
        status: "online",
        node: process.version,
        port: PORT,
        frontend: "hirehive.vercel.app",
    });
});

// ---------------- API ROUTE BINDING ----------------
app.use("/api/auth", authRoutes);
app.use("/api/seeker", seekerRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/contact", contactRoutes);

// ---------------- ERROR HANDLER ----------------
app.use((err, req, res, next) => {
    console.error("🔥 ERROR →", err.message);
    res.status(500).json({ error: "Internal server error" });
});

// ---------------- SERVER LISTENING ----------------
app.listen(PORT, () => {
    console.log(`\n✅ HireHive API Live → PORT: ${PORT}`);
    console.log(`🌐 Allowed Origins:`);
    allowedOrigins.forEach(o => console.log("   → " + o));
});