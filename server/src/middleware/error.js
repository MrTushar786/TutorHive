import { StatusCodes } from "http-status-codes";

export function notFound(_req, res, _next) {
  res.status(StatusCodes.NOT_FOUND).json({
    message: "Route not found",
  });
}

export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
  res.status(statusCode).json({
    message: err.message ?? "Something went wrong",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    errors: err.errors,
  });
}

