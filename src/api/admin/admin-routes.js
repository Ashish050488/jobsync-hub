// FILE: src/api/admin/admin-routes.js
// Admin router index. Applies auth (requireSeeker + requireAdmin) once, then
// mounts the sub-routers. Mounted at /api/admin by server.js — the public URLs
// (e.g. /api/admin/reclean-descriptions) are unchanged from before the refactor.

import { Router } from 'express';
import { requireSeeker, requireAdmin } from '../../middleware/require-seeker-middleware.js';
import recleanRouter from './reclean-routes.js';
import employerAccessRouter from './employer-access-routes.js';

const router = Router();

// Every admin endpoint requires both: a valid seeker auth cookie AND admin email.
router.use(requireSeeker, requireAdmin);

router.use('/', recleanRouter);
router.use('/', employerAccessRouter);

export default router;
