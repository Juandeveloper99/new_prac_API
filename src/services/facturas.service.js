import { pool } from '../config/db.js';
import { ApiError } from '../middlewares/errorHandler.js';

/* ----------------------------------------------------------------
 * Generar número de factura correlativo por año: F-2026-0001
 * Se ejecuta DENTRO de una transacción con lock sobre las facturas del año.
 * ---------------------------------------------------------------- */
async function generarNumeroFactura(conn) {
  const anio = new Date().getFullYear();
  const prefijo = `F-${anio}-`;

  // Bloqueamos el rango de facturas del año para evitar colisiones concurrentes
  const [rows] = await conn.query(
    `SELECT numero_factura
     FROM facturas
     WHERE numero_factura LIKE ?
     ORDER BY numero_factura DESC
     LIMIT 1
     FOR UPDATE`,
    [`${prefijo}%`]
  );

  let siguiente = 1;
  if (rows.length > 0) {
    const ultimo = Number(rows[0].numero_factura.split('-')[2]);
    siguiente = ultimo + 1;
  }

  return `${prefijo}${String(siguiente).padStart(4, '0')}`;
}

/* ----------------------------------------------------------------
 * Crear factura a partir de un pedido
 * ---------------------------------------------------------------- */
export async function crearFactura({ pedido_id, notas }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Validar pedido
    const [pedidos] = await conn.query(
      'SELECT * FROM pedidos WHERE id = ? FOR UPDATE',
      [pedido_id]
    );
    if (pedidos.length === 0) throw new ApiError(404, 'Pedido no encontrado');
    const pedido = pedidos[0];

    if (pedido.estado === 'cancelado') {
      throw new ApiError(400, 'No se puede facturar un pedido cancelado');
    }
    if (!['listo', 'pagado', 'entregado'].includes(pedido.estado)) {
      throw new ApiError(
        400,
        `El pedido debe estar en estado "listo" o posterior para facturarse (actual: "${pedido.estado}")`
      );
    }

    // 2. Verificar que no exista ya factura
    const [existentes] = await conn.query(
      'SELECT id FROM facturas WHERE pedido_id = ?',
      [pedido_id]
    );
    if (existentes.length > 0) {
      throw new ApiError(409, 'Este pedido ya tiene una factura', { factura_id: existentes[0].id });
    }

    // 3. Generar número
    const numero = await generarNumeroFactura(conn);

    // 4. Crear factura (total = total del pedido)
    const [result] = await conn.query(
      `INSERT INTO facturas (pedido_id, numero_factura, total, estado, notas)
       VALUES (?, ?, ?, 'pendiente', ?)`,
      [pedido_id, numero, pedido.total, notas ?? null]
    );

    await conn.commit();
    return obtenerFacturaPorId(result.insertId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* ----------------------------------------------------------------
 * Obtener factura con detalle completo (para impresión)
 * ---------------------------------------------------------------- */
export async function obtenerFacturaPorId(id) {
  const [facturas] = await pool.query(
    `SELECT f.*,
            p.fecha_entrega, p.estado AS pedido_estado, p.notas AS pedido_notas,
            c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email
     FROM facturas f
     JOIN pedidos p  ON p.id = f.pedido_id
     JOIN clientes c ON c.id = p.cliente_id
     WHERE f.id = ?`,
    [id]
  );
  if (facturas.length === 0) throw new ApiError(404, 'Factura no encontrada');
  const factura = facturas[0];

  const [items] = await pool.query(
    `SELECT nombre_pastel, libras, precio_por_libra, subtotal
     FROM pedido_items WHERE pedido_id = ?
     ORDER BY id ASC`,
    [factura.pedido_id]
  );

  const [pagos] = await pool.query(
    `SELECT id, monto, metodo, referencia, fecha
     FROM pagos WHERE factura_id = ?
     ORDER BY fecha ASC`,
    [id]
  );

  const pagado = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const saldo = Number(factura.total) - pagado;

  return {
    ...factura,
    items,
    pagos,
    pagado: Number(pagado.toFixed(2)),
    saldo: Number(saldo.toFixed(2)),
  };
}

/* ----------------------------------------------------------------
 * Listar facturas (historial) con filtros
 * ---------------------------------------------------------------- */
export async function listarFacturas({ estado, desde, hasta, cliente_id, q } = {}) {
  const where = [];
  const params = [];

  if (estado)     { where.push('f.estado = ?'); params.push(estado); }
  if (cliente_id) { where.push('p.cliente_id = ?'); params.push(cliente_id); }
  if (desde)      { where.push('f.fecha_emision >= ?'); params.push(desde); }
  if (hasta)      { where.push('f.fecha_emision <= ?'); params.push(hasta); }
  if (q)          { where.push('(f.numero_factura LIKE ? OR c.nombre LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT f.id, f.numero_factura, f.fecha_emision, f.total, f.estado,
            p.id AS pedido_id, p.estado AS pedido_estado,
            c.id AS cliente_id, c.nombre AS cliente_nombre,
            COALESCE(SUM(pg.monto), 0) AS pagado
     FROM facturas f
     JOIN pedidos  p  ON p.id = f.pedido_id
     JOIN clientes c  ON c.id = p.cliente_id
     LEFT JOIN pagos pg ON pg.factura_id = f.id
     ${whereSql}
     GROUP BY f.id, p.id, c.id
     ORDER BY f.fecha_emision DESC, f.id DESC
     LIMIT 500`,
    params
  );
  return rows;
}

/* ----------------------------------------------------------------
 * Anular factura
 * ---------------------------------------------------------------- */
export async function anularFactura(id, { motivo }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM facturas WHERE id = ? FOR UPDATE',
      [id]
    );
    if (rows.length === 0) throw new ApiError(404, 'Factura no encontrada');
    const factura = rows[0];

    if (factura.estado === 'anulada') {
      throw new ApiError(400, 'La factura ya está anulada');
    }
    if (factura.estado === 'pagada') {
      throw new ApiError(400, 'No se puede anular una factura pagada. Registra una devolución primero.');
    }

    await conn.query(
      `UPDATE facturas
       SET estado = 'anulada',
           notas = CONCAT(COALESCE(notas, ''), '\n[ANULADA] ', ?)
       WHERE id = ?`,
      [motivo, id]
    );

    await conn.commit();
    return obtenerFacturaPorId(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}