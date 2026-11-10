import * as service from '../services/pagos.service.js';

export async function crear(req, res, next) {
  try { res.status(201).json(await service.crearPago(req.body)); }
  catch (err) { next(err); }
}
export async function listar(req, res, next) {
  try {
    res.json(await service.listarPagos({
      factura_id: req.query.factura_id ? Number(req.query.factura_id) : undefined,
    }));
  } catch (err) { next(err); }
}