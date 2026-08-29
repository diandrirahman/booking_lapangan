import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError, type ApiErrorBody } from "../ApiError.js";
import { SessionStoreUnavailableError } from "../../identity/auth/domain.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  void _next;
  const requestId = request.id;
  if (isPayloadTooLargeError(error)) {
    response.status(413).json({
      code: "PAYLOAD_TOO_LARGE",
      message: "Ukuran data melebihi batas 1 MB.",
      requestId,
    } satisfies ApiErrorBody);
    return;
  }

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      code: "VALIDATION_ERROR",
      message: "Data yang dikirim belum valid.",
      details: error.flatten(),
      requestId,
    };
    response.status(422).json(body);
    return;
  }

  if (error instanceof ApiError) {
    const body: ApiErrorBody = {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
    response.status(error.statusCode).json(body);
    return;
  }

  if (error instanceof SessionStoreUnavailableError) {
    response.status(503).json({
      code: "SESSION_STORE_UNAVAILABLE",
      message: "Layanan sesi sedang tidak tersedia. Silakan coba kembali.",
      requestId,
    } satisfies ApiErrorBody);
    return;
  }

  request.log.error({ error, requestId }, "Unhandled request error");
  const body: ApiErrorBody = {
    code: "INTERNAL_ERROR",
    message: "Terjadi kendala pada server.",
    requestId,
  };
  response.status(500).json(body);
};

function isPayloadTooLargeError(error: unknown): error is { type: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  );
}
