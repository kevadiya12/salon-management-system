import type { ErrorRequestHandler } from 'express';
import { ReceptionServiceError } from '../services/reception.service.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof ReceptionServiceError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  if (typeof error === 'object' && error !== null) {
    const parserError = error as { type?: unknown };
    if (parserError.type === 'entity.parse.failed') {
      response.status(400).json({
        success: false,
        message: 'Request body must be valid JSON.',
      });
      return;
    }
    if (parserError.type === 'entity.too.large') {
      response.status(413).json({
        success: false,
        message: 'Request body is too large.',
      });
      return;
    }
  }

  console.error('Unhandled API error:', {
    name: error instanceof Error ? error.name : 'UnknownError',
  });
  response.status(500).json({
    success: false,
    message: 'The request could not be completed. Please try again.',
  });
};
