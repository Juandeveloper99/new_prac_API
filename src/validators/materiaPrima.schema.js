import { z } from 'zod';

const unidadEnum = z.enum(['kg', 'g', 'lt', 'ml', 'pza']);

export const crearMateriaPrimaSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  unidad: unidadEnum,
  stock_actual: z.number().min(0).default(0),
  stock_minimo: z.number().min(0).default(0),
  costo_unitario: z.number().min(0).default(0),
  activo: z.boolean().optional().default(true),
});

export const actualizarMateriaPrimaSchema = crearMateriaPrimaSchema.partial();

export const entradaStockSchema = z.object({
  cantidad: z.number().positive(),
  motivo: z.string().trim().max(200).optional(),
  costo_unitario: z.number().min(0).optional(),
});