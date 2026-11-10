import { pool } from '../config/db.js';
import { ApiError } from '../middlewares/errorHandler.js';

/* Vista general del inventario */
export async function verInventario() {
  const [rows] = await pool.query(
    `SELECT * FROM vista_inventario ORDER BY nombre ASC`
  );
  return rows;
}

/* Solo los que necesitan reabastecerse */
export async function bajoStock() {
  const [rows] = await pool.query(
    `SELECT * FROM vista_inventario WHERE alerta = 'REABASTECER' AND activo = 1 ORDER BY nombre ASC`
  );
  return rows;
}

/* Historial de movimientos con filtros */
export async function movimientos({ materia_prima_id, tipo, desde, hasta, pedido_id } = {}) {
  const where = [];
  const params = [];
  if (materia_prima_id) { where.push('m.materia_prima_id = ?'); params.push(materia_prima_id); }
  if (tipo)             { where.push('m.tipo = ?'); params.push(tipo); }
  if (pedido_id)        { where.push('m.pedido_id = ?'); params.push(pedido_id); }
  if (desde)            { where.push('m.fecha >= ?'); params.push(desde); }
  if (hasta)            { where.push('m.fecha <= ?'); params.push(hasta); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT m.*, mp.nombre AS materia_prima_nombre, mp.unidad
     FROM movimientos_inventario m
     JOIN materias_primas mp ON mp.id = m.materia_prima_id
     ${whereSql}
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT 500`,
    params
  );
  return rows;
}

/* Ajuste manual (+/-). Registra movimiento tipo 'ajuste' con signo indicado por motivo. */
export async function ajustarStock(materiaPrimaId, { cantidad, motivo }, signo) {
  if (!['+', '-'].includes(signo)) throw new ApiError(400, 'Signo inválido');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM materias_primas WHERE id = ? FOR UPDATE',
      [materiaPrimaId]
    );
    if (rows.length === 0) throw new ApiError(404, 'Materia prima no encontrada');
    const mp = rows[0];

    if (signo === '-') {
      if (Number(mp.stock_actual) < cantidad) {
        throw new ApiError(400, 'Stock insuficiente para ajuste negativo', {
          stock_actual: Number(mp.stock_actual),
          solicitado: cantidad,
        });
      }
      await conn.query(
        'UPDATE materias_primas SET stock_actual = stock_actual - ? WHERE id = ?',
        [cantidad, materiaPrimaId]
      );
    } else {
      await conn.query(
        'UPDATE materias_primas SET stock_actual = stock_actual + ? WHERE id = ?',
        [cantidad, materiaPrimaId]
      );
    }

    await conn.query(
      `INSERT INTO movimientos_inventario
         (materia_prima_id, tipo, cantidad, motivo)
       VALUES (?, 'ajuste', ?, ?)`,
      [materiaPrimaId, cantidad, `[${signo}] ${motivo}`]
    );

    await conn.commit();

    const [updated] = await pool.query(
      'SELECT * FROM materias_primas WHERE id = ?',
      [materiaPrimaId]
    );
    return updated[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}