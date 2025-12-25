import jwt from 'jsonwebtoken';
import { pool } from '../db.js'; // <--- KEY CHANGE: Import the shared connection
import dotenv from 'dotenv';

dotenv.config();

const adminAuth = async(req, res, next) => {
    try {
        // 1. Get the header safely
        const authHeader = req.header('Authorization');

        // 2. Check if header exists
        if (!authHeader) {
            return res.status(401).json({ error: 'Access Denied: No Token Provided' });
        }

        // 3. Clean the token (Remove "Bearer " if it exists)
        const token = authHeader.replace('Bearer ', '').trim();

        // 4. Verify Token
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is missing in environment variables");
            return res.status(500).json({ error: 'Server Configuration Error' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 5. Check Database for Admin Role
        // Now using the shared 'pool' which is guaranteed to be connected correctly
        const result = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userRole = result.rows[0].role;

        // 6. Allow if Admin, Super Admin, or Sales
        const allowedRoles = ['admin', 'super_admin', 'sales'];

        if (allowedRoles.includes(userRole)) {
            req.user = decoded;
            req.user.role = userRole;
            next();
        } else {
            return res.status(403).json({ error: `Access Denied. Role is: ${userRole}` });
        }

    } catch (err) {
        console.error("Admin Auth Error:", err.message);
        // This will now show the REAL error to the frontend if something goes wrong
        res.status(401).json({ error: `Invalid Token: ${err.message}` });
    }
};

export default adminAuth;