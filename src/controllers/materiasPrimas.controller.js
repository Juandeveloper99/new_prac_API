import * as service from '../services/materiasPrimas.service.js';

export async function listar(req, res, next) {
  try {
    const data = await service.listar();
    res.json(data);
  } catch (err) { next(err); }
}

export async function obtener(req, res, next) {
  try {
    const data = await service.obtenerPorId(Number(req.params.id));
    res.json(data);
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const data = await service.crear(req.body);
    res.status(201).json(data);
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const data = await service.actualizar(Number(req.params.id), req.body);
    res.json(data);
  } catch (err) { next(err); }
}

export async function eliminar(req, res, next) {
  try {
    await service.eliminar(Number(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function entradaStock(req, res, next) {
  try {
    const data = await service.entradaStock(Number(req.params.id), req.body);
    res.json(data);
  } catch (err) { next(err); }
}