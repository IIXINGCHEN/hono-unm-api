import { Context, Next } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { securityMonitor } from '../utils/securityMonitor.js';

// 速率限制实现
class SimpleRateLimiter {
  private requests: Map<string, { count: number, resetTime: number }> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs = 15 * 60 * 1000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // 定期清理过期记录
    setInterval(() => {
      const now = Date.now();
      for (const [ip, record] of this.requests.entries()) {
        if (now > record.resetTime) {
          this.requests.delete(ip);
        }
      }
    }, 60000); // 每分钟清理一次
  }

  check(ip: string): boolean {
    const now = Date.now();
    const record = this.requests.get(ip);

    if (!record) {
      this.requests.set(ip, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + this.windowMs;
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }
}

// 创建速率限制器实例
const rateLimiter = new SimpleRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 默认15分钟
  parseInt(process.env.RATE_LIMIT_MAX || '100', 10) // 默认100请求
);

// 安全中间件
export const securityMiddleware = [
  // 安全头中间件
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", config.externalMusicApiUrl],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  }),

  // CORS中间件
  cors({
    origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  }),

  // 速率限制中间件
  async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.env.ip ||
      'unknown';

    if (!rateLimiter.check(ip)) {
      logger.warn({ ip, path: c.req.path }, '请求速率超限');

      // 记录速率限制安全事件
      securityMonitor.logEvent({
        type: 'rate_limit',
        ip,
        path: c.req.path,
        details: {
          userAgent: c.req.header('user-agent') || 'unknown',
          method: c.req.method
        }
      });

      return c.json({
        success: false,
        message: '请求过于频繁，请稍后再试',
      }, 429);
    }

    return next();
  },

  // 请求ID中间件
  async (c: Context, next: Next) => {
    const requestId = crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);
    return next();
  },

  // 安全日志中间件
  async (c: Context, next: Next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || c.env.ip || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    const requestId = c.get('requestId') || 'no-id';

    logger.info({
      requestId,
      method,
      path,
      ip,
      userAgent,
      event: 'request_start'
    }, '收到API请求');

    try {
      await next();
    } catch (err) {
      const duration = Date.now() - start;
      logger.error({
        requestId,
        method,
        path,
        ip,
        duration,
        error: err,
        event: 'request_error'
      }, '请求处理错误');
      throw err;
    }

    const duration = Date.now() - start;
    logger.info({
      requestId,
      method,
      path,
      ip,
      duration,
      event: 'request_end'
    }, '请求处理完成');
  }
];

// 导出单独的中间件，以便可以单独使用
export const rateLimitMiddleware = async (c: Context, next: Next) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.env.ip ||
    'unknown';

  if (!rateLimiter.check(ip)) {
    logger.warn({ ip, path: c.req.path }, '请求速率超限');
    return c.json({
      success: false,
      message: '请求过于频繁，请稍后再试',
    }, 429);
  }

  return next();
};
