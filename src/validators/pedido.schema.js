import { z } from 'zod';

export const crearPedidoSchema = z.object({
  cliente_id: z.number().int().positive(),
  fecha_entrega: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'fecha_entrega inválida',
  }),
  notas: z.string().trim().max(1000).optional(),
  items: z.array(
    z.object({
      receta_id: z.number().int().positive(),
      libras: z.number().positive(),
    })
  ).min(1),
});

export const cambiarEstadoSchema = z.object({
  estado: z.enum(['en_proceso', 'listo', 'pagado', 'entregado', 'cancelado']),
});