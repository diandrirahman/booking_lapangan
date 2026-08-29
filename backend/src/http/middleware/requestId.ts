import type { RequestHandler } from "express";
import { ulid } from "ulid";

export const requestId: RequestHandler = (request, response, next) => {
  const incomingRequestId = request.get("x-request-id")?.trim();
  const id = incomingRequestId || `req_${ulid()}`;
  request.id = id;
  response.setHeader("x-request-id", id);
  next();
};
