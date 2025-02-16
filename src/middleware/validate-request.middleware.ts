import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../core/errors/api.error';
import { StatusCodes } from 'http-status-codes';

interface ValidationRules {
  headers?: string[];
  query?: string[];
  body?: string[];
}

const AUTH_HEADERS = ['x-api-key']; // Add any other auth headers here

export const createValidator = (rules: ValidationRules = {}) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const validationErrors: string[] = [];
    const authErrors: string[] = [];

    // Check headers
    if (rules.headers) {
      rules.headers.forEach(header => {
        if (!req.headers[header.toLowerCase()]) {
          // Separate auth errors from other validation errors
          if (AUTH_HEADERS.includes(header.toLowerCase())) {
            authErrors.push(`Missing required authentication header: ${header}`);
          } else {
            validationErrors.push(`Missing required header: ${header}`);
          }
        }
      });
    }

    // Check query parameters
    if (rules.query) {
      rules.query.forEach(param => {
        if (!req.query[param]) {
          validationErrors.push(`Missing required query param: ${param}`);
        }
      });
    }

    // Check body fields
    if (rules.body) {

      rules.body.forEach(field => {
        if (!req.body[field] || req.body[field].trim() === '') {
          validationErrors.push(`Missing required body field: ${field}`);
        }
      });
    }

    // Handle errors
    if (authErrors.length > 0) {
      throw new ApiError(
        authErrors.join(', '),
        StatusCodes.UNAUTHORIZED,
        'Authentication'
      );
    }

    if (validationErrors.length > 0) {
      console.log(validationErrors);
      throw new ApiError(
        validationErrors.join(', '),
        StatusCodes.BAD_REQUEST,
        'Validation'
      );
    }

    next();
  };
};

export const validateRequest = createValidator();