import { Router } from 'express';
import * as apiController from '../controllers/api.controller.js';

const router = Router();

// Auth
router.post('/auth/register', apiController.registerController);
router.post('/auth/login', apiController.loginController);
router.get('/auth/me', apiController.meController);
router.post('/auth/logout', apiController.logoutController);
router.put('/auth/profile', apiController.updateProfileController);
router.post('/auth/terms', apiController.acceptTermsController);
router.post('/auth/forgot-password', apiController.forgotPasswordController);
router.post('/auth/reset-password', apiController.resetPasswordController);

// Apiaries
router.get('/apiaries', apiController.listApiariesController);
router.get('/apiaries/:id', apiController.getApiaryController);
router.post('/apiaries', apiController.saveApiaryController);
router.delete('/apiaries/:id', apiController.deleteApiaryController);

// Boxes
router.get('/boxes', apiController.listBoxesController);
router.post('/boxes', apiController.createBoxController);
router.put('/boxes/:id/rename', apiController.renameBoxController);
router.delete('/boxes/:id', apiController.deleteBoxController);
router.post('/boxes/:id/archive', apiController.archiveBoxController);
router.post('/boxes/:id/unarchive', apiController.unarchiveBoxController);

// Revisions (inspections)
router.get('/revisions', apiController.listRevisionsController);
router.post('/revisions', apiController.saveRevisionController);
router.put('/revisions/:id', apiController.updateRevisionController);
router.delete('/revisions/:id', apiController.deleteRevisionController);
router.post('/revisions/:id/archive', apiController.archiveRevisionController);
router.post('/revisions/:id/unarchive', apiController.unarchiveRevisionController);

// Manejos
router.get('/manejos', apiController.listManejosController);
router.post('/manejos', apiController.saveManejoController);
router.put('/manejos/:id', apiController.updateManejoController);
router.delete('/manejos/:id', apiController.deleteManejoController);
router.post('/manejos/:id/archive', apiController.archiveManejoController);
router.post('/manejos/:id/unarchive', apiController.unarchiveManejoController);

// Notifications
router.get('/notifications', apiController.listNotificationsController);
router.post('/notifications', apiController.createNotificationController);
router.put('/notifications/:id/read', apiController.markNotificationReadController);
router.put('/notifications/read-all', apiController.markAllNotificationsReadController);

// App Config
router.get('/config', apiController.getConfigController);
router.post('/config', apiController.setConfigController);

// Uploads / Storage
router.post('/upload', apiController.uploadController);

export { router as apiRouter };


