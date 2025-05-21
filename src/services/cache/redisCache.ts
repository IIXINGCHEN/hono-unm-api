import Redis from 'ioredis';
import { BaseCacheAdapter } from './baseCache.js';
import { CacheResult, CacheType, RedisCacheConfig } from '../../types/cache.js';
import logger from '../../utils/logger.js';

/**
 * Redis缓存适配器
 * 使用ioredis实现Redis缓存
 */
export class RedisCacheAdapter extends BaseCacheAdapter {
  private readonly config: RedisCacheConfig;
  private client: Redis | null = null;

  constructor(config: RedisCacheConfig) {
    super(CacheType.REDIS, config.namespace);
    this.config = config;
  }

  /**
   * 初始化缓存
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 创建Redis客户端
      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db || 0,
        keyPrefix: this.config.keyPrefix || '',
        retryStrategy: (times) => {
          const delay = Math.min(times * 100, 3000);
          return delay;
        },
      });
      
      // 监听错误事件
      this.client.on('error', (error) => {
        logger.error({
          cacheType: this.cacheType,
          namespace: this.namespace,
          error,
        }, 'Redis连接错误');
      });
      
      // 监听重连事件
      this.client.on('reconnecting', () => {
        logger.warn({
          cacheType: this.cacheType,
          namespace: this.namespace,
        }, '正在重新连接Redis');
      });
      
      // 等待连接就绪
      await this.client.ping();
      
      this.initialized = true;
      logger.info({
        cacheType: this.cacheType,
        namespace: this.namespace,
        host: this.config.host,
        port: this.config.port,
        db: this.config.db || 0,
      }, 'Redis缓存已初始化');
    } catch (error) {
      logger.error({ err: error }, '初始化Redis缓存失败');
      throw new Error('初始化Redis缓存失败');
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
      const value = await this.client!.get(namespacedKey);
      
      if (value === null) {
        return null;
      }
      
      try {
        return JSON.parse(value) as T;
      } catch (error) {
        // 如果不是JSON，则返回原始值
        return value as unknown as T;
      }
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
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl || this.config.ttl) {
        await this.client!.set(
          namespacedKey,
          serializedValue,
          'EX',
          ttl || this.config.ttl || 300
        );
      } else {
        await this.client!.set(namespacedKey, serializedValue);
      }
      
      return true;
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
      const deleted = await this.client!.del(namespacedKey);
      
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
      const exists = await this.client!.exists(namespacedKey);
      
      return exists > 0;
    });
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<CacheResult<boolean>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      // 只清除当前命名空间的缓存项
      const pattern = `${this.namespace}:*`;
      const keys = await this.client!.keys(pattern);
      
      if (keys.length > 0) {
        await this.client!.del(...keys);
      }
      
      return true;
    });
  }

  /**
   * 获取缓存统计信息
   */
  async stats(): Promise<CacheResult<Record<string, any>>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      // 获取当前命名空间的键数量
      const pattern = `${this.namespace}:*`;
      const keys = await this.client!.keys(pattern);
      
      // 获取Redis信息
      const info = await this.client!.info();
      
      return {
        namespaceKeys: keys.length,
        keys,
        info,
      };
    });
  }

  /**
   * 关闭缓存连接
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.initialized = false;
      
      logger.info({
        cacheType: this.cacheType,
        namespace: this.namespace,
      }, 'Redis缓存已关闭');
    }
  }
}
