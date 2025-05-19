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
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational; // 区分业务预期错误和未知系统错误
    this.errors = errors.length > 0 ? errors : [{ message }];

    // Error.captureStackTrace(this, this.constructor); // 在生产中通常省略以优化性能，除非需要详细堆栈
  }
}
