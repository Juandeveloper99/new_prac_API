import { pool } from '../config/db.js';
import { ApiError } from '../middlewares/errorHandler.js';

/* ----------------------------------------------------------------
 * Registrar pago. Se permiten parciales.
 * Cuando la suma >= total, marca factura como 'pagada' y
 * el pedido pasa a 'pagado' (si estaba 'listo').
 * ---------------------------------------------------------------- */
export async function crearPago({ factura_id, monto, metodo, referencia }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lock de la factura
    const [facturas] = await conn.query(
      'SELECT * FROM facturas WHERE id = ? FOR UPDATE',
      [factura_id]
    );
    if (facturas.length === 0) throw new ApiError(404, 'Factura no encontrada');
    const factura = facturas[0];

    if (factura.estado === 'anulada') {
      throw new ApiError(400, 'No se puede pagar una factura anulada');
    }
    if (factura.estado === 'pagada') {
      throw new ApiError(400, 'La factura ya está pagada en su totalidad');
    }

    // 2. Calcular saldo actual
    const [sumaRows] = await conn.query(
      'SELECT COALESCE(SUM(monto), 0) AS pagado FROM pagos WHERE factura_id = ?',
      [factura_id]
    );
    const pagado = Number(sumaRows[0].pagado);
    const saldo = Number(factura.total) - pagado;

    if (monto > saldo + 0.001) { // tolerancia decimal
      throw new ApiError(400, 'El monto excede el saldo pendiente', {
        saldo: Number(saldo.toFixed(2)),
        monto_solicitado: monto,
      });
    }

    // 3. Insertar pago
    const [result] = await conn.query(
      `INSERT INTO pagos (factura_id, monto, metodo, referencia)
       VALUES (?, ?, ?, ?)`,
      [factura_id, monto, metodo, referencia ?? null]
    );

    // 4. Si con este pago se cubre el total → marcar factura pagada + pedido pagado
    const nuevoPagado = pagado + monto;
    if (nuevoPagado + 0.001 >= Number(factura.total)) {
      await conn.query(
        `UPDATE facturas SET estado = 'pagada' WHERE id = ?`,
        [factura_id]
      );

      // Pedido: si estaba 'listo', pasa a 'pagado' automáticamente
      const [pedidos] = await conn.query(
        'SELECT id, estado FROM pedidos WHERE id = ? FOR UPDATE',
        [factura.pedido_id]
      );
      if (pedidos.length > 0 && pedidos[0].estado === 'listo') {
        await conn.query(
          `UPDATE pedidos SET estado = 'pagado' WHERE id = ?`,
          [factura.pedido_id]
        );
      }
    }

    await conn.commit();

    // Devolver el pago + estado actualizado de la factura
    const [pago] = await pool.query('SELECT * FROM pagos WHERE id = ?', [result.insertId]);
    const [facturaActual] = await pool.query(
      'SELECT id, numero_factura, total, estado FROM facturas WHERE id = ?',
      [factura_id]
    );
    return { pago: pago[0], factura: facturaActual[0] };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listarPagos({ factura_id } = {}) {
  const where = factura_id ? 'WHERE factura_id = ?' : '';
  const params = factura_id ? [factura_id] : [];
  const [rows] = await pool.query(
    `SELECT p.*, f.numero_factura
     FROM pagos p
     JOIN facturas f ON f.id = p.factura_id
     ${where}
     ORDER BY p.fecha DESC, p.id DESC
     LIMIT 500`,
    params
  );
  return rows;
}