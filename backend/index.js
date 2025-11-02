import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import seekerRoutes from './routes/seeker.js';
import employerRoutes from './routes/employer.js';

dotenv.config();

const app = express();

// --- Middleware Setup ---
const allowedOrigins = [
    'http://127.0.0.1:5500', // Local Dev
    'http://localhost:3000', // Standard Dev port
    process.env.CLIENT_ORIGIN, // Vercel Preview URL (If set)
    'https://hirehive.in', // Working domain
    'https://www.hirehive.in'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error(`Not allowed by CORS: ${origin}`), false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// --- Status Check Endpoint (Consolidated) ---
app.get('/api/status', (req, res) => {
    res.json({
        message: 'HireHive API is alive and running!',
        port: process.env.PORT || 5000
    });
});
// Simple root check
app.get('/', (req, res) => res.send('HireHive API is running.'));

// --- Route Mounting ---
app.use('/api/auth', authRoutes);
app.use('/api/seeker', seekerRoutes);
app.use('/api/employer', employerRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));