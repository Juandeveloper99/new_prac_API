import * as service from '../services/inventario.service.js';

export async function ver(req, res, next) {
  try { res.json(await service.verInventario()); } catch (err) { next(err); }
}
export async function bajoStock(req, res, next) {
  try { res.json(await service.bajoStock()); } catch (err) { next(err); }
}
export async function movimientos(req, res, next) {
  try {
    res.json(await service.movimientos({
      materia_prima_id: req.query.materia_prima_id ? Number(req.query.materia_prima_id) : undefined,
      tipo: req.query.tipo,
      pedido_id: req.query.pedido_id ? Number(req.query.pedido_id) : undefined,
      desde: req.query.desde,
      hasta: req.query.hasta,
    }));
  } catch (err) { next(err); }
}
export async function ajustePositivo(req, res, next) {
  try {
    const data = await service.ajustarStock(
      Number(req.params.materiaPrimaId), req.body, '+'
    );
    res.json(data);
  } catch (err) { next(err); }
}
export async function ajusteNegativo(req, res, next) {
  try {
    const data = await service.ajustarStock(
      Number(req.params.materiaPrimaId), req.body, '-'
    );
    res.json(data);
  } catch (err) { next(err); }
}