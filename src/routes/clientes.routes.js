import { Router } from 'express';
import * as ctrl from '../controllers/clientes.controller.js';
import { validate } from '../middlewares/validate.js';
import { crearClienteSchema, actualizarClienteSchema } from '../validators/cliente.schema.js';

const router = Router();

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', validate(crearClienteSchema), ctrl.crear);
router.put('/:id', validate(actualizarClienteSchema), ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

export default router;