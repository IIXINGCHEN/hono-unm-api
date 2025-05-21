import {
  PermissionCondition,
  PermissionConfig,
  PermissionRule,
  Role,
} from '../../types/permission.js';
import { permissionService } from './permissionService.js';
import { roleService } from './roleService.js';
import { StorageAdapter, StorageFactory, StorageType } from '../storage/index.js';
import { CacheAdapter, CacheFactory, CacheType } from '../cache/index.js';
import logger from '../../utils/logger.js';

/**
 * 权限系统工厂
 * 提供权限系统的初始化和配置功能
 */
export class PermissionFactory {
  private static initialized = false;

  /**
   * 初始化权限系统
   * @param config 配置
   */
  static async initialize(config: {
    permissionEnabled: boolean;
    defaultRole: string;
    storageType: string;
    storagePath: string;
    encryptionKey?: string;
    cacheType: string;
    cacheTtl: number;
  }): Promise<void> {
    if (this.initialized) {
      logger.debug('权限系统已经初始化，跳过');
      return;
    }

    if (!config.permissionEnabled) {
      logger.info('权限系统未启用');
      return;
    }

    try {
      // 创建权限系统配置
      const permissionConfig = this.createDefaultConfig();
      permissionConfig.enabled = config.permissionEnabled;
      permissionConfig.defaultRole = config.defaultRole;

      // 获取存储适配器
      const roleStorage = StorageFactory.getStorage<Role>('roles');

      if (!roleStorage) {
        logger.warn('未找到角色存储适配器，将使用内存存储');
      }

      // 获取缓存适配器
      const permissionCache = CacheFactory.getCache('permission');

      if (!permissionCache) {
        logger.warn('未找到权限缓存适配器，将使用内存缓存');
      }

      // 初始化权限系统
      await this.initializeWithConfig(
        permissionConfig,
        roleStorage,
        permissionCache
      );

      this.initialized = true;
      logger.info('权限系统初始化成功');
    } catch (error) {
      logger.error({ err: error }, '初始化权限系统失败');
      throw new Error(`初始化权限系统失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 使用配置初始化权限系统
   * @param config 权限系统配置
   * @param storage 存储适配器
   * @param cache 缓存适配器
   */
  static async initializeWithConfig(
    config: PermissionConfig,
    storage?: StorageAdapter<any>,
    cache?: CacheAdapter
  ): Promise<void> {
    // 如果未启用，则直接返回
    if (!config.enabled) {
      logger.info('权限系统未启用');
      return;
    }

    // 检查是否在测试环境中
    const isTestEnv = process.env.ENV_FILE === '.env.production.test';

    // 设置存储适配器
    let roleStorage;
    if (isTestEnv) {
      // 测试环境：强制使用内存存储
      roleStorage = StorageFactory.createStorage<Role>({
        type: StorageType.MEMORY,
      }, 'roles');
      logger.info('测试环境：权限系统使用内存存储');
    } else {
      // 正常环境：使用提供的存储适配器或创建新的内存存储适配器
      roleStorage = storage || StorageFactory.createStorage<Role>({
        type: StorageType.MEMORY,
      }, 'roles');
    }

    roleService.setStorage(roleStorage);

    // 设置缓存适配器
    const permissionCache = cache || CacheFactory.createCache({
      type: CacheType.MEMORY,
      namespace: 'permission',
      ttl: 300, // 5分钟
    });

    roleService.setCache(permissionCache);

    // 添加资源
    // 资源不需要单独添加，因为它们只是用于组织和文档目的

    // 添加条件
    for (const condition of config.conditions) {
      permissionService.addCondition(condition);
    }

    // 添加规则
    for (const rule of config.rules) {
      permissionService.addRule(rule);
    }

    // 添加角色
    for (const role of config.roles) {
      try {
        await roleService.createRole(role);
      } catch (error) {
        logger.error({
          roleId: role.id,
          name: role.name,
          error,
        }, '创建角色失败');
      }
    }

    logger.info({
      ruleCount: config.rules.length,
      roleCount: config.roles.length,
      conditionCount: config.conditions.length,
    }, '权限系统已初始化');
  }

  /**
   * 创建默认的权限系统配置
   */
  static createDefaultConfig(): PermissionConfig {
    // 创建默认规则
    const rules: PermissionRule[] = [
      // 管理员规则
      {
        id: 'admin:all',
        resource: '*',
        operation: '*',
        description: '管理员可以执行所有操作',
      },

      // 标准用户规则
      {
        id: 'standard:read:all',
        resource: '*',
        operation: 'read',
        description: '标准用户可以读取所有资源',
      },
      {
        id: 'standard:music:all',
        resource: 'music',
        operation: '*',
        description: '标准用户可以对音乐资源执行所有操作',
      },

      // 只读用户规则
      {
        id: 'read:read:all',
        resource: '*',
        operation: 'read',
        description: '只读用户可以读取所有资源',
      },
    ];

    // 创建默认角色
    const roles: Role[] = [
      {
        id: 'admin',
        name: '管理员',
        description: '具有所有权限的管理员角色',
        permissions: ['admin:all'],
      },
      {
        id: 'standard',
        name: '标准用户',
        description: '具有标准权限的用户角色',
        permissions: ['standard:read:all', 'standard:music:all'],
      },
      {
        id: 'read',
        name: '只读用户',
        description: '只具有读取权限的用户角色',
        permissions: ['read:read:all'],
      },
    ];

    return {
      enabled: true,
      defaultRole: 'read',
      resources: [],
      rules,
      roles,
      conditions: [],
    };
  }
}

// 导出权限服务和角色服务
export { permissionService } from './permissionService.js';
export { roleService } from './roleService.js';
