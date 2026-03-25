import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { GOOGLE_CLIENT_ID, JWT_SECRET } from '../env.js';
import { findOrCreateGoogleUser, getUserById } from '../models/userModel.js';

const router = Router();
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// POST /api/auth/google
router.post('/google', async (req, res) => {
	const { credential } = req.body;
	if (!credential) return res.status(400).json({ error: 'Missing credential' });
	try {
		const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
		const payload = ticket.getPayload();
		if (!payload) return res.status(401).json({ error: 'Invalid Google token' });
		const { sub: googleId, email, name, picture } = payload;
		if (!googleId || !email || !name) return res.status(401).json({ error: 'Incomplete Google profile' });
		const user = await findOrCreateGoogleUser({ googleId, email, name, picture });
		const token = jwt.sign({ userId: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
		res.cookie('tj_token', token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60 * 1000,
			path: '/',
		});
		res.json({ user: { name: user.name, email: user.email, picture: user.picture, slug: user.slug } });
	} catch (err) {
		res.status(401).json({ error: 'Google authentication failed' });
	}
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
	res.clearCookie('tj_token', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
	});
	res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
	const token = req.cookies?.tj_token;
	if (!token) return res.status(401).json({ error: 'Unauthorized' });
	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		const user = await getUserById(decoded.userId);
		if (!user) return res.status(401).json({ error: 'Unauthorized' });
		res.json({
			name: user.name,
			email: user.email,
			picture: user.picture,
			slug: user.slug,
			skills: user.skills,
			dailyGoal: user.dailyGoal,
			appliedCount: user.appliedCount,
		});
	} catch {
		res.status(401).json({ error: 'Unauthorized' });
	}
});

export default router;
