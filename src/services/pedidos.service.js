import { pool } from '../config/db.js';
import { ApiError } from '../middlewares/errorHandler.js';

const TRANSICIONES = {
  pendiente:    ['en_proceso', 'cancelado'],
  en_proceso:   ['listo', 'cancelado'],
  listo:        ['pagado', 'cancelado'],
  pagado:       ['entregado'],
  entregado:    [],
  cancelado:    [],
};

/**
 * Convierte una fecha ISO (2026-11-11T17:00:00.000Z) o un Date
 * a formato MySQL DATETIME (2026-11-11 17:00:00).
 */
function fechaParaMySQL(fecha) {
  if (!fecha) throw new ApiError(400, 'La fecha de entrega es requerida');
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) {
    throw new ApiError(400, `Fecha inválida: ${fecha}`);
  }
  // Formato YYYY-MM-DD HH:mm:ss en UTC (o local, según prefieras)
  const iso = d.toISOString(); // "2026-11-11T17:00:00.000Z"
  return iso.slice(0, 19).replace('T', ' '); // "2026-11-11 17:00:00"
}

/* ----------------------------------------------------------------
 * Crear pedido
 * body: { cliente_id, fecha_entrega, notas, items: [{receta_id, libras}] }
 * ---------------------------------------------------------------- */
