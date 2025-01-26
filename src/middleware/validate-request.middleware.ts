import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../core/errors/api.error';
import { StatusCodes } from 'http-status-codes';

interface ValidationRules {
 headers?: string[];
 query?: string[];
 body?: string[];
}

export const createValidator = (rules: ValidationRules = {}) => {
 return (req: Request, _res: Response, next: NextFunction): void => {
   const errors: string[] = [];

   if (rules.headers) {
     rules.headers.forEach(header => {
       if (!req.headers[header.toLowerCase()]) {
         errors.push(`Missing required header: ${header}`);
       }
     });
   }

   if (rules.query) {
     rules.query.forEach(param => {
       if (!req.query[param]) {
         errors.push(`Missing required query param: ${param}`);
       }
     });
   }

   if (rules.body) {
     rules.body.forEach(field => {
       if (!req.body[field]) {
         errors.push(`Missing required body field: ${field}`);
       }
     });
   }

   if (errors.length > 0) {
     throw new ApiError(errors.join(', '), StatusCodes.BAD_REQUEST, 'Validation');
   }

   next();
 };
};

export const validateRequest = createValidator();