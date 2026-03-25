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
  setDailyGoal
} from '../models/userModel.js';

const router = Router();

// All routes assume req.user.userId is set by auth middleware

router.get('/', async (req, res) => {
  const user = await getUserById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    name: user.name,
    email: user.email,
    picture: user.picture,
    slug: user.slug,
    skills: user.skills,
    dailyGoal: user.dailyGoal,
    appliedCount: user.appliedCount,
  });
});

router.patch('/visit', async (req, res) => {
  const result = await touchVisit(req.user.userId);
  if (!result) return res.status(404).json({ error: 'User not found' });
  res.json(result);
});

router.get('/applied', async (req, res) => {
  const jobs = await getAppliedJobs(req.user.userId);
  res.json(jobs || []);
});

router.get('/applied/details', async (req, res) => {
  const jobs = await getAppliedJobDetails(req.user.userId);
  res.json(jobs || []);
});

router.post('/applied/:jobId', async (req, res) => {
  const jobs = await addAppliedJob(req.user.userId, req.params.jobId, req.body || {});
  res.json(jobs || []);
});

router.delete('/applied/:jobId', async (req, res) => {
  const jobs = await removeAppliedJob(req.user.userId, req.params.jobId);
  res.json(jobs || []);
});

router.put('/skills', async (req, res) => {
  const skills = await updateSkills(req.user.userId, req.body.skills || []);
  res.json(skills || []);
});

router.patch('/skills', async (req, res) => {
  const skills = await updateSkills(req.user.userId, req.body.skills || []);
  res.json(skills || []);
});

router.get('/comeback', async (req, res) => {
  const cb = await getComeBackTo(req.user.userId);
  res.json(cb || []);
});

router.post('/comeback/:jobId', async (req, res) => {
  const cb = await upsertComeBackTo(req.user.userId, req.params.jobId, req.body.note || '');
  res.json(cb || []);
});

router.delete('/comeback/:jobId', async (req, res) => {
  const cb = await removeComeBackTo(req.user.userId, req.params.jobId);
  res.json(cb || []);
});

router.patch('/goal', async (req, res) => {
  const goal = await setDailyGoal(req.user.userId, req.body.goal);
  res.json({ dailyGoal: goal });
});

export default router;
