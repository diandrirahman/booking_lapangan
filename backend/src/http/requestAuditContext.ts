import type { Request } from "express";

export interface RequestAuditContext {
  requestId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export function requestAuditContext(request: Request): RequestAuditContext {
  return {
    requestId: typeof request.id === "string" ? request.id : undefined,
    ipAddress: request.ip,
    userAgent: request.get("user-agent")?.slice(0, 255),
  };
}
