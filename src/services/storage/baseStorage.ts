import { StorageAdapter, StorageResult, StorageQueryOptions } from '../../types/storage.js';
import logger from '../../utils/logger.js';

/**
 * 基础存储适配器类
 * 提供通用的错误处理和日志记录功能
 */
export abstract class BaseStorageAdapter<T> implements StorageAdapter<T> {
  protected initialized = false;
  protected readonly storageType: string;

  constructor(storageType: string) {
    this.storageType = storageType;
  }

  /**
   * 初始化存储
   */
  abstract initialize(): Promise<void>;

  /**
   * 获取单个项目
   * @param id 项目ID
   */
  abstract get(id: string): Promise<StorageResult<T>>;

  /**
   * 获取多个项目
   * @param options 查询选项
   */
  abstract getMany(options?: StorageQueryOptions): Promise<StorageResult<T[]>>;

  /**
   * 创建项目
   * @param id 项目ID
   * @param data 项目数据
   */
  abstract create(id: string, data: T): Promise<StorageResult<T>>;

  /**
   * 更新项目
   * @param id 项目ID
   * @param data 项目数据
   */
  abstract update(id: string, data: Partial<T>): Promise<StorageResult<T>>;

  /**
   * 删除项目
   * @param id 项目ID
   */
  abstract delete(id: string): Promise<StorageResult<boolean>>;

  /**
   * 查询项目
   * @param query 查询条件
   */
  abstract query(query: Record<string, any>): Promise<StorageResult<T[]>>;

  /**
   * 清空存储
   */
  abstract clear(): Promise<StorageResult<boolean>>;

  /**
   * 创建成功结果
   * @param data 数据
   */
  protected createSuccessResult<R>(data: R): StorageResult<R> {
    return {
      success: true,
      data,
    };
  }

  /**
   * 创建错误结果
   * @param error 错误
   */
  protected createErrorResult<R>(error: Error | string): StorageResult<R> {
    const err = typeof error === 'string' ? new Error(error) : error;
    
    logger.error({
      storageType: this.storageType,
      error: err,
    }, `存储操作失败: ${err.message}`);
    
    return {
      success: false,
      error: err,
    };
  }

  /**
   * 执行存储操作并处理错误
   * @param operation 操作函数
   */
  protected async executeOperation<R>(
    operation: () => Promise<R>
  ): Promise<StorageResult<R>> {
    try {
      const result = await operation();
      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult<R>(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
