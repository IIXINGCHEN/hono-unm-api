import { PermissionRule, Role } from '../../types/permission.js';
import { StorageAdapter } from '../storage/index.js';
import { CacheAdapter } from '../cache/index.js';
import { permissionService } from './permissionService.js';
import logger from '../../utils/logger.js';

/**
 * 角色服务
 * 提供角色管理功能
 */
export class RoleService {
  private storage: StorageAdapter<Role> | null = null;
  private cache: CacheAdapter | null = null;

  /**
   * 设置存储适配器
   * @param storage 存储适配器
   */
  setStorage(storage: StorageAdapter<Role>): void {
    this.storage = storage;
    logger.info('角色服务已设置存储适配器');
  }

  /**
   * 设置缓存适配器
   * @param cache 缓存适配器
   */
  setCache(cache: CacheAdapter): void {
    this.cache = cache;
    permissionService.setCache(cache);
    logger.info('角色服务已设置缓存适配器');
  }

  /**
   * 创建角色
   * @param role 角色
   */
  async createRole(role: Role): Promise<Role> {
    if (!this.storage) {
      throw new Error('未设置存储适配器');
    }
    
    // 检查角色ID是否已存在
    const existingRole = await this.getRole(role.id);
    
    if (existingRole) {
      throw new Error(`角色ID ${role.id} 已存在`);
    }
    
    // 创建角色
    const result = await this.storage.create(role.id, role);
    
    if (!result.success || !result.data) {
      throw new Error(`创建角色失败: ${result.error?.message}`);
    }
    
    // 添加到权限服务
    permissionService.addRole(role);
    
    // 清除缓存
    if (this.cache) {
      await this.cache.delete(`role:${role.id}`);
      await permissionService.clearCache();
    }
    
    logger.info({
      roleId: role.id,
      name: role.name,
    }, '已创建角色');
    
    return result.data;
  }

  /**
   * 更新角色
   * @param id 角色ID
   * @param role 角色
   */
  async updateRole(id: string, role: Partial<Role>): Promise<Role> {
    if (!this.storage) {
      throw new Error('未设置存储适配器');
    }
    
    // 检查角色是否存在
    const existingRole = await this.getRole(id);
    
    if (!existingRole) {
      throw new Error(`角色ID ${id} 不存在`);
    }
    
    // 更新角色
    const result = await this.storage.update(id, role);
    
    if (!result.success || !result.data) {
      throw new Error(`更新角色失败: ${result.error?.message}`);
    }
    
    // 添加到权限服务
    permissionService.addRole(result.data);
    
    // 清除缓存
    if (this.cache) {
      await this.cache.delete(`role:${id}`);
      await permissionService.clearCache();
    }
    
    logger.info({
      roleId: id,
      name: result.data.name,
    }, '已更新角色');
    
    return result.data;
  }

  /**
   * 删除角色
   * @param id 角色ID
   */
  async deleteRole(id: string): Promise<boolean> {
    if (!this.storage) {
      throw new Error('未设置存储适配器');
    }
    
    // 检查角色是否存在
    const existingRole = await this.getRole(id);
    
    if (!existingRole) {
      throw new Error(`角色ID ${id} 不存在`);
    }
    
    // 删除角色
    const result = await this.storage.delete(id);
    
    if (!result.success) {
      throw new Error(`删除角色失败: ${result.error?.message}`);
    }
    
    // 清除缓存
    if (this.cache) {
      await this.cache.delete(`role:${id}`);
      await permissionService.clearCache();
    }
    
    logger.info({
      roleId: id,
    }, '已删除角色');
    
    return true;
  }

  /**
   * 获取角色
   * @param id 角色ID
   */
  async getRole(id: string): Promise<Role | null> {
    // 尝试从缓存中获取
    if (this.cache) {
      const cacheResult = await this.cache.get<Role>(`role:${id}`);
      
      if (cacheResult.success && cacheResult.data) {
        return cacheResult.data;
      }
    }
    
    if (!this.storage) {
      throw new Error('未设置存储适配器');
    }
    
    // 从存储中获取
    const result = await this.storage.get(id);
    
    if (!result.success || !result.data) {
      return null;
    }
    
    // 缓存结果
    if (this.cache) {
      await this.cache.set(`role:${id}`, result.data, 300); // 缓存5分钟
    }
    
    return result.data;
  }

  /**
   * 获取所有角色
   */
  async getAllRoles(): Promise<Role[]> {
    if (!this.storage) {
      throw new Error('未设置存储适配器');
    }
    
    const result = await this.storage.getMany();
    
    if (!result.success || !result.data) {
      return [];
    }
    
    return result.data;
  }

  /**
   * 添加权限到角色
   * @param roleId 角色ID
   * @param permissionId 权限ID
   */
  async addPermissionToRole(roleId: string, permissionId: string): Promise<Role> {
    // 获取角色
    const role = await this.getRole(roleId);
    
    if (!role) {
      throw new Error(`角色ID ${roleId} 不存在`);
    }
    
    // 检查权限是否已存在
    if (role.permissions.includes(permissionId)) {
      return role;
    }
    
    // 添加权限
    const updatedPermissions = [...role.permissions, permissionId];
    
    // 更新角色
    return this.updateRole(roleId, { permissions: updatedPermissions });
  }

  /**
   * 从角色中移除权限
   * @param roleId 角色ID
   * @param permissionId 权限ID
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<Role> {
    // 获取角色
    const role = await this.getRole(roleId);
    
    if (!role) {
      throw new Error(`角色ID ${roleId} 不存在`);
    }
    
    // 检查权限是否存在
    if (!role.permissions.includes(permissionId)) {
      return role;
    }
    
    // 移除权限
    const updatedPermissions = role.permissions.filter(id => id !== permissionId);
    
    // 更新角色
    return this.updateRole(roleId, { permissions: updatedPermissions });
  }

  /**
   * 添加继承角色
   * @param roleId 角色ID
   * @param inheritRoleId 继承的角色ID
   */
  async addInheritRole(roleId: string, inheritRoleId: string): Promise<Role> {
    // 获取角色
    const role = await this.getRole(roleId);
    
    if (!role) {
      throw new Error(`角色ID ${roleId} 不存在`);
    }
    
    // 检查继承的角色是否存在
    const inheritRole = await this.getRole(inheritRoleId);
    
    if (!inheritRole) {
      throw new Error(`继承的角色ID ${inheritRoleId} 不存在`);
    }
    
    // 检查是否已继承
    if (role.inherits && role.inherits.includes(inheritRoleId)) {
      return role;
    }
    
    // 添加继承
    const updatedInherits = role.inherits ? [...role.inherits, inheritRoleId] : [inheritRoleId];
    
    // 更新角色
    return this.updateRole(roleId, { inherits: updatedInherits });
  }

  /**
   * 移除继承角色
   * @param roleId 角色ID
   * @param inheritRoleId 继承的角色ID
   */
  async removeInheritRole(roleId: string, inheritRoleId: string): Promise<Role> {
    // 获取角色
    const role = await this.getRole(roleId);
    
    if (!role) {
      throw new Error(`角色ID ${roleId} 不存在`);
    }
    
    // 检查是否已继承
    if (!role.inherits || !role.inherits.includes(inheritRoleId)) {
      return role;
    }
    
    // 移除继承
    const updatedInherits = role.inherits.filter(id => id !== inheritRoleId);
    
    // 更新角色
    return this.updateRole(roleId, { inherits: updatedInherits });
  }
}

// 导出单例实例
export const roleService = new RoleService();
