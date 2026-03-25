import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export function validate(schema: ZodTypeAny, source: "body" | "query" | "params" = "body") {
  return (request: Request, _response: Response, next: NextFunction) => {
    request[source] = schema.parse(request[source]);
    next();
  };
}
