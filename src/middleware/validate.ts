import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

type ValidationSchemas = {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
};

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }

    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as Request["params"];
    }

    if (schemas.query) {
      const parsedQuery = schemas.query.parse(req.query) as Record<string, unknown>;
      const queryTarget = req.query as Record<string, unknown>;

      for (const key of Object.keys(queryTarget)) {
        delete queryTarget[key];
      }

      Object.assign(queryTarget, parsedQuery);
    }

    next();
  };
}
