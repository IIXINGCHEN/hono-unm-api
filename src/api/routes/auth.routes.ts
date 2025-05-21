import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { apiKeyService } from '../../services/apiKey.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { ApiKeyPermission } from '../../types/auth.js';
import { apiKeyAuthMiddleware, permissionMiddleware } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../utils/ApiError.js';

// 创建路由
const authRouter = new Hono();

// API密钥创建请求验证模式
const apiKeyCreateSchema = z.object({
  name: z.string().min(1, { message: '名称不能为空' }).max(100),
  clientId: z.string().min(1, { message: '客户端ID不能为空' }).max(100),
  domain: z.string().min(1, { message: '域名不能为空' }).max(100),
  expiresIn: z.number().optional(),
  permission: z.enum([
    ApiKeyPermission.READ,
    ApiKeyPermission.STANDARD,
    ApiKeyPermission.ADMIN
  ]).optional(),
  metadata: z.record(z.any()).optional(),
});

// API密钥刷新请求验证模式
const apiKeyRefreshSchema = z.object({
  keyId: z.string().min(1, { message: 'API密钥ID不能为空' }),
  expiresIn: z.number().optional(),
});

// API密钥撤销请求验证模式
const apiKeyRevokeSchema = z.object({
  keyId: z.string().min(1, { message: 'API密钥ID不能为空' }),
});

// 获取API密钥信息请求验证模式
const apiKeyInfoSchema = z.object({
  keyId: z.string().min(1, { message: 'API密钥ID不能为空' }),
});

// 获取客户端API密钥请求验证模式
const clientApiKeysSchema = z.object({
  clientId: z.string().min(1, { message: '客户端ID不能为空' }),
});

// 创建API密钥
authRouter.post(
  '/keys',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  zValidator('json', apiKeyCreateSchema),
  async (c) => {
    const data = c.req.valid('json');

    try {
      const result = await apiKeyService.createApiKey(data);
      return sendSuccess(c, result, 'API密钥创建成功');
    } catch (error) {
      throw new ApiError(500, '创建API密钥失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 刷新API密钥
authRouter.post(
  '/keys/refresh',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  zValidator('json', apiKeyRefreshSchema),
  async (c) => {
    const { keyId, expiresIn } = c.req.valid('json');

    try {
      const result = await apiKeyService.refreshApiKey(keyId, expiresIn);

      if (!result) {
        throw new ApiError(404, 'API密钥不存在或已失效');
      }

      return sendSuccess(c, result, 'API密钥刷新成功');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, '刷新API密钥失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 撤销API密钥
authRouter.post(
  '/keys/revoke',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  zValidator('json', apiKeyRevokeSchema),
  async (c) => {
    const { keyId } = c.req.valid('json');

    try {
      const success = await apiKeyService.revokeApiKey(keyId);

      if (!success) {
        throw new ApiError(404, 'API密钥不存在');
      }

      return sendSuccess(c, { success }, 'API密钥撤销成功');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, '撤销API密钥失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 获取API密钥信息
authRouter.get(
  '/keys/:keyId',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  async (c) => {
    const keyId = c.req.param('keyId');

    try {
      const keyInfo = await apiKeyService.getApiKeyInfo(keyId);

      if (!keyInfo) {
        throw new ApiError(404, 'API密钥不存在');
      }

      return sendSuccess(c, keyInfo, 'API密钥信息获取成功');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, '获取API密钥信息失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 获取客户端的所有API密钥
authRouter.get(
  '/keys/client/:clientId',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.ADMIN
  }),
  async (c) => {
    const clientId = c.req.param('clientId');

    try {
      const keys = await apiKeyService.getClientApiKeys(clientId);
      return sendSuccess(c, keys, '客户端API密钥获取成功');
    } catch (error) {
      throw new ApiError(500, '获取客户端API密钥失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 验证API密钥
authRouter.get(
  '/keys/verify',
  apiKeyAuthMiddleware({
    required: true,
    validateSignature: true
  }),
  async (c) => {
    // 如果请求能到达这里，说明API密钥验证已通过
    const apiKey = c.get('apiKey');
    const auth = c.get('auth');

    return sendSuccess(c, {
      valid: true,
      clientId: auth!.clientId,
      permission: auth!.permission,
      keyInfo: {
        id: apiKey!.id,
        name: apiKey!.name,
        domain: apiKey!.domain,
        expiresAt: apiKey!.expiresAt,
        status: apiKey!.status,
      }
    }, 'API密钥验证成功');
  }
);

// 生成请求签名示例
authRouter.post(
  '/signature/generate',
  apiKeyAuthMiddleware({
    required: true,
    requiredPermission: ApiKeyPermission.STANDARD
  }),
  async (c) => {
    const apiKey = c.get('apiKey');
    const body = await c.req.json();

    const { method, path } = body;

    if (!method || !path) {
      throw new ApiError(400, '请求方法和路径不能为空');
    }

    const signature = apiKeyService.generateSignature(
      apiKey!.id,
      method,
      path,
      body.body
    );

    return sendSuccess(c, {
      signature,
      headers: {
        'X-API-Key': `${apiKey!.id}.[YOUR_API_KEY]`,
        'X-Timestamp': signature.timestamp,
        'X-Nonce': signature.nonce,
        'X-Signature': signature.signature,
      }
    }, '签名生成成功');
  }
);

export default authRouter;
