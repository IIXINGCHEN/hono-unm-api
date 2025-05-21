import fs from 'fs';
import path from 'path';
import { BaseStorageAdapter } from './baseStorage.js';
import { FileStorageConfig, StorageQueryOptions, StorageResult, StorageType } from '../../types/storage.js';
import logger from '../../utils/logger.js';
import { encrypt, decrypt } from '../../utils/crypto.js';

/**
 * 文件系统存储适配器
 * 使用JSON文件存储数据
 */
export class FileStorageAdapter<T extends { id: string }> extends BaseStorageAdapter<T> {
  private readonly config: FileStorageConfig;
  private readonly filePath: string;
  private data: Map<string, T> = new Map();

  constructor(config: FileStorageConfig) {
    super(StorageType.FILE);
    this.config = config;
    this.filePath = path.resolve(config.path);
    
    // 确保目录存在
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 初始化存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 如果文件存在，则加载数据
      if (fs.existsSync(this.filePath)) {
        const encryptedData = fs.readFileSync(this.filePath, 'utf8');
        if (encryptedData) {
          const decryptedData = decrypt(encryptedData, this.config.encryptionKey);
          const items: T[] = JSON.parse(decryptedData);
          
          // 将数据加载到内存中
          this.data.clear();
          for (const item of items) {
            this.data.set(item.id, item);
          }
          
          logger.info(`已从文件加载 ${this.data.size} 条数据`);
        }
      } else {
        // 创建空文件
        this.saveData();
        logger.info('已创建新的存储文件');
      }
      
      this.initialized = true;
    } catch (error) {
      logger.error({ err: error }, '初始化文件存储失败');
      throw new Error('初始化文件存储失败');
    }
  }

  /**
   * 保存数据到文件
   */
  private saveData(): void {
    try {
      const items = Array.from(this.data.values());
      const jsonData = JSON.stringify(items, null, 2);
      const encryptedData = encrypt(jsonData, this.config.encryptionKey);
      fs.writeFileSync(this.filePath, encryptedData);
    } catch (error) {
      logger.error({ err: error }, '保存数据到文件失败');
      throw new Error('保存数据到文件失败');
    }
  }

  /**
   * 获取单个项目
   * @param id 项目ID
   */
  async get(id: string): Promise<StorageResult<T>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      const item = this.data.get(id);
      if (!item) {
        throw new Error(`未找到ID为 ${id} 的项目`);
      }
      return item;
    });
  }

  /**
   * 获取多个项目
   * @param options 查询选项
   */
  async getMany(options?: StorageQueryOptions): Promise<StorageResult<T[]>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      let items = Array.from(this.data.values());
      
      // 应用过滤器
      if (options?.filter) {
        items = items.filter(item => {
          for (const [key, value] of Object.entries(options.filter || {})) {
            if (item[key as keyof T] !== value) {
              return false;
            }
          }
          return true;
        });
      }
      
      // 应用排序
      if (options?.sort) {
        const { field, order } = options.sort;
        items.sort((a, b) => {
          const aValue = a[field as keyof T];
          const bValue = b[field as keyof T];
          
          if (aValue < bValue) return order === 'asc' ? -1 : 1;
          if (aValue > bValue) return order === 'asc' ? 1 : -1;
          return 0;
        });
      }
      
      // 应用分页
      if (options?.offset !== undefined || options?.limit !== undefined) {
        const offset = options.offset || 0;
        const limit = options.limit || items.length;
        items = items.slice(offset, offset + limit);
      }
      
      return items;
    });
  }

  /**
   * 创建项目
   * @param id 项目ID
   * @param data 项目数据
   */
  async create(id: string, data: T): Promise<StorageResult<T>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      if (this.data.has(id)) {
        throw new Error(`ID为 ${id} 的项目已存在`);
      }
      
      this.data.set(id, data);
      this.saveData();
      
      return data;
    });
  }

  /**
   * 更新项目
   * @param id 项目ID
   * @param data 项目数据
   */
  async update(id: string, data: Partial<T>): Promise<StorageResult<T>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      const existingItem = this.data.get(id);
      if (!existingItem) {
        throw new Error(`未找到ID为 ${id} 的项目`);
      }
      
      const updatedItem = { ...existingItem, ...data };
      this.data.set(id, updatedItem);
      this.saveData();
      
      return updatedItem;
    });
  }

  /**
   * 删除项目
   * @param id 项目ID
   */
  async delete(id: string): Promise<StorageResult<boolean>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      if (!this.data.has(id)) {
        throw new Error(`未找到ID为 ${id} 的项目`);
      }
      
      this.data.delete(id);
      this.saveData();
      
      return true;
    });
  }

  /**
   * 查询项目
   * @param query 查询条件
   */
  async query(query: Record<string, any>): Promise<StorageResult<T[]>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      const items = Array.from(this.data.values());
      
      return items.filter(item => {
        for (const [key, value] of Object.entries(query)) {
          if (item[key as keyof T] !== value) {
            return false;
          }
        }
        return true;
      });
    });
  }

  /**
   * 清空存储
   */
  async clear(): Promise<StorageResult<boolean>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      this.data.clear();
      this.saveData();
      
      return true;
    });
  }
}
