import { Hono, HTTPException } from 'hono';
import { cors } from '@hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger as honoLoggerMiddleware } from 'hono/logger'; // Hono 内置的简单日志
import { serveStatic } from '@hono/node-server/serve-static'; // Node.js特定

import config from '@/config';
import logger from '@/utils/logger'; // Pino logger
import apiV1Router from '@/api/routes';
import { sendError, sendSuccess } from '@/utils/apiResponse'; // 调整 sendError 的导入
import { ApiError } from '@/utils/ApiError';

const app = new Hono();

// 1. 全局中间件
app.use('*', secureHeaders()); // 启用安全相关的 HTTP 头部

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
  app.use('*', honoLoggerMiddleware( (message: string, ...rest: string[]) => {
      logger.info({honoLog: {message, rest} }, 'Hono Request Log'); // 将 Hono 日志转到 Pino
  }));
}

// 2. 静态文件服务 (Node.js 环境)
// 生产环境通常建议使用 Nginx 或 CDN 服务静态文件以获得更优性能
// 但对于简单部署，Hono 也可以处理
app.use('/static/*', serveStatic({ root: './public/' }));
app.get('/', serveStatic({ path: './public/index.html' })); // 根路径服务 index.html

// 3. API 路由
app.route('/api/v1', apiV1Router);

// 4. 全局错误处理
app.onError((err, c) => {
  const requestInfo = {
    method: c.req.method,
    path: c.req.path,
    // query: c.req.query(), // query() 返回对象，可能很大
    // params: c.req.param(),// param() 返回对象
  };

  if (err instanceof HTTPException) {
    // Hono 内部抛出的 HTTP 错误 (如 404 Not Found, 405 Method Not Allowed)
    logger.warn({ err, ...requestInfo }, 'Hono HTTPException 捕获');
    if (err.status === 404 && c.req.header('accept')?.includes('text/html')) {
        // 如果是HTML请求且404，尝试服务404页面
        return serveStatic({path: './public/404.html'})(c, async () => {});
    }
    return sendError(c, new ApiError(err.status, err.message), err.status as any);
  }
  
  if (err instanceof ApiError) {
    logger.warn({ err, ...requestInfo }, '业务逻辑 ApiError 捕获');
    return sendError(c, err);
  }
  
  // ZodError 通常由 zValidator 中间件处理并直接响应400，
  // 但如果错误传播到这里，也进行处理。
  if (err.name === 'ZodError') {
    logger.warn({ err, ...requestInfo }, 'ZodError 传播到全局错误处理');
    return sendError(c, err, 400);
  }

  // 其他未知错误
  logger.error({ err, ...requestInfo }, '未捕获的未知错误');
  return sendError(c, new ApiError(500, '服务器发生了一个意外的内部错误。'));
});

// 5. 404 Not Found (如果前面的路由都未匹配)
// Hono 的默认行为是抛出 HTTPException (status 404)，会被 app.onError 处理。
// 如果需要自定义 404 响应（例如返回特定的 JSON 结构而不是 HTTPException 的默认响应），
// 可以在 onError 中针对 status 404 进行特殊处理，或者在这里定义 app.notFound。
app.notFound((c) => {
  logger.info({ path: c.req.path }, '请求的资源未找到 (404)');
  if (c.req.header('accept')?.includes('text/html')) {
    // 对于Node.js，这里直接返回HTML比较复杂，通常会用模板引擎或静态文件服务
    // 简单起见，返回JSON；或者配置静态文件服务来处理 404.html
    // 这里返回 JSON，让 onError 中的 HTTPException 处理部分来决定是否返回HTML
    return c.json({ success: false, message: '请求的资源未找到。' }, 404);
  }
  return c.json({ success: false, message: '请求的资源未找到。' }, 404);
});

export default app;
