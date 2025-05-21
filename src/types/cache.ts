/**
 * 缓存适配器类型定义
 */

/**
 * 缓存类型
 */
export enum CacheType {
  MEMORY = 'memory',
  REDIS = 'redis',
  NONE = 'none',
}

/**
 * 缓存配置基础接口
 */
export interface BaseCacheConfig {
  type: CacheType;
  ttl?: number; // 缓存生存时间（秒）
  namespace?: string; // 缓存命名空间
}

/**
 * 内存缓存配置
 */
export interface MemoryCacheConfig extends BaseCacheConfig {
  type: CacheType.MEMORY;
  maxSize?: number; // 最大缓存项数
  checkPeriod?: number; // 检查过期项的周期（秒）
}

/**
 * Redis缓存配置
 */
export interface RedisCacheConfig extends BaseCacheConfig {
  type: CacheType.REDIS;
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

/**
 * 无缓存配置
 */
export interface NoCacheConfig extends BaseCacheConfig {
  type: CacheType.NONE;
}

/**
 * 缓存配置联合类型
 */
export type CacheConfig = MemoryCacheConfig | RedisCacheConfig | NoCacheConfig;

/**
 * 缓存操作结果
 */
export interface CacheResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * 缓存适配器接口
 */
export interface CacheAdapter {
  /**
   * 初始化缓存
   */
  initialize(): Promise<void>;

  /**
   * 获取缓存项
   * @param key 缓存键
   */
  get<T>(key: string): Promise<CacheResult<T | null>>;

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（秒），如果不指定则使用默认值
   */
  set<T>(key: string, value: T, ttl?: number): Promise<CacheResult<boolean>>;

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  delete(key: string): Promise<CacheResult<boolean>>;

  /**
   * 检查缓存项是否存在
   * @param key 缓存键
   */
  has(key: string): Promise<CacheResult<boolean>>;

  /**
   * 清空缓存
   */
  clear(): Promise<CacheResult<boolean>>;

  /**
   * 获取缓存统计信息
   */
  stats(): Promise<CacheResult<Record<string, any>>>;

  /**
   * 关闭缓存连接
   */
  close(): Promise<void>;
}
