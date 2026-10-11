import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

interface ZodLikeSchema {
  parseAsync(data: unknown): Promise<unknown>;
}

interface ValidationSchemas {
  body?: ZodLikeSchema;
  query?: ZodLikeSchema;
  params?: ZodLikeSchema;
}

export function validateRequest(schemas: ValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as Request['query'];
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as Request['params'];
      }
      return next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: err.errors[0]?.message || 'Validation Error',
          details: err.errors
        });
      }
      const errorObj = err as { errors?: Array<{ message?: string }> };
      if (errorObj && Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
        return res.status(400).json({
          error: errorObj.errors[0]?.message || 'Validation Error',
          details: errorObj.errors
        });
      }
      return res.status(400).json({ error: 'Invalid Request Data' });
    }
  };
}
