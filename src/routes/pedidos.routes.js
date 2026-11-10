import { Router } from 'express';
import * as ctrl from '../controllers/pedidos.controller.js';
import { validate } from '../middlewares/validate.js';
import { crearPedidoSchema, cambiarEstadoSchema } from '../validators/pedido.schema.js';

const router = Router();

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', validate(crearPedidoSchema), ctrl.crear);
router.patch('/:id/estado', validate(cambiarEstadoSchema), ctrl.cambiarEstado);

export default router;