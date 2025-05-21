import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger as honoLoggerMiddleware } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';

import config from './config/index.js';
import logger from './utils/logger.js';
import apiV1Router from './api/routes/index.js';
import { sendError } from './utils/apiResponse.js';
import { ApiError } from './utils/ApiError.js';

const app = new Hono();

app.use('*', secureHeaders());

if (config.allowedOrigins.length > 0) {
  app.use(
    '*',
    cors({
      origin: config.allowedOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      credentials: true,
      maxAge: 86400,
    }),
  );
} else if (config.nodeEnv === 'production') {
  logger.warn('CORS ALLOWED_ORIGINS 未配置，所有跨域请求将被默认策略拒绝（除非浏览器同源）。');
}


if (config.nodeEnv === 'development') {
  app.use('*', honoLoggerMiddleware((message: string, ...rest: string[]) => {
    logger.info({ honoLog: { message, rest } }, 'Hono Request Log');
  }));
}

app.use('/static/*', serveStatic({ root: './public/' }));
app.get('/', serveStatic({ path: './public/index.html' }));

app.route('/api/v1', apiV1Router);

app.onError((err, c) => {
  const requestInfo = {
    method: c.req.method,
    path: c.req.path,
  };

  if (err instanceof HTTPException) {
    logger.warn({ err, ...requestInfo }, 'Hono HTTPException 捕获');
    if (err.status === 404 && c.req.header('accept')?.includes('text/html')) {
      // 修改为直接返回Response对象
      return c.html('404 Not Found', 404);
    }
    return sendError(c, new ApiError(err.status, err.message), err.status as any);
  }

  if (err instanceof ApiError) {
    logger.warn({ err, ...requestInfo }, '业务逻辑 ApiError 捕获');
    return sendError(c, err);
  }

  if (err.name === 'ZodError') {
    logger.warn({ err, ...requestInfo }, 'ZodError 传播到全局错误处理');
    return sendError(c, err, 400);
  }

  logger.error({ err, ...requestInfo }, '未捕获的未知错误');
  return sendError(c, new ApiError(500, '服务器发生了一个意外的内部错误。'));
});

app.notFound((c) => {
  logger.info({ path: c.req.path }, '请求的资源未找到 (404)');
  if (c.req.header('accept')?.includes('text/html')) {
    // 修改为直接返回HTML响应
    return c.html('404 Not Found', 404);
  }
  return c.json({ success: false, message: '请求的资源未找到。' }, 404);
});

export default app;
