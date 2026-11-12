import { pool } from '../config/db.js';

export async function obtenerDashboard() {
  // 1. Contadores generales
  const [contadores] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM pedidos WHERE DATE(fecha_creacion) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS pedidos_mes,
      (SELECT COALESCE(SUM(total), 0) FROM pedidos
        WHERE estado IN ('pagado','entregado')
          AND DATE(fecha_creacion) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS ventas_mes,
      (SELECT COUNT(*) FROM clientes) AS total_clientes,
      (SELECT COUNT(*) FROM facturas WHERE estado = 'pendiente') AS facturas_pendientes,
      (SELECT COUNT(*) FROM materias_primas WHERE activo = 1 AND stock_actual <= stock_minimo) AS materias_bajo_stock,
      (SELECT COUNT(*) FROM recetas WHERE activa = 1) AS recetas_activas
  `);

  // 2. Pedidos por estado
  const [pedidosPorEstado] = await pool.query(`
    SELECT estado, COUNT(*) AS cantidad
    FROM pedidos
    GROUP BY estado
    ORDER BY FIELD(estado, 'pendiente','en_proceso','listo','pagado','entregado','cancelado')
  `);

  // 3. Top 5 recetas más pedidas (por libras totales)
  const [topRecetas] = await pool.query(`
    SELECT
      pi.nombre_pastel AS nombre,
      SUM(pi.libras) AS libras_totales,
      SUM(pi.subtotal) AS ingresos
    FROM pedido_items pi
    JOIN pedidos p ON p.id = pi.pedido_id
    WHERE p.estado NOT IN ('cancelado')
    GROUP BY pi.nombre_pastel
    ORDER BY libras_totales DESC
    LIMIT 5
  `);

  // 4. Materias primas bajo stock
  const [bajoStock] = await pool.query(`
    SELECT id, nombre, unidad, stock_actual, stock_minimo
    FROM materias_primas
    WHERE activo = 1 AND stock_actual <= stock_minimo
    ORDER BY (stock_actual / NULLIF(stock_minimo, 0)) ASC
    LIMIT 10
  `);

  // 5. Últimos 5 pedidos
  const [ultimosPedidos] = await pool.query(`
    SELECT p.id, p.estado, p.total, p.fecha_entrega, p.fecha_creacion,
           c.nombre AS cliente_nombre
    FROM pedidos p
    JOIN clientes c ON c.id = p.cliente_id
    ORDER BY p.fecha_creacion DESC
    LIMIT 5
  `);

  // 6. Ventas por día (últimos 14 días)
  const [ventasPorDia] = await pool.query(`
    SELECT
      DATE(fecha_creacion) AS fecha,
      COUNT(*) AS pedidos,
      COALESCE(SUM(CASE WHEN estado IN ('pagado','entregado') THEN total ELSE 0 END), 0) AS ingresos
    FROM pedidos
    WHERE fecha_creacion >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
    GROUP BY DATE(fecha_creacion)
    ORDER BY fecha ASC
  `);

  return {
    contadores: contadores[0],
    pedidosPorEstado,
    topRecetas,
    bajoStock,
    ultimosPedidos,
    ventasPorDia,
  };
}