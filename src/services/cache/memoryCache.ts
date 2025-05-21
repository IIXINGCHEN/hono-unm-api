import NodeCache from 'node-cache';
import { BaseCacheAdapter } from './baseCache.js';
import { CacheResult, CacheType, MemoryCacheConfig } from '../../types/cache.js';
import logger from '../../utils/logger.js';

/**
 * 内存缓存适配器
 * 使用node-cache实现内存缓存
 */
export class MemoryCacheAdapter extends BaseCacheAdapter {
  private readonly config: MemoryCacheConfig;
  private cache: NodeCache | null = null;

  constructor(config: MemoryCacheConfig) {
    super(CacheType.MEMORY, config.namespace);
    this.config = config;
  }

  /**
   * 初始化缓存
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.cache = new NodeCache({
        stdTTL: this.config.ttl || 300, // 默认5分钟
        checkperiod: this.config.checkPeriod || 60, // 默认1分钟检查一次
        maxKeys: this.config.maxSize || -1, // 默认无限制
        useClones: false, // 不使用克隆，提高性能
      });

      // 监听删除事件
      this.cache.on('del', (key, value) => {
        logger.debug({
          cacheType: this.cacheType,
          namespace: this.namespace,
          key,
        }, '缓存项已过期或被删除');
      });

      this.initialized = true;
      logger.info({
        cacheType: this.cacheType,
        namespace: this.namespace,
        ttl: this.config.ttl || 300,
        maxSize: this.config.maxSize || 'unlimited',
      }, '内存缓存已初始化');
    } catch (error) {
      logger.error({ err: error }, '初始化内存缓存失败');
      throw new Error('初始化内存缓存失败');
    }
  }

  /**
   * 获取缓存项
   * @param key 缓存键
   */
  async get<T>(key: string): Promise<CacheResult<T | null>> {
    await this.initialize();

    return this.executeOperation(async () => {
      const namespacedKey = this.getNamespacedKey(key);
      const value = this.cache!.get<T>(namespacedKey);

      if (value === undefined) {
        return null;
      }

      return value;
    });
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（秒）
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<CacheResult<boolean>> {
    await this.initialize();

    return this.executeOperation(async () => {
      const namespacedKey = this.getNamespacedKey(key);
      // 确保 ttl 是数字类型
      const cacheTtl = ttl !== undefined ? ttl : (this.config.ttl || 300);
      const success = this.cache!.set(
        namespacedKey,
        value,
        cacheTtl
      );

      return success;
    });
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  async delete(key: string): Promise<CacheResult<boolean>> {
    await this.initialize();

    return this.executeOperation(async () => {
      const namespacedKey = this.getNamespacedKey(key);
      const deleted = this.cache!.del(namespacedKey);

      return deleted > 0;
    });
  }

  /**
   * 检查缓存项是否存在
   * @param key 缓存键
   */
  async has(key: string): Promise<CacheResult<boolean>> {
    await this.initialize();

    return this.executeOperation(async () => {
      const namespacedKey = this.getNamespacedKey(key);
      return this.cache!.has(namespacedKey);
    });
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<CacheResult<boolean>> {
    await this.initialize();

    return this.executeOperation(async () => {
      // 只清除当前命名空间的缓存项
      const keys = this.cache!.keys().filter(key => key.startsWith(`${this.namespace}:`));
      this.cache!.del(keys);

      return true;
    });
  }

  /**
   * 获取缓存统计信息
   */
  async stats(): Promise<CacheResult<Record<string, any>>> {
    await this.initialize();

    return this.executeOperation(async () => {
      const stats = this.cache!.getStats();
      const keys = this.cache!.keys().filter(key => key.startsWith(`${this.namespace}:`));

      return {
        ...stats,
        namespaceKeys: keys.length,
        keys,
      };
    });
  }

  /**
   * 关闭缓存连接
   */
  async close(): Promise<void> {
    if (this.cache) {
      this.cache.close();
      this.cache = null;
      this.initialized = false;

      logger.info({
        cacheType: this.cacheType,
        namespace: this.namespace,
      }, '内存缓存已关闭');
    }
  }
}
