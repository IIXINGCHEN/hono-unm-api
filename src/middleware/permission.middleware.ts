import { Context, Next } from 'hono';
import { ResourceType } from '../types/permission.js';
import { ApiKeyPermission } from '../types/auth.js';
import { permissionService } from '../services/permission/index.js';
import { securityMonitor } from '../services/monitor/index.js';
import { SecurityEventSeverity, SecurityEventType } from '../types/monitor.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * 权限中间件选项
 */
interface PermissionMiddlewareOptions {
  resource: ResourceType | string;
  defaultRole?: string;
  skipAuth?: boolean;
}

/**
 * 权限验证中间件
 * 验证请求是否有权限访问资源
 * @param options 选项
 */
export const permissionMiddleware = (options: PermissionMiddlewareOptions) => {
  const { resource, defaultRole = 'read', skipAuth = false } = options;
  
  return async (c: Context, next: Next) => {
    // 获取认证信息
    const auth = c.get('auth');
    
    // 如果未认证且不跳过认证，则返回401错误
    if (!skipAuth && (!auth || !auth.authenticated)) {
      throw new ApiError(401, '请求被拒绝：未认证');
    }
    
    // 确定角色ID
    let roleId = defaultRole;
    
    if (auth && auth.authenticated) {
      // 根据API密钥权限确定角色
      switch (auth.permission) {
        case ApiKeyPermission.ADMIN:
          roleId = 'admin';
          break;
        case ApiKeyPermission.STANDARD:
          roleId = 'standard';
          break;
        case ApiKeyPermission.READ:
          roleId = 'read';
          break;
      }
    }
    
    // 获取请求信息
    const method = c.req.method;
    const path = c.req.path;
    
    // 创建上下文
    const context: Record<string, any> = {
      apiKey: c.get('apiKey'),
      auth,
      requestId: c.get('requestId'),
    };
    
    // 检查权限
    const result = await permissionService.checkHttpPermission(
      roleId,
      method,
      path,
      resource,
      context
    );
    
    // 如果没有权限，则返回403错误
    if (!result.allowed) {
      const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 
        c.env.ip || 
        'unknown';
      
      logger.warn({
        ip,
        path,
        method,
        roleId,
        resource,
        reason: result.reason,
      }, '请求被拒绝：权限不足');
      
      // 记录安全事件
      securityMonitor.logEvent({
        type: SecurityEventType.UNAUTHORIZED,
        ip,
        path,
        severity: SecurityEventSeverity.MEDIUM,
        details: {
          method,
          roleId,
          resource,
          reason: result.reason,
        }
      });
      
      throw new ApiError(403, '请求被拒绝：权限不足');
    }
    
    return next();
  };
};

/**
 * 资源权限中间件
 * 为特定资源类型创建权限中间件
 * @param resource 资源类型
 */
export const resourcePermission = (resource: ResourceType) => {
  return permissionMiddleware({ resource });
};

/**
 * 音乐资源权限中间件
 */
export const musicPermission = () => {
  return resourcePermission(ResourceType.MUSIC);
};

/**
 * API密钥资源权限中间件
 */
export const apiKeyPermission = () => {
  return resourcePermission(ResourceType.API_KEY);
};

/**
 * 系统资源权限中间件
 */
export const systemPermission = () => {
  return resourcePermission(ResourceType.SYSTEM);
};

/**
 * 监控资源权限中间件
 */
export const monitorPermission = () => {
  return resourcePermission(ResourceType.MONITOR);
};
