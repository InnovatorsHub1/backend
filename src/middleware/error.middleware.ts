import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { BaseError } from '../core/errors/base.error';
import { ApiError } from '../core/errors/api.error';
import { WinstonLogger } from '../core/logger/winston.logger';

const logger = new WinstonLogger('ErrorMiddleware');

export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error encountered:', { 
    error: error.message, 
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  if (error instanceof BaseError) {
    res.status(error.statusCode).json(error.serializeError());
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Invalid JSON payload',
      statusCode: StatusCodes.BAD_REQUEST,
      status: 'error',
      source: 'ErrorMiddleware'
    });
    return;
  }

  if (error.name === 'UnauthorizedError') {
    res.status(StatusCodes.UNAUTHORIZED).json({
      message: 'Authentication required',
      statusCode: StatusCodes.UNAUTHORIZED,
      status: 'error',
      source: 'ErrorMiddleware'
    });
    return;
  }

  // Catch all for unhandled errors
  const internalError = new ApiError(
    'Internal Server Error',
    StatusCodes.INTERNAL_SERVER_ERROR,
    'ErrorMiddleware'
  );

  res.status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json(internalError.serializeError());
};