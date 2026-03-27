import { Router } from 'express';
import {
  getUserById,
  touchVisit,
  getAppliedJobs,
  getAppliedJobDetails,
  addAppliedJob,
  removeAppliedJob,
  updateSkills,
  getComeBackTo,
  upsertComeBackTo,
  removeComeBackTo,
  setDailyGoal,
  updateAppliedJobStage,
  getDismissedJobs,
  addDismissedJob,
  removeDismissedJob,
} from '../models/userModel.js';

const router = Router();

// All routes assume req.user.userId is set by auth middleware

// GET / — returns user profile + dismissed IDs for initial load
router.get('/', async (req, res) => {
  try {
    const [user, dismissedJobs] = await Promise.all([
      getUserById(req.user.userId),
      getDismissedJobs(req.user.userId),
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      name: user.name,
      email: user.email,
      picture: user.picture,
      slug: user.slug,
      skills: Array.isArray(user.skills) ? user.skills : [],
      dailyGoal: typeof user.dailyGoal === 'number' ? user.dailyGoal : 5,
      appliedCount: typeof user.appliedCount === 'number' ? user.appliedCount : 0,
      dismissedJobIds: Array.isArray(dismissedJobs) ? dismissedJobs : [],
    });
  } catch (err) {
    console.error('[me] GET / error:', err);
    res.status(500).json({ error: 'Failed to load user data' });
  }
});

router.patch('/visit', async (req, res) => {
  try {
    const result = await touchVisit(req.user.userId);
    if (!result) return res.status(404).json({ error: 'User not found' });
    res.json(result);
  } catch (err) {
    console.error('[me] PATCH /visit error:', err);
    res.status(500).json({ error: 'Failed to update visit' });
  }
});

router.get('/applied', async (req, res) => {
  try {
    const jobs = await getAppliedJobs(req.user.userId);
    res.json(Array.isArray(jobs) ? jobs : []);
  } catch (err) {
    console.error('[me] GET /applied error:', err);
    res.status(500).json({ error: 'Failed to fetch applied jobs' });
  }
});

router.get('/applied/details', async (req, res) => {
  try {
    const jobs = await getAppliedJobDetails(req.user.userId);
    res.json(Array.isArray(jobs) ? jobs : []);
  } catch (err) {
    console.error('[me] GET /applied/details error:', err);
    res.status(500).json({ error: 'Failed to fetch applied job details' });
  }
});

router.post('/applied/:jobId', async (req, res) => {
  try {
    const { findJobById } = await import('../Db/databaseManager.js');
    let jobSnapshot = {};
    try {
      const job = await findJobById(req.params.jobId);
      if (job) {
        jobSnapshot = {
          jobTitle: job.JobTitle || null,
          company: job.Company || null,
          applicationURL: job.DirectApplyURL || job.ApplicationURL || null,
          location: job.Location || null,
          department: job.Department || null,
        };
      }
    } catch {
      // If job fetch fails, fallback to empty snapshot (snapshot is optional)
      jobSnapshot = {};
    }
    const jobs = await addAppliedJob(req.user.userId, req.params.jobId, jobSnapshot);
    res.json(Array.isArray(jobs) ? jobs : []);
  } catch (err) {
    console.error('[me] POST /applied error:', err);
    res.status(500).json({ error: 'Failed to mark job as applied' });
  }
});

router.delete('/applied/:jobId', async (req, res) => {
  try {
    const jobs = await removeAppliedJob(req.user.userId, req.params.jobId);
    res.json(Array.isArray(jobs) ? jobs : []);
  } catch (err) {
    console.error('[me] DELETE /applied error:', err);
    res.status(500).json({ error: 'Failed to remove applied job' });
  }
});