export async function crearPedido({ cliente_id, fecha_entrega, notas, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'El pedido debe tener al menos un item');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Validar cliente
    const [clientes] = await conn.query('SELECT id FROM clientes WHERE id = ?', [cliente_id]);
    if (clientes.length === 0) throw new ApiError(404, 'Cliente no encontrado');

    // 2. Crear pedido "vacío" con total 0
    const [pedidoResult] = await conn.query(
      'INSERT INTO pedidos (cliente_id, fecha_entrega, notas, total) VALUES (?, ?, ?, 0)',
      [cliente_id, fechaParaMySQL(fecha_entrega), notas ?? null]
    );
    const pedidoId = pedidoResult.insertId;

    // 3. Acumular consumo por materia prima (varios pasteles pueden compartir ingredientes)
    const consumoPorMateria = new Map(); // materia_prima_id -> cantidad_total
    const itemsDetallados = [];
    let total = 0;

    // 4. Preparar items: traer receta + ingredientes
    for (const item of items) {
      const { libras, receta_id } = item;

      const [recetas] = await conn.query(
        `SELECT id, nombre, precio_por_libra
         FROM recetas WHERE id = ? AND activa = 1`,
        [receta_id]
      );
      if (recetas.length === 0) {
        throw new ApiError(400, `Receta ${receta_id} no existe o está inactiva`);
      }
      const receta = recetas[0];

      const [ingredientes] = await conn.query(
        `SELECT materia_prima_id, cantidad_por_libra
         FROM receta_ingredientes WHERE receta_id = ?`,
        [receta_id]
      );
      if (ingredientes.length === 0) {
        throw new ApiError(400, `La receta "${receta.nombre}" no tiene ingredientes configurados`);
      }

      // Acumular consumo
      for (const ing of ingredientes) {
        const cant = Number(ing.cantidad_por_libra) * Number(libras);
        const prev = consumoPorMateria.get(ing.materia_prima_id) || 0;
        consumoPorMateria.set(ing.materia_prima_id, prev + cant);
      }

      const subtotal = Number(libras) * Number(receta.precio_por_libra);
      total += subtotal;

      itemsDetallados.push({
        receta_id,
        nombre_pastel: receta.nombre,
        libras,
        precio_por_libra: receta.precio_por_libra,
        subtotal,
      });
    }

    // 5. Verificar stock de TODAS las materias primas necesarias (lock FOR UPDATE)
    const idsMaterias = [...consumoPorMateria.keys()];
    const placeholders = idsMaterias.map(() => '?').join(',');
    const [stocks] = await conn.query(
      `SELECT id, nombre, stock_actual
       FROM materias_primas
       WHERE id IN (${placeholders})
       FOR UPDATE`,
      idsMaterias
    );

    const stockMap = new Map(stocks.map((r) => [r.id, r]));
    const faltantes = [];
    for (const [mpId, cantNecesaria] of consumoPorMateria.entries()) {
      const mp = stockMap.get(mpId);
      if (!mp) {
        faltantes.push({ materia_prima_id: mpId, motivo: 'No existe' });
        continue;
      }
      const disponible = Number(mp.stock_actual);
      if (disponible < cantNecesaria) {
        faltantes.push({
          materia_prima_id: mpId,
          nombre: mp.nombre,
          requerido: Number(cantNecesaria.toFixed(3)),
          disponible,
          faltante: Number((cantNecesaria - disponible).toFixed(3)),
        });
      }
    }

    if (faltantes.length > 0) {
      throw new ApiError(400, 'Stock insuficiente para uno o más ingredientes', faltantes);
    }

    // 6. Insertar items del pedido
    for (const it of itemsDetallados) {
      await conn.query(
        `INSERT INTO pedido_items
           (pedido_id, receta_id, nombre_pastel, libras, precio_por_libra, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pedidoId, it.receta_id, it.nombre_pastel, it.libras, it.precio_por_libra, it.subtotal]
      );
    }

    // 7. Descontar stock y registrar movimientos
    for (const [mpId, cantNecesaria] of consumoPorMateria.entries()) {
      await conn.query(
        'UPDATE materias_primas SET stock_actual = stock_actual - ? WHERE id = ?',
        [cantNecesaria, mpId]
      );
      await conn.query(
        `INSERT INTO movimientos_inventario
           (materia_prima_id, tipo, cantidad, motivo, pedido_id)
         VALUES (?, 'salida', ?, 'consumo_pedido', ?)`,
        [mpId, cantNecesaria, pedidoId]
      );
    }

    // 8. Actualizar total del pedido
    await conn.query('UPDATE pedidos SET total = ? WHERE id = ?', [total, pedidoId]);

    await conn.commit();
    return await obtenerPedidoPorId(pedidoId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* ----------------------------------------------------------------
 * Obtener pedido con items
 * ---------------------------------------------------------------- */
export async function obtenerPedidoPorId(id) {
  const [pedidos] = await pool.query(
    `SELECT p.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
     FROM pedidos p
     JOIN clientes c ON c.id = p.cliente_id
     WHERE p.id = ?`,
    [id]
  );
  if (pedidos.length === 0) throw new ApiError(404, 'Pedido no encontrado');

  const [items] = await pool.query(
    'SELECT * FROM pedido_items WHERE pedido_id = ? ORDER BY id ASC',
    [id]
  );
  return { ...pedidos[0], items };
}

/* ----------------------------------------------------------------
 * Listar pedidos (con filtros opcionales)
 * ---------------------------------------------------------------- */
export async function listarPedidos({ estado, cliente_id } = {}) {
  const where = [];
  const params = [];
  if (estado) { where.push('p.estado = ?'); params.push(estado); }
  if (cliente_id) { where.push('p.cliente_id = ?'); params.push(cliente_id); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT p.*, c.nombre AS cliente_nombre
     FROM pedidos p
     JOIN clientes c ON c.id = p.cliente_id
     ${whereSql}
     ORDER BY p.fecha_creacion DESC`,
    params
  );
  return rows;
}

/* ----------------------------------------------------------------
 * Cambiar estado (valida transición + devuelve stock si cancela)
 * ---------------------------------------------------------------- */
export async function cambiarEstado(id, nuevoEstado) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [pedidos] = await conn.query(
      'SELECT * FROM pedidos WHERE id = ? FOR UPDATE',
      [id]
    );
    if (pedidos.length === 0) throw new ApiError(404, 'Pedido no encontrado');
    const pedido = pedidos[0];

    const permitidos = TRANSICIONES[pedido.estado] ?? [];
    if (!permitidos.includes(nuevoEstado)) {
      throw new ApiError(
        400,
        `No se puede cambiar de "${pedido.estado}" a "${nuevoEstado}"`,
        { permitidos }
      );
    }

    // Si se cancela, devolver stock
    if (nuevoEstado === 'cancelado') {
      const [items] = await conn.query(
        'SELECT receta_id, libras FROM pedido_items WHERE pedido_id = ?',
        [id]
      );

      for (const item of items) {
        const [ingredientes] = await conn.query(
          'SELECT materia_prima_id, cantidad_por_libra FROM receta_ingredientes WHERE receta_id = ?',
          [item.receta_id]
        );
        for (const ing of ingredientes) {
          const cant = Number(ing.cantidad_por_libra) * Number(item.libras);
          await conn.query(
            'UPDATE materias_primas SET stock_actual = stock_actual + ? WHERE id = ?',
            [cant, ing.materia_prima_id]
          );
          await conn.query(
            `INSERT INTO movimientos_inventario
               (materia_prima_id, tipo, cantidad, motivo, pedido_id)
             VALUES (?, 'entrada', ?, 'cancelacion_pedido', ?)`,
            [ing.materia_prima_id, cant, id]
          );
        }
      }
    }

    await conn.query('UPDATE pedidos SET estado = ? WHERE id = ?', [nuevoEstado, id]);
    await conn.commit();
    return obtenerPedidoPorId(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}