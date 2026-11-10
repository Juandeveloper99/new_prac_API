import { Router } from 'express';
import * as ctrl from '../controllers/recetas.controller.js';
import { validate } from '../middlewares/validate.js';
import { crearRecetaSchema, actualizarRecetaSchema } from '../validators/receta.schema.js';

const router = Router();

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', validate(crearRecetaSchema), ctrl.crear);
router.put('/:id', validate(actualizarRecetaSchema), ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

export default router;