// PATCH /applied/:jobId/stage — update pipeline stage
router.patch('/applied/:jobId/stage', async (req, res) => {
  try {
    const { stage } = req.body;
    if (!stage || typeof stage !== 'string') {
      return res.status(400).json({ error: 'stage is required' });
    }
    const validStages = ['applied', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'ghosted'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage. Must be one of: ' + validStages.join(', ') });
    }
    const applied = await updateAppliedJobStage(req.user.userId, req.params.jobId, stage);
    if (applied === null) {
      return res.status(404).json({ error: 'User or applied job not found' });
    }
    res.json(applied);
  } catch (err) {
    console.error('[me] PATCH applied stage error:', err);
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

router.put('/skills', async (req, res) => {
  try {
    const raw = req.body.skills;
    const skills = Array.isArray(raw) ? raw.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()).slice(0, 100) : [];
    const result = await updateSkills(req.user.userId, skills);
    res.json(Array.isArray(result) ? result : []);
  } catch (err) {
    console.error('[me] PUT /skills error:', err);
    res.status(500).json({ error: 'Failed to update skills' });
  }
});

router.patch('/skills', async (req, res) => {
  try {
    const raw = req.body.skills;
    const skills = Array.isArray(raw) ? raw.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()).slice(0, 100) : [];
    const result = await updateSkills(req.user.userId, skills);
    res.json(Array.isArray(result) ? result : []);
  } catch (err) {
    console.error('[me] PATCH /skills error:', err);
    res.status(500).json({ error: 'Failed to update skills' });
  }
});

router.get('/comeback', async (req, res) => {
  try {
    const cb = await getComeBackTo(req.user.userId);
    res.json(Array.isArray(cb) ? cb : []);
  } catch (err) {
    console.error('[me] GET /comeback error:', err);
    res.status(500).json({ error: 'Failed to fetch comeback list' });
  }
});

router.post('/comeback/:jobId', async (req, res) => {
  try {
    const note = typeof req.body.note === 'string' ? req.body.note.slice(0, 200) : '';
    const cb = await upsertComeBackTo(req.user.userId, req.params.jobId, note);
    res.json(Array.isArray(cb) ? cb : []);
  } catch (err) {
    console.error('[me] POST /comeback error:', err);
    res.status(500).json({ error: 'Failed to save comeback' });
  }
});

router.delete('/comeback/:jobId', async (req, res) => {
  try {
    const cb = await removeComeBackTo(req.user.userId, req.params.jobId);
    res.json(Array.isArray(cb) ? cb : []);
  } catch (err) {
    console.error('[me] DELETE /comeback error:', err);
    res.status(500).json({ error: 'Failed to remove comeback' });
  }
});

router.patch('/goal', async (req, res) => {
  try {
    const goal = await setDailyGoal(req.user.userId, req.body.goal);
    if (goal === null) return res.status(404).json({ error: 'User not found' });
    res.json({ dailyGoal: goal });
  } catch (err) {
    console.error('[me] PATCH /goal error:', err);
    res.status(500).json({ error: 'Failed to update daily goal' });
  }
});

// GET /dismissed — return the user's dismissed job IDs
router.get('/dismissed', async (req, res) => {
  try {
    const ids = await getDismissedJobs(req.user.userId);
    res.json(Array.isArray(ids) ? ids : []);
  } catch (err) {
    console.error('[me] GET /dismissed error:', err);
    res.status(500).json({ error: 'Failed to fetch dismissed jobs' });
  }
});

// POST /dismissed/:jobId — dismiss a job
router.post('/dismissed/:jobId', async (req, res) => {
  try {
    const ids = await addDismissedJob(req.user.userId, req.params.jobId);
    res.json(Array.isArray(ids) ? ids : []);
  } catch (err) {
    console.error('[me] POST /dismissed error:', err);
    res.status(500).json({ error: 'Failed to dismiss job' });
  }
});

// DELETE /dismissed/:jobId — undo a dismiss
router.delete('/dismissed/:jobId', async (req, res) => {
  try {
    const ids = await removeDismissedJob(req.user.userId, req.params.jobId);
    res.json(Array.isArray(ids) ? ids : []);
  } catch (err) {
    console.error('[me] DELETE /dismissed error:', err);
    res.status(500).json({ error: 'Failed to undo dismiss' });
  }
});

export default router;
