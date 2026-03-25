import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../env.js';

export function authenticate(req, res, next) {
	const token = req.cookies?.tj_token;
	if (!token) return res.status(401).json({ error: 'Unauthorized' });
	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		req.user = { userId: decoded.userId, email: decoded.email };
		next();
	} catch {
		return res.status(401).json({ error: 'Unauthorized' });
	}
}

export const requireAuth = authenticate;
export const isAdmin = (req, res, next) => next(); // TODO: implement admin check if needed
export default authenticate;
