import { z } from 'zod';

export const crearClienteSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  telefono: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(150).optional().nullable().or(z.literal('')),
  notas: z.string().trim().max(2000).optional().nullable(),
});

export const actualizarClienteSchema = crearClienteSchema.partial();