import { Router } from 'express';
import * as ctrl from '../controllers/reportes.controller.js';

const router = Router();

router.get('/dashboard', ctrl.dashboard);

export default router;
