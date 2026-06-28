import type { Request, Response } from "express";
import type {
  SuccessResponse,
  ErrorResponse,
  ResponseMeta,
} from "@/types/response";

function buildMeta(req: Request): ResponseMeta {
  return {
    requestId: req.requestId || "",
    traceId: req.traceId,
    generatedAt: new Date().toISOString(),
  };
}

export function sendSuccess(
  req: Request,
  res: Response,
  data: any,
  message = "OK",
  statusCode = 200,
  extraMeta?: Record<string, unknown>,
): void {
  const response: SuccessResponse = {
    status: "success",
    code: statusCode,
    message,
    data,
    meta: { ...buildMeta(req), ...extraMeta },
  };
  res.status(statusCode).json(response);
}

export function sendError(
  req: Request,
  res: Response,
  errorCode: string,
  message: string,
  statusCode = 400,
  details?: any,
): void {
  const response: ErrorResponse = {
    status: "error",
    code: statusCode,
    message,
    error: { code: errorCode, details },
    meta: buildMeta(req),
  };
  res.status(statusCode).json(response);
}
