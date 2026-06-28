import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { sendError } from "@/utils/response";

type ValidationTarget = "body" | "query" | "params";

interface ValidateOptions {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export function validate(schemas: ValidateOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { target: ValidationTarget; issues: z.ZodIssue[] }[] = [];

    for (const target of ["body", "query", "params"] as ValidationTarget[]) {
      const schema = schemas[target];
      if (!schema) continue;

      const result = schema.safeParse(req[target]);
      if (!result.success) {
        errors.push({ target, issues: result.error.issues });
      } else {
        // Replace with parsed (coerced/transformed) values
        (req as any)[target] = result.data;
      }
    }

    if (errors.length > 0) {
      sendError(
        req,
        res,
        "VALIDATION_ERROR",
        "Request validation failed",
        400,
        errors.map((e) => ({
          target: e.target,
          issues: e.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        })),
      );
      return;
    }

    next();
  };
}
