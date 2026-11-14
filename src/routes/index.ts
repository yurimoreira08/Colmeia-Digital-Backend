import { Router } from 'express';

import { clientIpController, healthController } from '../controllers/reports.controller.js';
import { reportsRouter } from './reports.routes.js';
import { apiRouter } from './api.routes.js';

const router = Router();

router.get('/health', healthController);
router.get('/health/client-ip', clientIpController);
router.use('/reports', reportsRouter);
router.use('/', apiRouter);

export { router };
