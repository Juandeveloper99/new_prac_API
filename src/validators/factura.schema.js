import { z } from 'zod';

export const crearFacturaSchema = z.object({
  pedido_id: z.number().int().positive(),
  notas: z.string().trim().max(2000).optional().nullable(),
});

export const anularFacturaSchema = z.object({
  motivo: z.string().trim().min(3).max(200),
});