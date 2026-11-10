import { Router } from 'express';
import materiasPrimasRoutes from './materiasPrimas.routes.js';
import recetasRoutes from './recetas.routes.js';
import clientesRoutes from './clientes.routes.js';
import pedidosRoutes from './pedidos.routes.js';
import inventarioRoutes from './inventario.routes.js';
import facturasRoutes from './facturas.routes.js';
import pagosRoutes from './pagos.routes.js';

const router = Router();

router.use('/materias-primas', materiasPrimasRoutes);
router.use('/recetas', recetasRoutes);
router.use('/clientes', clientesRoutes);
router.use('/pedidos', pedidosRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/facturas', facturasRoutes);
router.use('/pagos', pagosRoutes);

export default router;