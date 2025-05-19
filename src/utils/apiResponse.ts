import { Context } from 'hono';
import { StatusCode } from 'hono/utils/http-status'; // Hono 提供的 HTTP 状态码类型

interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>; // 用于分页等元数据
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: { field?: string; message: string; code?: string }[];
  stack?: string; // 仅开发环境
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
  return c.json(response, statusCode);
};

export const sendError = (
  c: Context,
  error: any, // 可以是 ApiError 实例或普通 Error
  defaultStatusCode: StatusCode = 500,
) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  let statusCode: StatusCode = defaultStatusCode;
  let message = '服务器发生内部错误，请稍后再试。';
  let responseErrors: ErrorResponse['errors'] | undefined = undefined;

  if (error instanceof ApiError) {
    statusCode = error.statusCode as StatusCode;
    message = error.message;
    responseErrors = error.errors;
  } else if (error.name === 'ZodError' && error.errors) {
    // 由 @hono/zod-validator 处理后，通常会被 Hono 的错误处理捕获
    // 这里是备用，或者如果手动调用 Zod 解析
    statusCode = 400;
    message = '请求参数验证失败。';
    responseErrors = error.errors.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  } else if (error instanceof Error) {
    message = error.message; // 开发模式下显示原始错误信息
  }

  const response: ErrorResponse = {
    success: false,
    message,
    errors: responseErrors,
  };

  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  return c.json(response, statusCode);
};
