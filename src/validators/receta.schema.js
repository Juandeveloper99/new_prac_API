import { z } from 'zod';

const ingredienteSchema = z.object({
  materia_prima_id: z.number().int().positive(),
  cantidad_por_libra: z.number().positive(),
});

export const crearRecetaSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  precio_por_libra: z.number().min(0),
  activa: z.boolean().optional().default(true),
  ingredientes: z.array(ingredienteSchema).min(1, 'Debe tener al menos un ingrediente'),
}).refine(
  (data) => {
    const ids = data.ingredientes.map((i) => i.materia_prima_id);
    return new Set(ids).size === ids.length;
  },
  { message: 'No se puede repetir la misma materia prima en la receta', path: ['ingredientes'] }
);

export const actualizarRecetaSchema = z.object({
  nombre: z.string().trim().min(1).max(150).optional(),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  precio_por_libra: z.number().min(0).optional(),
  activa: z.boolean().optional(),
  ingredientes: z.array(ingredienteSchema).min(1).optional(),
}).refine(
  (data) => {
    if (!data.ingredientes) return true;
    const ids = data.ingredientes.map((i) => i.materia_prima_id);
    return new Set(ids).size === ids.length;
  },
  { message: 'No se puede repetir la misma materia prima en la receta', path: ['ingredientes'] }
);