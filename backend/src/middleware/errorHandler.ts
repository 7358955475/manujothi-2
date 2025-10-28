import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export class AppError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR'): AppError => {
  return new AppError(message, statusCode, code);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = createError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
  next(error);
};

export const globalErrorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let code = (error as AppError).code || 'INTERNAL_ERROR';

  // Log error details
  logger.error('API Error', {
    message: error.message,
    statusCode,
    code,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
  }

  if (error.name === 'UnauthorizedError' || error.message.includes('jwt')) {
    statusCode = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  }

  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  }

  // PostgreSQL errors
  if (error.message.includes('duplicate key value')) {
    statusCode = 409;
    message = 'Resource already exists';
    code = 'DUPLICATE_RESOURCE';
  }

  if (error.message.includes('foreign key constraint')) {
    statusCode = 400;
    message = 'Invalid reference';
    code = 'FOREIGN_KEY_ERROR';
  }

  // Multer errors
  if (error.message.includes('LIMIT_FILE_SIZE')) {
    statusCode = 400;
    message = 'File too large';
    code = 'FILE_TOO_LARGE';
  }

  if (error.message.includes('LIMIT_UNEXPECTED_FILE')) {
    statusCode = 400;
    message = 'Unexpected file field';
    code = 'UNEXPECTED_FILE';
  }

  // Send error response
  const errorResponse: any = {
    error: message,
    code,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  };

  res.status(statusCode).json(errorResponse);
};