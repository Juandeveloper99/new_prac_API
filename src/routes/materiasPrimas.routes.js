import { Router } from 'express';
import * as ctrl from '../controllers/materiasPrimas.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  crearMateriaPrimaSchema,
  actualizarMateriaPrimaSchema,
  entradaStockSchema,
} from '../validators/materiaPrima.schema.js';

const router = Router();

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', validate(crearMateriaPrimaSchema), ctrl.crear);
router.put('/:id', validate(actualizarMateriaPrimaSchema), ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);
router.post('/:id/entrada-stock', validate(entradaStockSchema), ctrl.entradaStock);

export default router;