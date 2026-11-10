import { pool } from '../config/db.js';
import { ApiError } from '../middlewares/errorHandler.js';

export async function listar({ q } = {}) {
  if (q) {
    const like = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT * FROM clientes
       WHERE nombre LIKE ? OR telefono LIKE ? OR email LIKE ?
       ORDER BY nombre ASC`,
      [like, like, like]
    );
    return rows;
  }
  const [rows] = await pool.query('SELECT * FROM clientes ORDER BY nombre ASC');
  return rows;
}

export async function obtenerPorId(id) {
  const [rows] = await pool.query('SELECT * FROM clientes WHERE id = ?', [id]);
  if (rows.length === 0) throw new ApiError(404, 'Cliente no encontrado');
  return rows[0];
}

export async function crear(data) {
  const [result] = await pool.query(
    `INSERT INTO clientes (nombre, telefono, email, notas)
     VALUES (?, ?, ?, ?)`,
    [data.nombre, data.telefono ?? null, data.email || null, data.notas ?? null]
  );
  return obtenerPorId(result.insertId);
}

export async function actualizar(id, data) {
  await obtenerPorId(id);
  const campos = [];
  const valores = [];
  for (const key of ['nombre', 'telefono', 'email', 'notas']) {
    if (data[key] !== undefined) {
      campos.push(`${key} = ?`);
      valores.push(data[key] === '' ? null : data[key]);
    }
  }
  if (campos.length === 0) return obtenerPorId(id);

  valores.push(id);
  await pool.query(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`, valores);
  return obtenerPorId(id);
}

export async function eliminar(id) {
  await obtenerPorId(id);
  // No borramos: si tiene pedidos, MySQL rechazaría por FK.
  // Hacemos un delete real; el error handler devuelve 409 si está referenciado.
  await pool.query('DELETE FROM clientes WHERE id = ?', [id]);
}