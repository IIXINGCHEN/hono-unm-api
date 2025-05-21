import { CacheAdapter, CacheResult } from '../../types/cache.js';
import logger from '../../utils/logger.js';

/**
 * 基础缓存适配器类
 * 提供通用的错误处理和日志记录功能
 */
export abstract class BaseCacheAdapter implements CacheAdapter {
  protected initialized = false;
  protected readonly cacheType: string;
  protected readonly namespace: string;

  constructor(cacheType: string, namespace: string = 'default') {
    this.cacheType = cacheType;
    this.namespace = namespace;
  }

  /**
   * 初始化缓存
   */
  abstract initialize(): Promise<void>;

  /**
   * 获取缓存项
   * @param key 缓存键
   */
  abstract get<T>(key: string): Promise<CacheResult<T | null>>;

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（秒）
   */
  abstract set<T>(key: string, value: T, ttl?: number): Promise<CacheResult<boolean>>;

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  abstract delete(key: string): Promise<CacheResult<boolean>>;

  /**
   * 检查缓存项是否存在
   * @param key 缓存键
   */
  abstract has(key: string): Promise<CacheResult<boolean>>;

  /**
   * 清空缓存
   */
  abstract clear(): Promise<CacheResult<boolean>>;

  /**
   * 获取缓存统计信息
   */
  abstract stats(): Promise<CacheResult<Record<string, any>>>;

  /**
   * 关闭缓存连接
   */
  abstract close(): Promise<void>;

  /**
   * 创建成功结果
   * @param data 数据
   */
  protected createSuccessResult<T>(data: T): CacheResult<T> {
    return {
      success: true,
      data,
    };
  }

  /**
   * 创建错误结果
   * @param error 错误
   */
  protected createErrorResult<T>(error: Error | string): CacheResult<T> {
    const err = typeof error === 'string' ? new Error(error) : error;
    
    logger.error({
      cacheType: this.cacheType,
      namespace: this.namespace,
      error: err,
    }, `缓存操作失败: ${err.message}`);
    
    return {
      success: false,
      error: err,
    };
  }

  /**
   * 执行缓存操作并处理错误
   * @param operation 操作函数
   */
  protected async executeOperation<T>(
    operation: () => Promise<T>
  ): Promise<CacheResult<T>> {
    try {
      const result = await operation();
      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult<T>(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 生成带命名空间的缓存键
   * @param key 原始键
   */
  protected getNamespacedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}
