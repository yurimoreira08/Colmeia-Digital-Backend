import { Router } from 'express';

import { healthController } from '../controllers/reports.controller.js';
import { reportsRouter } from './reports.routes.js';
import { apiRouter } from './api.routes.js';

const router = Router();

router.get('/health', healthController);
router.use('/reports', reportsRouter);
router.use('/', apiRouter);

export { router };
