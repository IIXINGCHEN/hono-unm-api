import { CacheAdapter, CacheConfig, CacheType } from '../../types/cache.js';
import { MemoryCacheAdapter } from './memoryCache.js';
import { RedisCacheAdapter } from './redisCache.js';
import { NoCacheAdapter } from './noCache.js';
import logger from '../../utils/logger.js';

/**
 * 缓存工厂
 * 根据配置创建适当的缓存适配器
 */
export class CacheFactory {
  private static instances: Map<string, CacheAdapter> = new Map();
  private static initialized = false;

  /**
   * 初始化缓存服务
   * @param config 缓存配置
   */
  static async initialize(config: {
    cacheType: string;
    cacheTtl: number;
    redisUrl?: string;
  }): Promise<void> {
    if (this.initialized) {
      logger.debug('缓存服务已经初始化，跳过');
      return;
    }

    try {
      // 初始化常用的缓存适配器
      const cacheType = config.cacheType as CacheType;

      // 预初始化一些常用的缓存适配器
      const namespaces = ['api-keys', 'security', 'permission'];
      for (const namespace of namespaces) {
        let cacheConfig: CacheConfig;

        switch (cacheType) {
          case CacheType.MEMORY:
            cacheConfig = {
              type: CacheType.MEMORY,
              namespace,
              ttl: config.cacheTtl,
            };
            break;
          case CacheType.REDIS:
            if (!config.redisUrl) {
              throw new Error('Redis缓存需要提供redisUrl');
            }

            // 解析Redis URL
            const url = new URL(config.redisUrl);
            cacheConfig = {
              type: CacheType.REDIS,
              namespace,
              ttl: config.cacheTtl,
              host: url.hostname,
              port: parseInt(url.port || '6379', 10),
              password: url.password,
              keyPrefix: `${namespace}:`,
            };
            break;
          case CacheType.NONE:
          default:
            cacheConfig = {
              type: CacheType.NONE,
              namespace,
            };
            break;
        }

        const cache = this.createCache(cacheConfig);

        // 初始化缓存
        await cache.initialize();
      }

      this.initialized = true;
      logger.info({
        cacheType: config.cacheType,
        cacheTtl: config.cacheTtl,
      }, '缓存服务初始化成功');
    } catch (error) {
      logger.error({ err: error }, '初始化缓存服务失败');
      throw new Error(`初始化缓存服务失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 创建缓存适配器
   * @param config 缓存配置
   */
  static createCache(config: CacheConfig): CacheAdapter {
    const namespace = config.namespace || 'default';
    const key = `${namespace}:${config.type}`;

    // 如果已经存在实例，则返回
    if (this.instances.has(key)) {
      return this.instances.get(key)!;
    }

    // 创建新实例
    let cache: CacheAdapter;

    switch (config.type) {
      case CacheType.MEMORY:
        cache = new MemoryCacheAdapter(config);
        break;
      case CacheType.REDIS:
        cache = new RedisCacheAdapter(config);
        break;
      case CacheType.NONE:
        cache = new NoCacheAdapter(config);
        break;
      default:
        // 使用字符串字面量来避免 never 类型错误
        throw new Error('不支持的缓存类型');
    }

    // 缓存实例
    this.instances.set(key, cache);

    logger.info({
      cacheType: config.type,
      namespace,
    }, '已创建缓存适配器');

    return cache;
  }

  /**
   * 获取缓存适配器
   * @param namespace 命名空间
   * @param type 缓存类型
   */
  static getCache(
    namespace: string = 'default',
    type: CacheType = CacheType.MEMORY
  ): CacheAdapter | undefined {
    const key = `${namespace}:${type}`;
    return this.instances.get(key);
  }

  /**
   * 获取或创建缓存适配器
   * @param namespace 命名空间
   * @param config 缓存配置
   */
  static getOrCreateCache(namespace: string, config: CacheConfig): CacheAdapter {
    const existingCache = this.getCache(namespace, config.type);
    if (existingCache) {
      return existingCache;
    }

    return this.createCache(config);
  }

  /**
   * 关闭所有缓存适配器
   */
  static async closeAll(): Promise<void> {
    try {
      logger.info(`正在关闭 ${this.instances.size} 个缓存适配器...`);

      for (const [key, cache] of this.instances.entries()) {
        try {
          await cache.close();
          logger.debug(`已关闭缓存适配器: ${key}`);
          this.instances.delete(key);
        } catch (error) {
          logger.error({ err: error, key }, `关闭缓存适配器 ${key} 失败`);
        }
      }

      this.initialized = false;
      logger.info('所有缓存适配器已关闭');
    } catch (error) {
      logger.error({ err: error }, '关闭缓存适配器时发生错误');
      throw new Error(`关闭缓存适配器失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出缓存类型和适配器
export { CacheType, CacheAdapter };
export { MemoryCacheAdapter } from './memoryCache.js';
export { RedisCacheAdapter } from './redisCache.js';
export { NoCacheAdapter } from './noCache.js';
