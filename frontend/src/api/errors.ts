import { ApiErrorBody } from './types';

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
  }
}

export const apiError = (status: number, code: string, message: string, fieldErrors?: Record<string, string>) =>
  new ApiError(status, { code, message, fieldErrors, requestId: 'local' });
