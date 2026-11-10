import * as service from '../services/clientes.service.js';

export async function listar(req, res, next) {
  try {
    res.json(await service.listar({ q: req.query.q }));
  } catch (err) { next(err); }
}
export async function obtener(req, res, next) {
  try { res.json(await service.obtenerPorId(Number(req.params.id))); }
  catch (err) { next(err); }
}
export async function crear(req, res, next) {
  try { res.status(201).json(await service.crear(req.body)); }
  catch (err) { next(err); }
}
export async function actualizar(req, res, next) {
  try { res.json(await service.actualizar(Number(req.params.id), req.body)); }
  catch (err) { next(err); }
}
export async function eliminar(req, res, next) {
  try { await service.eliminar(Number(req.params.id)); res.status(204).send(); }
  catch (err) { next(err); }
}