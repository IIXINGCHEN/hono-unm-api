import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger as honoLoggerMiddleware } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';

import config from './config/index.js';
import logger from './utils/logger.js';
import apiV1Router from './api/routes/index.js';
import { sendError } from './utils/apiResponse.js';
import { ApiError } from './utils/ApiError.js';
import { securityMiddleware } from './middleware/security.js';
import { enhancedCorsMiddleware, domainVerificationMiddleware } from './middleware/cors.middleware.js';
import { apiKeyAuthMiddleware } from './middleware/auth.middleware.js';
import { InitManager } from './services/initManager.js';

const app = new Hono();

// 初始化各种服务
InitManager.initialize(config).catch(error => {
  logger.error({ err: error }, '初始化服务失败');
});

// 添加全局中间件，确保所有响应都有正确的Content-Type和字符集
app.use('*', async (c, next) => {
  await next();
  // 检查Content-Type头
  const contentType = c.res.headers.get('Content-Type');
  if (contentType && contentType.includes('application/json') && !contentType.includes('charset=utf-8')) {
    // 如果是JSON但没有指定字符集，添加UTF-8字符集
    c.res.headers.set('Content-Type', 'application/json; charset=utf-8');
  }
});

// 应用增强的CORS中间件（替代原有的CORS中间件）
app.use('*', enhancedCorsMiddleware());

// 应用其他安全中间件（除了CORS中间件）
securityMiddleware
  .filter(middleware => !middleware.toString().includes('cors('))
  .forEach(middleware => {
    app.use('*', middleware);
  });

// 应用域名验证中间件
app.use('*', domainVerificationMiddleware());

// 如果启用了API密钥验证，应用API密钥验证中间件
if (config.apiKeyEnabled) {
  // 获取需要API密钥的路径
  const requiredPaths = config.apiKeyRequiredPaths.length > 0
    ? config.apiKeyRequiredPaths
    : ['/api/v1/music/*'];

  // 应用API密钥验证中间件
  app.use('/api/v1/*', apiKeyAuthMiddleware({
    required: false, // 默认不要求API密钥，仅对特定路径要求
    validateSignature: config.apiKeySignatureRequired,
    excludePaths: [
      '/api/v1/health/*',
      '/api/v1/info/*',
      '/api/v1/auth/keys/verify',
    ],
  }));

  // 对特定路径应用严格的API密钥验证
  requiredPaths.forEach(path => {
    app.use(path, apiKeyAuthMiddleware({
      required: true,
      validateSignature: config.apiKeySignatureRequired,
    }));
  });

  logger.info(`API密钥验证已启用，需要API密钥的路径: ${requiredPaths.join(', ')}`);
} else {
  logger.info('API密钥验证已禁用');
}

// 生产环境CORS警告
if (config.allowedOrigins.length === 0 && config.nodeEnv === 'production') {
  logger.warn(
    'CORS ALLOWED_ORIGINS 未配置，所有跨域请求将被默认策略拒绝（除非浏览器同源）。',
  );
}

if (config.nodeEnv === 'development') {
  app.use(
    '*',
    honoLoggerMiddleware((message: string, ...rest: string[]) => {
      logger.info({ honoLog: { message, rest } }, 'Hono Request Log');
    }),
  );
}

// 在非 Vercel 环境中处理静态文件
// Vercel 环境中静态文件由 vercel.json 中的路由配置处理
if (process.env.VERCEL !== '1') {
  // 自定义中间件来处理静态文件
  app.use('/static/*', async (c, next) => {
    const url = new URL(c.req.url);
    const path = url.pathname.replace('/static/', '');

    // 设置正确的Content-Type
    if (path.endsWith('.css')) {
      c.header('Content-Type', 'text/css; charset=utf-8');
    } else if (path.endsWith('.js')) {
      c.header('Content-Type', 'application/javascript; charset=utf-8');
    } else if (path.endsWith('.html')) {
      c.header('Content-Type', 'text/html; charset=utf-8');
    } else if (path.endsWith('.png')) {
      c.header('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      c.header('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.gif')) {
      c.header('Content-Type', 'image/gif');
    } else if (path.endsWith('.svg')) {
      c.header('Content-Type', 'image/svg+xml');
    } else if (path.endsWith('.ico')) {
      c.header('Content-Type', 'image/x-icon');
    } else if (path.endsWith('.json')) {
      c.header('Content-Type', 'application/json; charset=utf-8');
    }

    // 修改：直接映射到public目录，不保留/static/前缀
    return serveStatic({ root: './public', path })(c, next);
  });

  app.get('/', async (c) => {
    c.header('Content-Type', 'text/html; charset=utf-8');
    return serveStatic({ path: './public/index.html' })(c, async () => { });
  });
}

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
      c.header('Content-Type', 'text/html; charset=utf-8');
      return c.html('404 Not Found', 404);
    }
    return sendError(
      c,
      new ApiError(err.status, err.message),
      err.status as any,
    );
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
    c.header('Content-Type', 'text/html; charset=utf-8');
    return c.html('404 Not Found', 404);
  }
  c.header('Content-Type', 'application/json; charset=utf-8');
  return c.json({ success: false, message: '请求的资源未找到。' }, 404);
});

export default app;
