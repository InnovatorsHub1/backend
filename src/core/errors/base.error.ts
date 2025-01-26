import { StatusCodes } from 'http-status-codes';
import { IErrorResponse } from "@gateway/types";

export abstract class BaseError extends Error {
  public readonly statusCode: number;
  public readonly source: string;

  constructor(message: string, statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR, source: string) {
    super(message);
    this.statusCode = statusCode;
    this.source = source;
    // Ensure the instance of subclass is a prototype of BaseError
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // Force all extending classes to implement this method
  abstract serializeError(): IErrorResponse;
}