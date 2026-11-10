import { pool } from '../config/db.js';
import { ApiError } from '../middlewares/errorHandler.js';

/* Listar recetas con costo calculado por libra */
export async function listar({ soloActivas = false } = {}) {
  const where = soloActivas ? 'WHERE r.activa = 1' : '';
  const [rows] = await pool.query(
    `SELECT r.*,
            COALESCE(SUM(ri.cantidad_por_libra * mp.costo_unitario), 0) AS costo_por_libra,
            COUNT(ri.id) AS num_ingredientes
     FROM recetas r
     LEFT JOIN receta_ingredientes ri ON ri.receta_id = r.id
     LEFT JOIN materias_primas mp    ON mp.id = ri.materia_prima_id
     ${where}
     GROUP BY r.id
     ORDER BY r.nombre ASC`
  );
  return rows;
}

/* Obtener receta con sus ingredientes detallados */
export async function obtenerPorId(id) {
  const [recetas] = await pool.query('SELECT * FROM recetas WHERE id = ?', [id]);
  if (recetas.length === 0) throw new ApiError(404, 'Receta no encontrada');

  const [ingredientes] = await pool.query(
    `SELECT ri.id, ri.materia_prima_id, ri.cantidad_por_libra,
            mp.nombre AS materia_prima_nombre,
            mp.unidad AS materia_prima_unidad,
            mp.costo_unitario,
            (ri.cantidad_por_libra * mp.costo_unitario) AS costo_por_libra
     FROM receta_ingredientes ri
     JOIN materias_primas mp ON mp.id = ri.materia_prima_id
     WHERE ri.receta_id = ?
     ORDER BY mp.nombre ASC`,
    [id]
  );

  const costo_por_libra = ingredientes.reduce(
    (acc, i) => acc + Number(i.costo_por_libra), 0
  );

  return { ...recetas[0], ingredientes, costo_por_libra };
}

/* Crear receta + ingredientes en una transacción */
export async function crear(data) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Validar que todas las materias primas existan
    await validarMaterias(conn, data.ingredientes.map((i) => i.materia_prima_id));

    const [result] = await conn.query(
      `INSERT INTO recetas (nombre, descripcion, precio_por_libra, activa)
       VALUES (?, ?, ?, ?)`,
      [data.nombre, data.descripcion ?? null, data.precio_por_libra, data.activa ? 1 : 0]
    );
    const recetaId = result.insertId;

    for (const ing of data.ingredientes) {
      await conn.query(
        `INSERT INTO receta_ingredientes
           (receta_id, materia_prima_id, cantidad_por_libra)
         VALUES (?, ?, ?)`,
        [recetaId, ing.materia_prima_id, ing.cantidad_por_libra]
      );
    }

    await conn.commit();
    return obtenerPorId(recetaId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* Actualizar receta + reemplazar ingredientes si vienen */
export async function actualizar(id, data) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existe] = await conn.query('SELECT id FROM recetas WHERE id = ?', [id]);
    if (existe.length === 0) throw new ApiError(404, 'Receta no encontrada');

    // Actualizar campos simples
    const campos = [];
    const valores = [];
    for (const key of ['nombre', 'descripcion', 'precio_por_libra', 'activa']) {
      if (data[key] !== undefined) {
        campos.push(`${key} = ?`);
        valores.push(key === 'activa' ? (data[key] ? 1 : 0) : data[key]);
      }
    }
    if (campos.length > 0) {
      valores.push(id);
      await conn.query(`UPDATE recetas SET ${campos.join(', ')} WHERE id = ?`, valores);
    }

    // Si vienen ingredientes, reemplazamos todos
    if (data.ingredientes) {
      await validarMaterias(conn, data.ingredientes.map((i) => i.materia_prima_id));
      await conn.query('DELETE FROM receta_ingredientes WHERE receta_id = ?', [id]);
      for (const ing of data.ingredientes) {
        await conn.query(
          `INSERT INTO receta_ingredientes
             (receta_id, materia_prima_id, cantidad_por_libra)
           VALUES (?, ?, ?)`,
          [id, ing.materia_prima_id, ing.cantidad_por_libra]
        );
      }
    }

    await conn.commit();
    return obtenerPorId(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* Soft delete: activa = 0 */
export async function eliminar(id) {
  const [rows] = await pool.query('SELECT id FROM recetas WHERE id = ?', [id]);
  if (rows.length === 0) throw new ApiError(404, 'Receta no encontrada');
  await pool.query('UPDATE recetas SET activa = 0 WHERE id = ?', [id]);
}

/* Helper */
async function validarMaterias(conn, ids) {
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT id FROM materias_primas WHERE id IN (${placeholders}) AND activo = 1`,
    ids
  );
  if (rows.length !== ids.length) {
    const encontrados = new Set(rows.map((r) => r.id));
    const faltantes = ids.filter((id) => !encontrados.has(id));
    throw new ApiError(400, 'Materias primas inválidas o inactivas', { faltantes });
  }
}