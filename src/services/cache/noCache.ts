import { BaseCacheAdapter } from './baseCache.js';
import { CacheResult, CacheType, NoCacheConfig } from '../../types/cache.js';
import logger from '../../utils/logger.js';

/**
 * 无缓存适配器
 * 不进行任何缓存操作，用于禁用缓存
 */
export class NoCacheAdapter extends BaseCacheAdapter {
  constructor(config: NoCacheConfig) {
    super(CacheType.NONE, config.namespace);
  }

  /**
   * 初始化缓存
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    logger.info({
      cacheType: this.cacheType,
      namespace: this.namespace,
    }, '无缓存模式已启用');
    
    this.initialized = true;
  }

  /**
   * 获取缓存项
   * @param key 缓存键
   */
  async get<T>(key: string): Promise<CacheResult<T | null>> {
    return this.createSuccessResult<T | null>(null);
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（秒）
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<CacheResult<boolean>> {
    return this.createSuccessResult(true);
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  async delete(key: string): Promise<CacheResult<boolean>> {
    return this.createSuccessResult(true);
  }

  /**
   * 检查缓存项是否存在
   * @param key 缓存键
   */
  async has(key: string): Promise<CacheResult<boolean>> {
    return this.createSuccessResult(false);
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<CacheResult<boolean>> {
    return this.createSuccessResult(true);
  }

  /**
   * 获取缓存统计信息
   */
  async stats(): Promise<CacheResult<Record<string, any>>> {
    return this.createSuccessResult({
      type: this.cacheType,
      namespace: this.namespace,
      enabled: false,
      keys: 0,
    });
  }

  /**
   * 关闭缓存连接
   */
  async close(): Promise<void> {
    this.initialized = false;
  }
}
