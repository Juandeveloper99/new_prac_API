export const validate = (schema, property = 'body') => (req, _res, next) => {
  try {
    req[property] = schema.parse(req[property]);
    next();
  } catch (err) {
    next(err);
  }
};