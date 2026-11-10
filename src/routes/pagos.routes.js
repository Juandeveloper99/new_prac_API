import { Router } from 'express';
import * as ctrl from '../controllers/pagos.controller.js';
import { validate } from '../middlewares/validate.js';
import { crearPagoSchema } from '../validators/pago.schema.js';

const router = Router();

router.get('/', ctrl.listar);
router.post('/', validate(crearPagoSchema), ctrl.crear);

export default router;