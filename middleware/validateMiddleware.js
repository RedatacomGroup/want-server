const { AppError } = require("./errorMiddleware");

const formatIssues = (issues) =>
  issues.map((issue) => ({
    field: issue.path.length ? issue.path.join(".") : "request",
    code: issue.code,
    message: issue.message,
  }));

const validate = (schema, source = "body") => (req, res, next) => {
  const input = req[source] || {};
  const result = schema.safeParse(input);

  if (!result.success) {
    const error = new AppError("Request validation failed.", 400, "VALIDATION_ERROR");
    error.details = formatIssues(result.error.issues);
    return next(error);
  }

  req[source] = result.data;
  return next();
};

module.exports = { validate };
