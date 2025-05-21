import { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { securityMonitor } from '../utils/securityMonitor.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * 增强的CORS中间件
 * 提供严格的域名白名单验证
 */
export const enhancedCorsMiddleware = () => {
  // 使用Hono的CORS中间件
  const corsMiddleware = cors({
    origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With', 
      'Accept',
      'X-API-Key',
      'X-Signature',
      'X-Timestamp',
      'X-Nonce'
    ],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  });

  // 返回增强的中间件
  return async (c: Context, next: Next) => {
    // 获取请求的Origin
    const origin = c.req.header('origin');
    
    // 如果没有Origin头，可能是非浏览器请求或同源请求，直接放行
    if (!origin) {
      return next();
    }
    
    // 如果配置了允许的源，并且不包含通配符，则进行严格验证
    if (config.allowedOrigins.length > 0 && !config.allowedOrigins.includes('*')) {
      // 检查请求的Origin是否在白名单中
      const isAllowed = config.allowedOrigins.some(allowedOrigin => {
        // 支持通配符子域名，例如 *.example.com
        if (allowedOrigin.startsWith('*.')) {
          const domain = allowedOrigin.substring(2);
          return origin.endsWith(domain) && origin.includes('.');
        }
        return origin === allowedOrigin;
      });
      
      // 如果不在白名单中，记录安全事件并返回403错误
      if (!isAllowed) {
        const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 
          c.env.ip || 
          'unknown';
        
        logger.warn({
          origin,
          ip,
          path: c.req.path,
          method: c.req.method,
        }, '跨域请求被拒绝：域名不在白名单中');
        
        // 记录安全事件
        securityMonitor.logEvent({
          type: 'unauthorized',
          ip,
          path: c.req.path,
          details: {
            origin,
            method: c.req.method,
            reason: 'domain_not_allowed',
          }
        });
        
        // 返回403错误
        throw new ApiError(403, '跨域请求被拒绝：域名不在白名单中');
      }
    }
    
    // 应用Hono的CORS中间件
    return corsMiddleware(c, next);
  };
};

/**
 * 域名验证中间件
 * 用于验证请求的Referer或Origin是否在白名单中
 */
export const domainVerificationMiddleware = () => {
  return async (c: Context, next: Next) => {
    // 如果没有配置允许的源，或者包含通配符，则跳过验证
    if (config.allowedOrigins.length === 0 || config.allowedOrigins.includes('*')) {
      return next();
    }
    
    // 获取请求的Referer或Origin
    const referer = c.req.header('referer');
    const origin = c.req.header('origin');
    
    // 如果既没有Referer也没有Origin，可能是API客户端请求，直接放行
    // API密钥验证中间件会进行进一步验证
    if (!referer && !origin) {
      return next();
    }
    
    // 解析域名
    let domain: string | null = null;
    
    if (referer) {
      try {
        const url = new URL(referer);
        domain = url.hostname;
      } catch (error) {
        // 无效的Referer，忽略
      }
    } else if (origin) {
      try {
        const url = new URL(origin);
        domain = url.hostname;
      } catch (error) {
        // 无效的Origin，忽略
      }
    }
    
    // 如果无法解析域名，直接放行
    if (!domain) {
      return next();
    }
    
    // 检查域名是否在白名单中
    const isAllowed = config.allowedOrigins.some(allowedOrigin => {
      try {
        const url = new URL(allowedOrigin.startsWith('http') ? allowedOrigin : `https://${allowedOrigin}`);
        const allowedDomain = url.hostname;
        
        // 支持通配符子域名，例如 *.example.com
        if (allowedDomain.startsWith('*.')) {
          const baseDomain = allowedDomain.substring(2);
          return domain!.endsWith(baseDomain) && domain!.includes('.');
        }
        
        return domain === allowedDomain;
      } catch (error) {
        // 无效的允许源，忽略
        return false;
      }
    });
    
    // 如果不在白名单中，记录安全事件并返回403错误
    if (!isAllowed) {
      const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 
        c.env.ip || 
        'unknown';
      
      logger.warn({
        domain,
        ip,
        path: c.req.path,
        method: c.req.method,
      }, '请求被拒绝：域名不在白名单中');
      
      // 记录安全事件
      securityMonitor.logEvent({
        type: 'unauthorized',
        ip,
        path: c.req.path,
        details: {
          domain,
          method: c.req.method,
          reason: 'domain_not_allowed',
        }
      });
      
      // 返回403错误
      throw new ApiError(403, '请求被拒绝：域名不在白名单中');
    }
    
    return next();
  };
};
