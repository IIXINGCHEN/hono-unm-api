import { Context } from 'hono';
import { StatusCode } from 'hono/utils/http-status';
import config from '../config/index.js';
import { ErrorDetail } from './ApiError.js';

interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: ErrorDetail[];
  stack?: string;
}

export const sendSuccess = <T>(
  c: Context,
  data: T,
  message = '操作成功',
  statusCode: StatusCode = 200,
  meta?: Record<string, unknown>,
) => {
  const response: SuccessResponse<T> = {
    success: true,
    message,
    data,
  };
  if (meta) {
    response.meta = meta;
  }
  c.header('Content-Type', 'application/json; charset=utf-8');
  return c.json(response, statusCode as any);
};

export const sendError = (
  c: Context,
  error: any,
  defaultStatusCode: StatusCode = 500,
) => {
  const isDevelopment = config.nodeEnv === 'development';
  let statusCode: StatusCode = defaultStatusCode;
  let message = '服务器发生内部错误，请稍后再试。';
  let responseErrors: ErrorResponse['errors'] | undefined = undefined;

  if (error && typeof error.name === 'string' && error.name === 'ApiError') {
    // 检查 ApiError 实例
    statusCode = error.statusCode as StatusCode;
    message = error.message;
    responseErrors = error.errors;
  } else if (error && error.name === 'ZodError' && error.errors) {
    statusCode = 400;
    message = '请求参数验证失败。';
    responseErrors = error.errors.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  } else if (error instanceof Error) {
    if (isDevelopment) {
      // 开发模式下显示更详细的原始错误信息
      message = error.message;
    }
    // 对非 ApiError 的其他错误，生产环境不直接暴露原始 message
  }

  const response: ErrorResponse = {
    success: false,
    message,
    errors: responseErrors,
  };

  if (isDevelopment && error && error.stack) {
    response.stack = error.stack;
  }

  c.header('Content-Type', 'application/json; charset=utf-8');
  return c.json(response, statusCode as any);
};
