import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let statusCode = 500;
  let message = 'Error interno del servidor';

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'Ya existe un registro con ese valor único';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Registro no encontrado';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'Referencia inválida a un recurso relacionado';
    }
  }

  if (statusCode === 500) {
    logger.error({ err }, 'Error interno del servidor');
  }

  const body: Record<string, unknown> = { error: { code: statusCode, message } };

  if (env.NODE_ENV === 'development' && statusCode === 500 && err instanceof Error) {
    body.error = { code: statusCode, message: err.message, stack: err.stack };
  }

  res.status(statusCode).json(body);
}
