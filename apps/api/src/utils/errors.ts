export class ApiError extends Error {
  statusCode: number;
  details?: any;
  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;
