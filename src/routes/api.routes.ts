import { Router } from 'express';
import multer from 'multer';
import * as apiController from '../controllers/api.controller.js';
import * as syncController from '../controllers/sync.controller.js';
import {
  requireApiaryForSave,
  requireApiaryFromBody,
  requireApiaryFromParams,
  requireApiaryFromQuery,
  requireBoxFromParams,
  requireManejoFromParams,
  requireRecordTargetFromBody,
  requireRevisionFromParams,
} from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import {
  acceptTermsBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  updateProfileBodySchema,
} from '../validators/auth.schema.js';
import { createBoxBodySchema, listBoxesQuerySchema, renameBoxBodySchema, saveApiaryBodySchema } from '../validators/apiary.schema.js';
import { idParamsSchema } from '../validators/common.schema.js';
import { createNotificationBodySchema, uploadBase64BodySchema } from '../validators/misc.schema.js';
import {
  listRecordsQuerySchema,
  saveManejoBodySchema,
  saveRevisionBodySchema,
  updateManejoBodySchema,
  updateRevisionBodySchema,
} from '../validators/record.schema.js';
import { syncChangesQuerySchema, syncPushBodySchema } from '../validators/sync.schema.js';

const router = Router();

/**
 * Ordem em cada rota: validate() (formato) → require*() (posse) → controller.
 * Rotas que só recebem `:id`.
 */
const withId = validate({ params: idParamsSchema });

// Auth
router.post('/auth/register', validate({ body: registerBodySchema }), apiController.registerController);
router.post('/auth/login', validate({ body: loginBodySchema }), apiController.loginController);
router.get('/auth/me', apiController.meController);
router.post('/auth/logout', apiController.logoutController);
router.put('/auth/profile', validate({ body: updateProfileBodySchema }), apiController.updateProfileController);
// Três rotas para o mesmo aceite: versões diferentes do app usam cada uma.
router.patch('/auth/accept-terms', validate({ body: acceptTermsBodySchema }), apiController.acceptTermsController);
router.post('/auth/accept-terms', validate({ body: acceptTermsBodySchema }), apiController.acceptTermsController);
router.post('/auth/terms', validate({ body: acceptTermsBodySchema }), apiController.acceptTermsController);
router.post('/auth/forgot-password', validate({ body: forgotPasswordBodySchema }), apiController.forgotPasswordController);
router.post('/auth/reset-password', validate({ body: resetPasswordBodySchema }), apiController.resetPasswordController);

// Sync: só os dados do usuário logado (cada consulta filtra pelo dono).
router.get('/sync/changes', validate({ query: syncChangesQuerySchema }), syncController.getSyncChangesController);
// A posse de cada item é conferida no syncPushService (o lote mistura vários registros).
router.post('/sync', validate({ body: syncPushBodySchema }), syncController.pushSyncController);

// Apiaries
router.get('/apiaries', apiController.listApiariesController);
router.get('/apiaries/:id', withId, requireApiaryFromParams, apiController.getApiaryController);
router.post('/apiaries', validate({ body: saveApiaryBodySchema }), requireApiaryForSave, apiController.saveApiaryController);
router.delete('/apiaries/:id', withId, requireApiaryFromParams, apiController.deleteApiaryController);

// Boxes
router.get('/boxes', validate({ query: listBoxesQuerySchema }), requireApiaryFromQuery, apiController.listBoxesController);
router.post('/boxes', validate({ body: createBoxBodySchema }), requireApiaryFromBody, apiController.createBoxController);
router.put('/boxes/:id/rename', validate({ params: idParamsSchema, body: renameBoxBodySchema }), requireBoxFromParams, apiController.renameBoxController);
router.delete('/boxes/:id', withId, requireBoxFromParams, apiController.deleteBoxController);
router.post('/boxes/:id/archive', withId, requireBoxFromParams, apiController.archiveBoxController);
router.post('/boxes/:id/unarchive', withId, requireBoxFromParams, apiController.unarchiveBoxController);

// Revisions
router.get('/revisions', validate({ query: listRecordsQuerySchema }), requireApiaryFromQuery, apiController.listRevisionsController);
router.post('/revisions', validate({ body: saveRevisionBodySchema }), requireRecordTargetFromBody, apiController.saveRevisionController);
router.put('/revisions/:id', validate({ params: idParamsSchema, body: updateRevisionBodySchema }), requireRevisionFromParams, apiController.updateRevisionController);
router.delete('/revisions/:id', withId, requireRevisionFromParams, apiController.deleteRevisionController);
router.post('/revisions/:id/archive', withId, requireRevisionFromParams, apiController.archiveRevisionController);
router.post('/revisions/:id/unarchive', withId, requireRevisionFromParams, apiController.unarchiveRevisionController);

// Manejos
router.get('/manejos', validate({ query: listRecordsQuerySchema }), requireApiaryFromQuery, apiController.listManejosController);
router.post('/manejos', validate({ body: saveManejoBodySchema }), requireRecordTargetFromBody, apiController.saveManejoController);
router.put('/manejos/:id', validate({ params: idParamsSchema, body: updateManejoBodySchema }), requireManejoFromParams, apiController.updateManejoController);
router.delete('/manejos/:id', withId, requireManejoFromParams, apiController.deleteManejoController);
router.post('/manejos/:id/archive', withId, requireManejoFromParams, apiController.archiveManejoController);
router.post('/manejos/:id/unarchive', withId, requireManejoFromParams, apiController.unarchiveManejoController);

// Notifications
router.get('/notifications', apiController.listNotificationsController);
router.post('/notifications', validate({ body: createNotificationBodySchema }), apiController.createNotificationController);
// read-all antes de :id/read não importa (segmentos diferentes), mas :id precisa ser número.
router.put('/notifications/read-all', apiController.markAllNotificationsReadController);
router.put('/notifications/:id/read', withId, apiController.markNotificationReadController);

// Uploads / Storage
const uploadManejoMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo inválido. Permitido apenas JPEG, PNG e WEBP.'));
    }
  },
});

router.post(
  '/upload/manejo-photo',
  (req, res, next) => {
    uploadManejoMulter.single('photo')(req, res, (err: unknown) => {
      if (err) {
        const multerError = err as { code?: string; message?: string };
        if (multerError.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ message: 'A imagem deve ter no máximo 5MB.' });
          return;
        }
        res.status(400).json({ message: multerError.message || 'Erro no upload do arquivo.' });
        return;
      }
      next();
    });
  },
  apiController.uploadManejoPhotoController
);

router.post('/upload', validate({ body: uploadBase64BodySchema }), apiController.uploadController);

export { router as apiRouter };
