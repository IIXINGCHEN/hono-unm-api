import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { securityMonitor } from '../../services/monitor/securityMonitor.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { ApiKeyPermission } from '../../types/auth.js';
import { SecurityEventSeverity, SecurityEventType } from '../../types/monitor.js';
import { apiKeyAuthMiddleware } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../utils/ApiError.js';

// 创建路由
const monitorRouter = new Hono();

// 安全事件查询请求验证模式
const securityEventQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  type: z.nativeEnum(SecurityEventType).optional(),
  severity: z.nativeEnum(SecurityEventSeverity).optional(),
  ip: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// 获取安全事件列表
monitorRouter.get(
  '/security/events',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  zValidator('query', securityEventQuerySchema),
  async (c) => {
    const query = c.req.valid('query');

    try {
      const events = await securityMonitor.getEvents(query);
      return sendSuccess(c, events, '安全事件获取成功');
    } catch (error) {
      throw new ApiError(500, '获取安全事件失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 获取安全事件统计
monitorRouter.get(
  '/security/stats',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  async (c) => {
    try {
      const stats = await securityMonitor.getStats();
      return sendSuccess(c, stats, '安全事件统计获取成功');
    } catch (error) {
      throw new ApiError(500, '获取安全事件统计失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 获取最近的安全事件
monitorRouter.get(
  '/security/recent',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  async (c) => {
    try {
      const events = await securityMonitor.getEvents({ limit: 10 });
      return sendSuccess(c, events, '最近安全事件获取成功');
    } catch (error) {
      throw new ApiError(500, '获取最近安全事件失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 获取特定IP的安全事件
monitorRouter.get(
  '/security/ip/:ip',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  async (c) => {
    const ip = c.req.param('ip');

    try {
      const events = await securityMonitor.getEvents({ ip });
      return sendSuccess(c, events, `IP ${ip} 的安全事件获取成功`);
    } catch (error) {
      throw new ApiError(500, '获取IP安全事件失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 获取特定类型的安全事件
monitorRouter.get(
  '/security/type/:type',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  async (c) => {
    const typeParam = c.req.param('type');

    // 验证类型是否有效
    if (!Object.values(SecurityEventType).includes(typeParam as SecurityEventType)) {
      throw new ApiError(400, '无效的安全事件类型', [
        { message: `类型 ${typeParam} 不是有效的安全事件类型` }
      ]);
    }

    const type = typeParam as SecurityEventType;

    try {
      const events = await securityMonitor.getEvents({ type });
      return sendSuccess(c, events, `类型 ${type} 的安全事件获取成功`);
    } catch (error) {
      throw new ApiError(500, '获取类型安全事件失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 获取特定严重级别的安全事件
monitorRouter.get(
  '/security/severity/:severity',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  async (c) => {
    const severityParam = c.req.param('severity');

    // 验证严重级别是否有效
    if (!Object.values(SecurityEventSeverity).includes(severityParam as SecurityEventSeverity)) {
      throw new ApiError(400, '无效的安全事件严重级别', [
        { message: `严重级别 ${severityParam} 不是有效的安全事件严重级别` }
      ]);
    }

    const severity = severityParam as SecurityEventSeverity;

    try {
      const events = await securityMonitor.getEvents({ severity });
      return sendSuccess(c, events, `严重级别 ${severity} 的安全事件获取成功`);
    } catch (error) {
      throw new ApiError(500, '获取严重级别安全事件失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

export default monitorRouter;
