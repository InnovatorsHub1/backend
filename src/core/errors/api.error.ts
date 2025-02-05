import { StatusCodes } from 'http-status-codes';

import { IErrorResponse } from '../../types';

import { BaseError } from './base.error';

export class ApiError extends BaseError {
  constructor(message: string, statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR, source: string) {
    super(message, statusCode, source);
  }

  serializeError(): IErrorResponse {
    return {
      message: this.message,
      statusCode: this.statusCode,
      status: 'error',
      source: this.source,
      timestamp: new Date().toISOString()
    };
  }
}
