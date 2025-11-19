import type { NextApiResponse } from 'next';
import type { ApiErrorResponse, ApiSuccessResponse } from '@shared/index';

export function success<T>(res: NextApiResponse, data: T, statusCode = 200) {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  res.status(statusCode).json(payload);
}

export function failure(
  res: NextApiResponse,
  statusCode: number,
  error: string,
  details?: unknown
) {
  const payload: ApiErrorResponse = {
    success: false,
    error,
    details,
  };

  res.status(statusCode).json(payload);
}
