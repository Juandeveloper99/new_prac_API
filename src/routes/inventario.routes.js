import { Router } from 'express';
import * as ctrl from '../controllers/inventario.controller.js';
import { validate } from '../middlewares/validate.js';
import { ajusteStockSchema } from '../validators/inventario.schema.js';

const router = Router();

router.get('/', ctrl.ver);
router.get('/bajo-stock', ctrl.bajoStock);
router.get('/movimientos', ctrl.movimientos);
router.post('/:materiaPrimaId/ajuste-positivo', validate(ajusteStockSchema), ctrl.ajustePositivo);
router.post('/:materiaPrimaId/ajuste-negativo', validate(ajusteStockSchema), ctrl.ajusteNegativo);

export default router;