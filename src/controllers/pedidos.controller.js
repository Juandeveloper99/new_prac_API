import * as service from '../services/pedidos.service.js';

export async function crear(req, res, next) {
  try {
    const data = await service.crearPedido(req.body);
    res.status(201).json(data);
  } catch (err) { next(err); }
}

export async function obtener(req, res, next) {
  try {
    const data = await service.obtenerPedidoPorId(Number(req.params.id));
    res.json(data);
  } catch (err) { next(err); }
}

export async function listar(req, res, next) {
  try {
    const data = await service.listarPedidos({
      estado: req.query.estado,
      cliente_id: req.query.cliente_id ? Number(req.query.cliente_id) : undefined,
    });
    res.json(data);
  } catch (err) { next(err); }
}

export async function cambiarEstado(req, res, next) {
  try {
    const data = await service.cambiarEstado(Number(req.params.id), req.body.estado);
    res.json(data);
  } catch (err) { next(err); }
}