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


  // Errores de MySQL que en realidad son de validación
if (err.code === 'ER_BAD_NULL_ERROR' || err.code === 'ER_TRUNCATED_WRONG_VALUE') {
  console.error('❌ Error de datos en MySQL:', err.sqlMessage);
  return res.status(400).json({
    error: 'Datos inválidos',
    details: err.sqlMessage,
  });
}

console.error('❌ Error no manejado:', err);
res.status(500).json({ error: 'Error interno del servidor' });
}