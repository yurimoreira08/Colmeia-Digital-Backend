import { Router } from 'express';
import { getReportsStatsController } from '../controllers/reports.controller.js';

const reportsRouter = Router();

reportsRouter.post('/stats', getReportsStatsController);

export { reportsRouter };
