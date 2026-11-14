import { Router } from 'express';
import { getReportsStatsController } from '../controllers/reports.controller.js';
import { validate } from '../middlewares/validate.js';
import { reportsStatsBodySchema } from '../validators/misc.schema.js';

const reportsRouter = Router();

reportsRouter.post('/stats', validate({ body: reportsStatsBodySchema }), getReportsStatsController);

export { reportsRouter };
