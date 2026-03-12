import { Router } from 'express';
import { getAllUsers, getUserBySlug, createUser, touchVisit, getAppliedJobs, getAppliedJobDetails, addAppliedJob, removeAppliedJob, updateSkills, getComeBackTo, upsertComeBackTo, removeComeBackTo, setDailyGoal } from '../models/userModel.js';

const router = Router();

// GET /api/users — list all (name + slug)
router.get('/', async (_req, res) => {
    try {
        const users = await getAllUsers();
        res.json(users);
    } catch (err) {
        console.error('[users] GET / error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/users — create user { name }
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'name is required' });
        }
        const user = await createUser(name);
        res.status(201).json(user);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'User already exists' });
        }
        console.error('[users] POST / error:', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PATCH /api/users/:slug/visit — touch lastVisitAt, return previous value
router.patch('/:slug/visit', async (req, res) => {
    try {
        const result = await touchVisit(req.params.slug);
        if (!result) return res.status(404).json({ error: 'User not found' });
        res.json(result);
    } catch (err) {
        console.error('[users] PATCH visit error:', err);
        res.status(500).json({ error: 'Failed to update visit' });
    }
});

// GET /api/users/:slug/applied — return appliedJobs array
router.get('/:slug/applied', async (req, res) => {
    try {
        const applied = await getAppliedJobs(req.params.slug);
        if (applied === null) return res.status(404).json({ error: 'User not found' });
        res.json(applied);
    } catch (err) {
        console.error('[users] GET applied error:', err);
        res.status(500).json({ error: 'Failed to fetch applied jobs' });
    }
});

// GET /api/users/:slug/applied/details — return enriched applied job details
router.get('/:slug/applied/details', async (req, res) => {
    try {
        const applied = await getAppliedJobDetails(req.params.slug);
        if (applied === null) return res.status(404).json({ error: 'User not found' });
        res.json(applied);
    } catch (err) {
        console.error('[users] GET applied/details error:', err);
        res.status(500).json({ error: 'Failed to fetch applied job details' });
    }
});

// POST /api/users/:slug/applied/:jobId — add to appliedJobs
router.post('/:slug/applied/:jobId', async (req, res) => {
    try {
        const applied = await addAppliedJob(req.params.slug, req.params.jobId);
        if (applied === null) return res.status(404).json({ error: 'User not found' });
        res.json(applied);
    } catch (err) {
        console.error('[users] POST applied error:', err);
        res.status(500).json({ error: 'Failed to add applied job' });
    }
});

// DELETE /api/users/:slug/applied/:jobId — remove from appliedJobs
router.delete('/:slug/applied/:jobId', async (req, res) => {
    try {
        const applied = await removeAppliedJob(req.params.slug, req.params.jobId);
        if (applied === null) return res.status(404).json({ error: 'User not found' });
        res.json(applied);
    } catch (err) {
        console.error('[users] DELETE applied error:', err);
        res.status(500).json({ error: 'Failed to remove applied job' });
    }
});

// PUT /api/users/:slug/skills — set skills array
router.put('/:slug/skills', async (req, res) => {
    try {
        const { skills } = req.body;
        if (!Array.isArray(skills)) {
            return res.status(400).json({ error: 'skills must be an array' });
        }
        if (skills.length > 30) {
            return res.status(400).json({ error: 'Maximum 30 skills allowed' });
        }
        for (const s of skills) {
            if (typeof s !== 'string' || !s.trim()) {
                return res.status(400).json({ error: 'Each skill must be a non-empty string' });
            }
            if (s.trim().length > 50) {
                return res.status(400).json({ error: 'Each skill must be 50 characters or fewer' });
            }
        }
        // Trim, dedupe case-insensitively (keep first occurrence)
        const seen = new Set();
        const deduped = [];
        for (const s of skills) {
            const trimmed = s.trim();
            const lower = trimmed.toLowerCase();
            if (!seen.has(lower)) {
                seen.add(lower);
                deduped.push(trimmed);
            }
        }
        const updated = await updateSkills(req.params.slug, deduped);
        if (updated === null) return res.status(404).json({ error: 'User not found' });
        res.json({ skills: updated });
    } catch (err) {
        console.error('[users] PUT skills error:', err);
        res.status(500).json({ error: 'Failed to update skills' });
    }
});

// GET /api/users/:slug/comeback — return comeBackTo array
router.get('/:slug/comeback', async (req, res) => {
    try {
        const entries = await getComeBackTo(req.params.slug);
        if (entries === null) return res.status(404).json({ error: 'User not found' });
        res.json(entries);
    } catch (err) {
        console.error('[users] GET comeback error:', err);
        res.status(500).json({ error: 'Failed to fetch comeBackTo jobs' });
    }
});

// POST /api/users/:slug/comeback/:jobId — upsert comeBackTo entry
router.post('/:slug/comeback/:jobId', async (req, res) => {
    try {
        const { note } = req.body;
        const noteStr = typeof note === 'string' ? note.trim().slice(0, 200) : '';
        const entries = await upsertComeBackTo(req.params.slug, req.params.jobId, noteStr);
        if (entries === null) return res.status(404).json({ error: 'User not found' });
        res.json(entries);
    } catch (err) {
        console.error('[users] POST comeback error:', err);
        res.status(500).json({ error: 'Failed to upsert comeBackTo job' });
    }
});

// DELETE /api/users/:slug/comeback/:jobId — remove comeBackTo entry
router.delete('/:slug/comeback/:jobId', async (req, res) => {
    try {
        const entries = await removeComeBackTo(req.params.slug, req.params.jobId);
        if (entries === null) return res.status(404).json({ error: 'User not found' });
        res.json(entries);
    } catch (err) {
        console.error('[users] DELETE comeback error:', err);
        res.status(500).json({ error: 'Failed to remove comeBackTo job' });
    }
});

// PATCH /api/users/:slug/goal — set daily application goal
router.patch('/:slug/goal', async (req, res) => {
    try {
        const { dailyGoal } = req.body;
        if (dailyGoal === undefined) {
            return res.status(400).json({ error: 'dailyGoal is required' });
        }
        const goal = parseInt(dailyGoal);
        if (isNaN(goal) || goal < 1 || goal > 50) {
            return res.status(400).json({ error: 'dailyGoal must be between 1 and 50' });
        }
        const updated = await setDailyGoal(req.params.slug, goal);
        if (updated === null) return res.status(404).json({ error: 'User not found' });
        res.json({ dailyGoal: updated });
    } catch (err) {
        console.error('[users] PATCH goal error:', err);
        res.status(500).json({ error: 'Failed to update daily goal' });
    }
});

// GET /api/users/:slug — full user data
router.get('/:slug', async (req, res) => {
    try {
        const user = await getUserBySlug(req.params.slug);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error('[users] GET /:slug error:', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

export default router;
