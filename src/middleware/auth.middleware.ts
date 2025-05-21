import { Context, Next } from 'hono';
import { ApiKeyPermission, AuthErrorType, RequestSignature } from '../types/auth.js';
import { apiKeyService } from '../services/apiKey.service.js';
import logger from '../utils/logger.js';
import { securityMonitor } from '../utils/securityMonitor.js';
import { ApiError } from '../utils/ApiError.js';
import config from '../config/index.js';

/**
 * API密钥验证中间件选项
 */
interface ApiKeyAuthOptions {
  required?: boolean; // 是否必须提供API密钥
  requiredPermission?: ApiKeyPermission; // 所需权限
  validateSignature?: boolean; // 是否验证请求签名
  excludePaths?: string[]; // 排除的路径
}

/**
 * API密钥验证中间件
 * @param options 选项
 */
export const apiKeyAuthMiddleware = (options: ApiKeyAuthOptions = {}) => {
  const {
    required = true,
    requiredPermission = ApiKeyPermission.STANDARD,
    validateSignature = false,
    excludePaths = [],
  } = options;

  return async (c: Context, next: Next) => {
    // 如果API密钥验证被禁用，则跳过验证
    if (!config.apiKeyEnabled) {
      // 设置未认证状态但允许继续
      c.set('auth', { authenticated: false });
      return next();
    }

    // 检查是否排除当前路径
    const path = c.req.path;
    if (excludePaths.some(excludePath => {
      // 支持通配符路径，例如 /api/v1/public/*
      if (excludePath.endsWith('*')) {
        const prefix = excludePath.slice(0, -1);
        return path.startsWith(prefix);
      }
      return path === excludePath;
    })) {
      return next();
    }

    // 获取API密钥
    const apiKey = c.req.header('X-API-Key') || c.req.query('api_key');

    // 如果没有提供API密钥
    if (!apiKey) {
      // 如果API密钥是必需的，则返回401错误
      if (required) {
        const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
          c.env.ip ||
          'unknown';

        logger.warn({
          ip,
          path,
          method: c.req.method,
        }, '请求被拒绝：缺少API密钥');

        // 记录安全事件
        securityMonitor.logEvent({
          type: 'unauthorized',
          ip,
          path,
          details: {
            method: c.req.method,
            reason: AuthErrorType.MISSING_API_KEY,
          }
        });

        throw new ApiError(401, '请求被拒绝：缺少API密钥');
      }

      // 如果API密钥不是必需的，则设置未认证状态并继续
      c.set('auth', { authenticated: false });
      return next();
    }

    // 获取请求域名
    let domain: string | null = null;
    const origin = c.req.header('origin');
    const referer = c.req.header('referer');

    if (origin) {
      try {
        const url = new URL(origin);
        domain = url.hostname;
      } catch (error) {
        // 无效的Origin，忽略
      }
    } else if (referer) {
      try {
        const url = new URL(referer);
        domain = url.hostname;
      } catch (error) {
        // 无效的Referer，忽略
      }
    }

    // 验证API密钥
    const validationResult = await apiKeyService.validateApiKey(apiKey, domain || undefined);

    // 如果API密钥无效
    if (!validationResult.valid) {
      const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
        c.env.ip ||
        'unknown';

      logger.warn({
        ip,
        path,
        method: c.req.method,
        error: validationResult.error,
      }, '请求被拒绝：API密钥验证失败');

      // 记录安全事件
      securityMonitor.logEvent({
        type: 'unauthorized',
        ip,
        path,
        details: {
          method: c.req.method,
          reason: validationResult.error,
        }
      });

      // 根据错误类型返回不同的错误消息
      let statusCode = 401;
      let message = '请求被拒绝：API密钥验证失败';

      switch (validationResult.error) {
        case AuthErrorType.INVALID_API_KEY:
          message = '请求被拒绝：无效的API密钥';
          break;
        case AuthErrorType.EXPIRED_API_KEY:
          message = '请求被拒绝：API密钥已过期';
          break;
        case AuthErrorType.REVOKED_API_KEY:
          message = '请求被拒绝：API密钥已被撤销';
          break;
        case AuthErrorType.DOMAIN_NOT_ALLOWED:
          statusCode = 403;
          message = '请求被拒绝：域名不在白名单中';
          break;
      }

      throw new ApiError(statusCode, message);
    }

    // 检查权限
    if (validationResult.keyInfo!.permission < requiredPermission) {
      const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
        c.env.ip ||
        'unknown';

      logger.warn({
        ip,
        path,
        method: c.req.method,
        keyId: validationResult.keyInfo!.id,
        clientId: validationResult.keyInfo!.clientId,
        permission: validationResult.keyInfo!.permission,
        requiredPermission,
      }, '请求被拒绝：权限不足');

      // 记录安全事件
      securityMonitor.logEvent({
        type: 'unauthorized',
        ip,
        path,
        details: {
          method: c.req.method,
          keyId: validationResult.keyInfo!.id,
          clientId: validationResult.keyInfo!.clientId,
          reason: AuthErrorType.INSUFFICIENT_PERMISSION,
        }
      });

      throw new ApiError(403, '请求被拒绝：权限不足');
    }

    // 如果需要验证请求签名
    if (validateSignature) {
      // 获取签名信息
      const timestamp = c.req.header('X-Timestamp');
      const nonce = c.req.header('X-Nonce');
      const signature = c.req.header('X-Signature');

      // 如果缺少签名信息
      if (!timestamp || !nonce || !signature) {
        const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
          c.env.ip ||
          'unknown';

        logger.warn({
          ip,
          path,
          method: c.req.method,
          keyId: validationResult.keyInfo!.id,
          clientId: validationResult.keyInfo!.clientId,
        }, '请求被拒绝：缺少签名信息');

        // 记录安全事件
        securityMonitor.logEvent({
          type: 'unauthorized',
          ip,
          path,
          details: {
            method: c.req.method,
            keyId: validationResult.keyInfo!.id,
            clientId: validationResult.keyInfo!.clientId,
            reason: AuthErrorType.INVALID_SIGNATURE,
          }
        });

        throw new ApiError(401, '请求被拒绝：缺少签名信息');
      }

      // 解析签名信息
      const signatureInfo: RequestSignature = {
        timestamp: parseInt(timestamp),
        nonce,
        signature,
      };

      // 验证签名
      const keyId = apiKey.split('.')[0];
      const method = c.req.method;
      const requestPath = c.req.path;

      // 获取请求体
      let body: any = null;
      if (method !== 'GET' && method !== 'HEAD') {
        try {
          const contentType = c.req.header('content-type') || '';
          if (contentType.includes('application/json')) {
            body = await c.req.json();
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            body = await c.req.parseBody();
          }
        } catch (error) {
          // 无法解析请求体，忽略
        }
      }

      // 验证签名
      const isValidSignature = apiKeyService.verifySignature(
        keyId,
        method,
        requestPath,
        signatureInfo,
        body
      );

      // 如果签名无效
      if (!isValidSignature) {
        const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
          c.env.ip ||
          'unknown';

        logger.warn({
          ip,
          path,
          method: c.req.method,
          keyId: validationResult.keyInfo!.id,
          clientId: validationResult.keyInfo!.clientId,
        }, '请求被拒绝：签名验证失败');

        // 记录安全事件
        securityMonitor.logEvent({
          type: 'unauthorized',
          ip,
          path,
          details: {
            method: c.req.method,
            keyId: validationResult.keyInfo!.id,
            clientId: validationResult.keyInfo!.clientId,
            reason: AuthErrorType.INVALID_SIGNATURE,
          }
        });

        throw new ApiError(401, '请求被拒绝：签名验证失败');
      }
    }

    // 设置认证信息
    c.set('apiKey', validationResult.keyInfo!);
    c.set('auth', {
      authenticated: true,
      clientId: validationResult.keyInfo!.clientId,
      permission: validationResult.keyInfo!.permission,
    });

    return next();
  };
};

/**
 * 权限验证中间件
 * @param requiredPermission 所需权限
 */
export const permissionMiddleware = (requiredPermission: ApiKeyPermission) => {
  return async (c: Context, next: Next) => {
    // 检查是否在测试环境中
    const isTestEnv = process.env.ENV_FILE === '.env.production.test';

    if (isTestEnv) {
      // 测试环境：允许所有请求
      logger.info('测试环境：权限检查已跳过');
      return next();
    }

    const auth = c.get('auth');

    // 如果未认证
    if (!auth || !auth.authenticated) {
      throw new ApiError(401, '请求被拒绝：未认证');
    }

    // 使用类型守卫确保 auth.permission 存在
    if (typeof auth.permission === 'undefined') {
      throw new ApiError(403, '请求被拒绝：未设置权限');
    }

    // 如果权限不足
    if (auth.permission < requiredPermission) {
      throw new ApiError(403, '请求被拒绝：权限不足');
    }

    return next();
  };
};
