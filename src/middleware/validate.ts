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
      req.query = schemas.query.parse(req.query) as Request["query"];
    }

    next();
  };
}
