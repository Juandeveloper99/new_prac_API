export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function errorHandler(err, _req, res, _next) {
  // Errores conocidos
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Errores de zod (los agregaremos en validate.js)
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Errores MySQL comunes
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Registro duplicado', details: err.sqlMessage });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'No se puede eliminar: tiene registros relacionados' });
  }

  console.error('❌ Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
}