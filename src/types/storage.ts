/**
 * 存储适配器类型定义
 */

/**
 * 存储类型
 */
export enum StorageType {
  FILE = 'file',
  SQLITE = 'sqlite',
  MEMORY = 'memory',
}

/**
 * 存储配置基础接口
 */
export interface BaseStorageConfig {
  type: StorageType;
  encryptionKey?: string; // 用于加密存储的数据
}

/**
 * 文件存储配置
 */
export interface FileStorageConfig extends BaseStorageConfig {
  type: StorageType.FILE;
  path: string; // 文件存储路径
}

/**
 * SQLite存储配置
 */
export interface SQLiteStorageConfig extends BaseStorageConfig {
  type: StorageType.SQLITE;
  path: string; // 数据库文件路径
  tableName?: string; // 表名，默认为 'api_keys'
}

/**
 * 内存存储配置
 */
export interface MemoryStorageConfig extends BaseStorageConfig {
  type: StorageType.MEMORY;
}

/**
 * 存储配置联合类型
 */
export type StorageConfig = FileStorageConfig | SQLiteStorageConfig | MemoryStorageConfig;

/**
 * 存储操作结果
 */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * 存储查询选项
 */
export interface StorageQueryOptions {
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  filter?: Record<string, any>;
}

/**
 * 存储适配器接口
 */
export interface StorageAdapter<T> {
  /**
   * 初始化存储
   */
  initialize(): Promise<void>;

  /**
   * 获取单个项目
   * @param id 项目ID
   */
  get(id: string): Promise<StorageResult<T>>;

  /**
   * 获取多个项目
   * @param options 查询选项
   */
  getMany(options?: StorageQueryOptions): Promise<StorageResult<T[]>>;

  /**
   * 创建项目
   * @param id 项目ID
   * @param data 项目数据
   */
  create(id: string, data: T): Promise<StorageResult<T>>;

  /**
   * 更新项目
   * @param id 项目ID
   * @param data 项目数据
   */
  update(id: string, data: Partial<T>): Promise<StorageResult<T>>;

  /**
   * 删除项目
   * @param id 项目ID
   */
  delete(id: string): Promise<StorageResult<boolean>>;

  /**
   * 查询项目
   * @param query 查询条件
   */
  query(query: Record<string, any>): Promise<StorageResult<T[]>>;

  /**
   * 清空存储
   */
  clear(): Promise<StorageResult<boolean>>;
}
