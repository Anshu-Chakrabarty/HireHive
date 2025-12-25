import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// We create a connection just for this check to ensure it's fresh
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const adminAuth = async(req, res, next) => {
    try {
        // 1. Get the header safely
        const authHeader = req.header('Authorization');

        // 2. Check if header exists
        if (!authHeader) {
            return res.status(401).json({ error: 'Access Denied: No Token Provided' });
        }

        // 3. Clean the token (Remove "Bearer " if it exists)
        const token = authHeader.replace('Bearer ', '');

        // 4. Verify Token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 5. Check Database for Admin Role
        // This 'users' table must exist from your main app
        const result = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userRole = result.rows[0].role;

        // 6. Allow if Admin, Super Admin, or Sales
        const allowedRoles = ['admin', 'super_admin', 'sales'];

        // We use simple .includes() for safety
        if (allowedRoles.includes(userRole)) {
            req.user = decoded;
            req.user.role = userRole;
            next();
        } else {
            return res.status(403).json({ error: 'Access Forbidden: Admins Only' });
        }

    } catch (err) {
        console.error("Admin Auth Error:", err.message);
        res.status(401).json({ error: 'Invalid Token' });
    }
};

export default adminAuth;