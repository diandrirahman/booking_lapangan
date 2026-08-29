import type { RequestHandler } from "express";
import { ApiError } from "../ApiError.js";

export const notFound: RequestHandler = (request, _response, next) => {
  next(
    new ApiError(
      404,
      "ROUTE_NOT_FOUND",
      `Route ${request.method} ${request.path} tidak ditemukan.`,
    ),
  );
};
