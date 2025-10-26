// --- Backend: index.js (REPLACE ENTIRE FILE) ---
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import seekerRoutes from './routes/seeker.js';
import employerRoutes from './routes/employer.js';

dotenv.config();

const app = express();

// --- Middleware Setup ---
// Define the allowed origins dynamically. 
const allowedOrigins = [
    'http://127.0.0.1:5500', // Local Dev (Live Server)
    'http://localhost:3000', // Standard Dev port
    process.env.CLIENT_ORIGIN // Your live Vercel domain (must be set in Render environment variables)
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            if (origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app')) {
                callback(null, true);
            } else {
                callback(new Error(`Not allowed by CORS: ${origin}`), false);
            }
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// --- Status Check Endpoint ---
app.get('/api/status', (req, res) => {
    res.json({
        message: 'HireHive API is running!',
        port: process.env.PORT || 5000
    });
});

// --- Route Mounting ---
app.use('/api/auth', authRoutes);
app.use('/api/seeker', seekerRoutes);
app.use('/api/employer', employerRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));