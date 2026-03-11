import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// 1. Verify Token (Is the user logged in?)
export const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: "Access Denied. No token provided." });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified; // Add user info to the request object
        next();
    } catch (err) {
        res.status(400).json({ error: "Invalid Token" });
    }
};