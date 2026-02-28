import { Router } from 'express';
import { Analytics } from '../models/analyticsModel.js';
import { verifyToken } from '../middleware/authMiddleware.js'; // Assuming you have this

export const analyticsRouter = Router();

// GET /api/analytics/daily
analyticsRouter.get('/daily', verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's stats
    let stats = await Analytics.findOne({ date: today });
    
    // If no stats yet today (e.g., scraper hasn't run), return zeros
    if (!stats) {
        stats = {
            connectedSources: 0,
            jobsScraped: 0,
            jobsSentToAI: 0,
            jobsPendingReview: 0,
            jobsPublished: 0
        };
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});