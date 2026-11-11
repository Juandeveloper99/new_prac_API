import { pool } from '../config/db.js';
import { ApiError } from '../middlewares/errorHandler.js';

export async function listar({ incluirInactivos = false } = {}) {
  const where = incluirInactivos ? '' : 'WHERE activo = 1';
  const [rows] = await pool.query(
    `SELECT * FROM materias_primas ${where} ORDER BY nombre ASC`
  );
  return rows;
}

export async function obtenerPorId(id) {
  const [rows] = await pool.query(
    'SELECT * FROM materias_primas WHERE id = ?',
    [id]
  );
  if (rows.length === 0) throw new ApiError(404, 'Materia prima no encontrada');
  return rows[0];
}

export async function crear(data) {
  const { nombre, unidad, stock_actual, stock_minimo, costo_unitario, activo } = data;
  const [result] = await pool.query(
    `INSERT INTO materias_primas
      (nombre, unidad, stock_actual, stock_minimo, costo_unitario, activo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nombre, unidad, stock_actual, stock_minimo, costo_unitario, activo ? 1 : 0]
  );
  return obtenerPorId(result.insertId);
}

export async function actualizar(id, data) {
  await obtenerPorId(id); // 404 si no existe

  const campos = [];
  const valores = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    campos.push(`${key} = ?`);
    valores.push(key === 'activo' ? (value ? 1 : 0) : value);
  }
  if (campos.length === 0) return obtenerPorId(id);

  valores.push(id);
  await pool.query(
    `UPDATE materias_primas SET ${campos.join(', ')} WHERE id = ?`,
    valores
  );
  return obtenerPorId(id);
}

export async function eliminar(id) {
  await obtenerPorId(id);
  await pool.query('UPDATE materias_primas SET activo = 0 WHERE id = ?', [id]);
}

export async function entradaStock(id, { cantidad, motivo, costo_unitario }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM materias_primas WHERE id = ? FOR UPDATE',
      [id]
    );
    if (rows.length === 0) throw new ApiError(404, 'Materia prima no encontrada');
    const mp = rows[0];

    await conn.query(
      'UPDATE materias_primas SET stock_actual = stock_actual + ?, costo_unitario = COALESCE(?, costo_unitario) WHERE id = ?',
      [cantidad, costo_unitario ?? null, id]
    );

    await conn.query(
      `INSERT INTO movimientos_inventario
        (materia_prima_id, tipo, cantidad, motivo)
       VALUES (?, 'entrada', ?, ?)`,
      [id, cantidad, motivo ?? `Entrada manual de ${mp.nombre}`]
    );

    await conn.commit();
    return obtenerPorId(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}