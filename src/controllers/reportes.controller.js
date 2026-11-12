import * as service from '../services/reportes.service.js';

export async function dashboard(req, res, next) {
  try {
    const data = await service.obtenerDashboard();
    res.json(data);
  } catch (err) { next(err); }
}