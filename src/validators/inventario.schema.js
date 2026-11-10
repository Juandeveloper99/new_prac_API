import { z } from 'zod';

export const ajusteSchema = z.object({
  materia_prima_id: z.number().int().positive(),
  tipo: z.enum(['ajuste']), // reservado por si amplías
  cantidad: z.number().positive(),
  motivo: z.string().trim().min(3).max(200),
});

export const ajusteStockSchema = z.object({
  cantidad: z.number().positive(),
  motivo: z.string().trim().min(3).max(200),
});