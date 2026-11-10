import { z } from 'zod';

export const crearPagoSchema = z.object({
  factura_id: z.number().int().positive(),
  monto: z.number().positive(),
  metodo: z.enum(['efectivo', 'transferencia', 'tarjeta', 'otro']).default('efectivo'),
  referencia: z.string().trim().max(150).optional().nullable(),
});