import * as service from '../services/facturas.service.js';

export async function crear(req, res, next) {
  try { res.status(201).json(await service.crearFactura(req.body)); }
  catch (err) { next(err); }
}

export async function obtener(req, res, next) {
  try { res.json(await service.obtenerFacturaPorId(Number(req.params.id))); }
  catch (err) { next(err); }
}

export async function listar(req, res, next) {
  try {
    res.json(await service.listarFacturas({
      estado: req.query.estado,
      cliente_id: req.query.cliente_id ? Number(req.query.cliente_id) : undefined,
      desde: req.query.desde,
      hasta: req.query.hasta,
      q: req.query.q,
    }));
  } catch (err) { next(err); }
}

export async function anular(req, res, next) {
  try { res.json(await service.anularFactura(Number(req.params.id), req.body)); }
  catch (err) { next(err); }
}