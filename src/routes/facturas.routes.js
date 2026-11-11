import { Router } from 'express';
import * as ctrl from '../controllers/facturas.controller.js';
import { validate } from '../middlewares/validate.js';
import { crearFacturaSchema, anularFacturaSchema } from '../validators/factura.schema.js';

const router = Router();

router.get('/', ctrl.listar);                              // ← línea 8
router.get('/:id', ctrl.obtener);
router.post('/', validate(crearFacturaSchema), ctrl.crear);
router.post('/:id/anular', validate(anularFacturaSchema), ctrl.anular);

export default router;