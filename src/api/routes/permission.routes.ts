import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { permissionService, roleService } from '../../services/permission/index.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { ApiKeyPermission } from '../../types/auth.js';
import { OperationType, ResourceType } from '../../types/permission.js';
import { apiKeyAuthMiddleware } from '../../middleware/auth.middleware.js';
import { systemPermission } from '../../middleware/permission.middleware.js';
import { ApiError } from '../../utils/ApiError.js';

// 创建路由
const permissionRouter = new Hono();

// 角色创建请求验证模式
const roleCreateSchema = z.object({
  id: z.string().min(1, { message: 'ID不能为空' }).max(100),
  name: z.string().min(1, { message: '名称不能为空' }).max(100),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  inherits: z.array(z.string()).optional(),
});

// 角色更新请求验证模式
const roleUpdateSchema = z.object({
  name: z.string().min(1, { message: '名称不能为空' }).max(100).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  inherits: z.array(z.string()).optional(),
});

// 权限检查请求验证模式
const permissionCheckSchema = z.object({
  roleId: z.string().min(1, { message: '角色ID不能为空' }),
  resource: z.string().min(1, { message: '资源不能为空' }),
  operation: z.string().min(1, { message: '操作不能为空' }),
  path: z.string().min(1, { message: '路径不能为空' }),
});

// 获取所有角色
permissionRouter.get(
  '/roles',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  async (c) => {
    try {
      const roles = await roleService.getAllRoles();
      return sendSuccess(c, roles, '角色获取成功');
    } catch (error) {
      throw new ApiError(500, '获取角色失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 获取角色
permissionRouter.get(
  '/roles/:id',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  async (c) => {
    const id = c.req.param('id');
    
    try {
      const role = await roleService.getRole(id);
      
      if (!role) {
        throw new ApiError(404, '角色不存在');
      }
      
      return sendSuccess(c, role, '角色获取成功');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(500, '获取角色失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 创建角色
permissionRouter.post(
  '/roles',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  zValidator('json', roleCreateSchema),
  async (c) => {
    const data = c.req.valid('json');
    
    try {
      const role = await roleService.createRole(data);
      return sendSuccess(c, role, '角色创建成功');
    } catch (error) {
      throw new ApiError(500, '创建角色失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 更新角色
permissionRouter.put(
  '/roles/:id',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  zValidator('json', roleUpdateSchema),
  async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    
    try {
      const role = await roleService.updateRole(id, data);
      return sendSuccess(c, role, '角色更新成功');
    } catch (error) {
      throw new ApiError(500, '更新角色失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 删除角色
permissionRouter.delete(
  '/roles/:id',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  async (c) => {
    const id = c.req.param('id');
    
    try {
      await roleService.deleteRole(id);
      return sendSuccess(c, { success: true }, '角色删除成功');
    } catch (error) {
      throw new ApiError(500, '删除角色失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 添加权限到角色
permissionRouter.post(
  '/roles/:id/permissions/:permissionId',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  async (c) => {
    const id = c.req.param('id');
    const permissionId = c.req.param('permissionId');
    
    try {
      const role = await roleService.addPermissionToRole(id, permissionId);
      return sendSuccess(c, role, '权限添加成功');
    } catch (error) {
      throw new ApiError(500, '添加权限失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 从角色中移除权限
permissionRouter.delete(
  '/roles/:id/permissions/:permissionId',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  async (c) => {
    const id = c.req.param('id');
    const permissionId = c.req.param('permissionId');
    
    try {
      const role = await roleService.removePermissionFromRole(id, permissionId);
      return sendSuccess(c, role, '权限移除成功');
    } catch (error) {
      throw new ApiError(500, '移除权限失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 添加继承角色
permissionRouter.post(
  '/roles/:id/inherits/:inheritId',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  async (c) => {
    const id = c.req.param('id');
    const inheritId = c.req.param('inheritId');
    
    try {
      const role = await roleService.addInheritRole(id, inheritId);
      return sendSuccess(c, role, '继承角色添加成功');
    } catch (error) {
      throw new ApiError(500, '添加继承角色失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 移除继承角色
permissionRouter.delete(
  '/roles/:id/inherits/:inheritId',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  async (c) => {
    const id = c.req.param('id');
    const inheritId = c.req.param('inheritId');
    
    try {
      const role = await roleService.removeInheritRole(id, inheritId);
      return sendSuccess(c, role, '继承角色移除成功');
    } catch (error) {
      throw new ApiError(500, '移除继承角色失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

// 检查权限
permissionRouter.post(
  '/check',
  apiKeyAuthMiddleware({ 
    required: true, 
    requiredPermission: ApiKeyPermission.ADMIN 
  }),
  systemPermission(),
  zValidator('json', permissionCheckSchema),
  async (c) => {
    const data = c.req.valid('json');
    
    try {
      const result = await permissionService.checkPermission(data);
      return sendSuccess(c, result, '权限检查成功');
    } catch (error) {
      throw new ApiError(500, '权限检查失败', [
        { message: error instanceof Error ? error.message : String(error) }
      ]);
    }
  }
);

export default permissionRouter;
