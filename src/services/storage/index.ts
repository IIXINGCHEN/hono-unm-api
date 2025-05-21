import { StorageAdapter, StorageConfig, StorageType } from '../../types/storage.js';
import { FileStorageAdapter } from './fileStorage.js';
import { SQLiteStorageAdapter } from './sqliteStorage.js';
import logger from '../../utils/logger.js';
import path from 'path';
import fs from 'fs';

/**
 * 存储工厂
 * 根据配置创建适当的存储适配器
 */
export class StorageFactory {
  private static instances: Map<string, StorageAdapter<any>> = new Map();
  private static initialized = false;

  /**
   * 初始化存储服务
   * @param config 存储配置
   */
  static async initialize(config: {
    storageType: string;
    storagePath: string;
    encryptionKey?: string;
  }): Promise<void> {
    if (this.initialized) {
      logger.debug('存储服务已经初始化，跳过');
      return;
    }

    try {
      // 确保存储目录存在
      if (config.storagePath && config.storagePath !== ':memory:') {
        const storagePath = path.resolve(config.storagePath);
        if (!fs.existsSync(storagePath)) {
          fs.mkdirSync(storagePath, { recursive: true });
          logger.info(`已创建存储目录: ${storagePath}`);
        }

        // 创建子目录
        const subDirs = ['api-keys', 'security', 'permissions'];
        for (const dir of subDirs) {
          const dirPath = path.join(storagePath, dir);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            logger.debug(`已创建存储子目录: ${dirPath}`);
          }
        }
      }

      // 初始化常用的存储适配器
      const storageType = config.storageType as StorageType;

      // 预初始化一些常用的存储适配器
      const namespaces = ['api-keys', 'security', 'roles'];
      for (const namespace of namespaces) {
        try {
          const storage = this.createStorage({
            type: storageType,
            path: config.storagePath ? path.join(config.storagePath, namespace, `${namespace}.json`) : ':memory:',
            encryptionKey: config.encryptionKey,
          }, namespace);

          // 初始化存储
          await storage.initialize();
        } catch (error) {
          // 如果初始化失败，记录错误但不中断整个初始化过程
          logger.error({ err: error, namespace }, `初始化 ${namespace} 存储失败，但继续初始化其他存储`);
        }
      }

      this.initialized = true;
      logger.info({
        storageType: config.storageType,
        storagePath: config.storagePath,
      }, '存储服务初始化成功');
    } catch (error) {
      logger.error({ err: error }, '初始化存储服务失败');
      throw new Error(`初始化存储服务失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 创建存储适配器
   * @param config 存储配置
   * @param namespace 命名空间，用于区分不同的存储实例
   */
  static createStorage<T extends { id: string }>(
    config: StorageConfig,
    namespace: string = 'default'
  ): StorageAdapter<T> {
    const key = `${namespace}:${config.type}`;

    // 如果已经存在实例，则返回
    if (this.instances.has(key)) {
      return this.instances.get(key) as StorageAdapter<T>;
    }

    // 创建新实例
    let storage: StorageAdapter<T>;

    // 检查是否在测试环境中
    const isTestEnv = process.env.ENV_FILE === '.env.production.test';

    // 如果在测试环境中，无论配置如何，都使用内存存储
    if (isTestEnv) {
      // 内存存储直接使用文件存储适配器，但不保存到文件
      storage = new FileStorageAdapter<T>({
        type: StorageType.FILE,
        path: ':memory:',
        encryptionKey: config.encryptionKey,
      });
      logger.info('测试环境：使用内存存储');
    } else {
      // 正常环境，根据配置创建存储适配器
      switch (config.type) {
        case StorageType.FILE:
          storage = new FileStorageAdapter<T>(config);
          break;
        case StorageType.SQLITE:
          storage = new SQLiteStorageAdapter<T>(config);
          break;
        case StorageType.MEMORY:
          // 内存存储直接使用文件存储适配器，但不保存到文件
          storage = new FileStorageAdapter<T>({
            type: StorageType.FILE,
            path: ':memory:',
            encryptionKey: config.encryptionKey,
          });
          break;
        default:
          // 使用字符串字面量来避免 never 类型错误
          throw new Error('不支持的存储类型');
      }
    }

    // 缓存实例
    this.instances.set(key, storage);

    logger.info({
      storageType: config.type,
      namespace,
    }, '已创建存储适配器');

    return storage;
  }

  /**
   * 获取存储适配器
   * @param namespace 命名空间
   * @param type 存储类型
   */
  static getStorage<T extends { id: string }>(
    namespace: string = 'default',
    type: StorageType = StorageType.FILE
  ): StorageAdapter<T> | undefined {
    const key = `${namespace}:${type}`;
    return this.instances.get(key) as StorageAdapter<T> | undefined;
  }

  /**
   * 获取或创建存储适配器
   * @param namespace 命名空间
   * @param config 存储配置
   */
  static getOrCreateStorage<T extends { id: string }>(
    namespace: string,
    config: StorageConfig
  ): StorageAdapter<T> {
    const existingStorage = this.getStorage<T>(namespace, config.type);
    if (existingStorage) {
      return existingStorage;
    }

    return this.createStorage<T>(config, namespace);
  }

  /**
   * 关闭所有存储适配器
   */
  static async closeAll(): Promise<void> {
    try {
      logger.info(`正在关闭 ${this.instances.size} 个存储适配器...`);

      for (const [key, storage] of this.instances.entries()) {
        try {
          if (storage instanceof SQLiteStorageAdapter) {
            storage.close();
            logger.debug(`已关闭 SQLite 存储适配器: ${key}`);
          }
          this.instances.delete(key);
        } catch (error) {
          logger.error({ err: error, key }, `关闭存储适配器 ${key} 失败`);
        }
      }

      this.initialized = false;
      logger.info('所有存储适配器已关闭');
    } catch (error) {
      logger.error({ err: error }, '关闭存储适配器时发生错误');
      throw new Error(`关闭存储适配器失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出存储类型和适配器
export { StorageType, StorageAdapter };
export { FileStorageAdapter } from './fileStorage.js';
export { SQLiteStorageAdapter } from './sqliteStorage.js';
