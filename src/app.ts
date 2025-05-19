import { Hono } from 'hono';
import { cors } from '@hono/cors';
import { secureHeaders } from 'hono/secure-headers'; // Hono 内置安全头
import { logger as honoLoggerMiddleware } from 'hono/logger'; // Hono 内置简单日志
import { serveStatic } from '@hono/node-server/serve-static'; // Node.js 环境服务静态文件
// import { serveStatic } from 'hono/bun'; // Bun 环境服务静态文件
// import { serveStatic } from 'hono/deno'; // Deno 环境服务静态文件

import config from '@/config';
import logger from '@/utils/logger'; // 我们的 Pino logger
import apiV1Router from '@/api/routes';
import { sendError } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';

// 创建 Hono 应用实例
// Hono<Environment, Schema, BasePath>
// Environment 可以用来扩展 Context (c.env)
// Schema 可以用来做类型安全的路由 (TypeSafe Routing)
// BasePath 是应用的根路径前缀
const app = new Hono();

// 1. 全局中间件
// -----------------------------------------------------------------------------

// 安全头 (推荐开启)
app.use('*', secureHeaders());

// CORS 配置
app.use(
  '*',
  cors({
    origin: config.allowedOrigins, // 可以是字符串、字符串数组，或返回字符串/布尔值的函数
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true, // 如果需要传递 cookie
    maxAge: 86400, // 预检请求的缓存时间 (秒)
  }),
);

// Hono 内置的请求日志 (简单格式，可用于快速调试)
if (config.nodeEnv === 'development') {
  app.use('*', honoLoggerMiddleware());
}
// 注意：如果使用 @hono/node-server 并集成了 pino-http，则 Hono 的 logger 可能冗余
// 对于生产环境，推荐使用更结构化的日志，如通过 pino-http 集成 (见 server.ts)

// 2. 静态文件服务 (如果需要 Hono 应用自身处理)
// -----------------------------------------------------------------------------
// Node.js:
app.use('/static/*', serveStatic({ root: './public/' }));
app.get('/', serveStatic({ path: './public/index.html' }));
// 对于 Bun:
// app.use('/static/*', serveStatic({ root: './public/' }))
// app.get('/', serveStatic({ path: './public/index.html' }))
// 对于 Deno:
// app.use('/static/*', serveStatic({ root: './public/' }))
// app.get('/', serveStatic({ path: './public/index.html' }))


// 3. API 路由
// -----------------------------------------------------------------------------
app.route('/api/v1', apiV1Router); // 所有 API 路由以 /api/v1 开头


// 4. 全局错误处理
// -----------------------------------------------------------------------------
app.onError((err, c) => {
  logger.error(
    {
      err,
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
      // params: c.req.param(), // 如果有路径参数
      // body: await c.req.json().catch(() => ({})), // 小心：重复读取 body 可能导致问题
    },
    '捕获到未处理的错误 (app.onError)',
  );

  if (err instanceof ApiError) {
    return sendError(c, err);
  }
  // ZodError 会被 @hono/zod-validator 自动处理并返回 400，但如果直接在服务层使用Zod抛出，
  // 或者其他中间件抛出ZodError，则这里可以捕获。
  if (err.name === 'ZodError') {
      return sendError(c, err, 400);
  }

  // Hono HTTPException (如路由未找到，它会抛出 HTTPException 404)
  if ('getResponse' in err && typeof err.getResponse === 'function') {
    // 如果是 HTTPException，直接返回它的响应
    // 或者自定义处理：
    // const status = err.status || 500;
    // return sendError(c, new ApiError(status, err.message || 'HTTP Exception'));
    return err.getResponse();
  }
  
  // 对于其他未知错误
  return sendError(c, new ApiError(500, '服务器内部发生未知错误。'));
});

// 5. 404 Not Found 处理 (如果路由未匹配且不是 HTTPException)
// -----------------------------------------------------------------------------
// Hono 会自动处理未匹配路由并抛出 HTTPException (status 404)
// 该错误会被上面的 app.onError 捕获并可以返回 err.getResponse()
// 如果需要自定义HTML 404页面，可以这样做：
app.notFound((c) => {
    if (c.req.header('accept')?.includes('text/html')) {
        // 尝试服务 public/404.html
        // 注意: serveStatic 在 Node.js 环境下需要特定配置
        // 对于更简单的 HTML 响应:
        // return c.html('<h1>404 Not Found</h1><p>The page you are looking for does not exist.</p>', 404);
        // 或者如果静态文件服务配置正确，理论上可以直接返回文件
        // 这里我们用一个简单的 JSON 响应，或者期望onError处理
        return c.json({ success: false, message: '请求的资源未找到。' }, 404);
    }
    return c.json({ success: false, message: '请求的资源未找到。' }, 404);
});


export default app; // 导出 Hono app 实例
