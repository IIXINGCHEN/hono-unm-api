export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors: ErrorDetail[];

  constructor(
    statusCode: number,
    message: string,
    errors: ErrorDetail[] = [],
    isOperational = true,
    stack = '',
  ) {
    super(message);
    this.name = this.constructor.name; // 更准确的错误名称
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors.length > 0 ? errors : [{ message }]; // 确保至少有一个错误信息

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
