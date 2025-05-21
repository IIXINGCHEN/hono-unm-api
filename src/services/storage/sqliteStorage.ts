import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { BaseStorageAdapter } from './baseStorage.js';
import { SQLiteStorageConfig, StorageQueryOptions, StorageResult, StorageType } from '../../types/storage.js';
import logger from '../../utils/logger.js';
import { encrypt, decrypt } from '../../utils/crypto.js';

/**
 * SQLite存储适配器
 * 使用SQLite数据库存储数据
 */
export class SQLiteStorageAdapter<T extends { id: string }> extends BaseStorageAdapter<T> {
  private readonly config: SQLiteStorageConfig;
  private readonly tableName: string;
  private db: Database.Database | null = null;

  constructor(config: SQLiteStorageConfig) {
    super(StorageType.SQLITE);
    this.config = config;
    this.tableName = config.tableName || 'api_keys';
    
    // 确保目录存在
    const dir = path.dirname(config.path);
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
      // 连接数据库
      this.db = new Database(this.config.path);
      
      // 启用外键约束
      this.db.pragma('foreign_keys = ON');
      
      // 创建表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      
      // 创建索引
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at ON ${this.tableName}(created_at)
      `);
      
      logger.info(`已连接到SQLite数据库: ${this.config.path}`);
      this.initialized = true;
    } catch (error) {
      logger.error({ err: error }, '初始化SQLite存储失败');
      throw new Error('初始化SQLite存储失败');
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * 加密数据
   * @param data 数据
   */
  private encryptData(data: T): string {
    const jsonData = JSON.stringify(data);
    return encrypt(jsonData, this.config.encryptionKey);
  }

  /**
   * 解密数据
   * @param encryptedData 加密数据
   */
  private decryptData(encryptedData: string): T {
    const jsonData = decrypt(encryptedData, this.config.encryptionKey);
    return JSON.parse(jsonData);
  }

  /**
   * 获取单个项目
   * @param id 项目ID
   */
  async get(id: string): Promise<StorageResult<T>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      const stmt = this.db!.prepare(`SELECT data FROM ${this.tableName} WHERE id = ?`);
      const row = stmt.get(id) as { data: string } | undefined;
      
      if (!row) {
        throw new Error(`未找到ID为 ${id} 的项目`);
      }
      
      return this.decryptData(row.data);
    });
  }

  /**
   * 获取多个项目
   * @param options 查询选项
   */
  async getMany(options?: StorageQueryOptions): Promise<StorageResult<T[]>> {
    await this.initialize();
    
    return this.executeOperation(async () => {
      let query = `SELECT data FROM ${this.tableName}`;
      const params: any[] = [];
      
      // 应用过滤器
      if (options?.filter && Object.keys(options.filter).length > 0) {
        // 注意：这种方法不支持复杂的过滤条件，因为数据是加密的
        // 我们需要获取所有数据并在内存中过滤
        const allRows = this.db!.prepare(`SELECT data FROM ${this.tableName}`).all() as { data: string }[];
        const items = allRows.map(row => this.decryptData(row.data));
        
        const filteredItems = items.filter(item => {
          for (const [key, value] of Object.entries(options.filter || {})) {
            if (item[key as keyof T] !== value) {
              return false;
            }
          }
          return true;
        });
        
        // 应用排序
        if (options?.sort) {
          const { field, order } = options.sort;
          filteredItems.sort((a, b) => {
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
          const limit = options.limit || filteredItems.length;
          return filteredItems.slice(offset, offset + limit);
        }
        
        return filteredItems;
      }
      
      // 应用排序
      if (options?.sort) {
        // 由于数据是加密的，我们只能按创建时间或更新时间排序
        if (options.sort.field === 'createdAt') {
          query += ` ORDER BY created_at ${options.sort.order === 'asc' ? 'ASC' : 'DESC'}`;
        } else if (options.sort.field === 'updatedAt') {
          query += ` ORDER BY updated_at ${options.sort.order === 'asc' ? 'ASC' : 'DESC'}`;
        }
      }
      
      // 应用分页
      if (options?.limit !== undefined) {
        query += ' LIMIT ?';
        params.push(options.limit);
        
        if (options?.offset !== undefined) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }
      
      const stmt = this.db!.prepare(query);
      const rows = stmt.all(...params) as { data: string }[];
      
      return rows.map(row => this.decryptData(row.data));
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
      const now = Date.now();
      const encryptedData = this.encryptData(data);
      
      const stmt = this.db!.prepare(`
        INSERT INTO ${this.tableName} (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      
      try {
        stmt.run(id, encryptedData, now, now);
      } catch (error) {
        if ((error as Error).message.includes('UNIQUE constraint failed')) {
          throw new Error(`ID为 ${id} 的项目已存在`);
        }
        throw error;
      }
      
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
      // 获取现有项目
      const getStmt = this.db!.prepare(`SELECT data FROM ${this.tableName} WHERE id = ?`);
      const row = getStmt.get(id) as { data: string } | undefined;
      
      if (!row) {
        throw new Error(`未找到ID为 ${id} 的项目`);
      }
      
      // 更新项目
      const existingItem = this.decryptData(row.data);
      const updatedItem = { ...existingItem, ...data };
      const encryptedData = this.encryptData(updatedItem);
      
      const updateStmt = this.db!.prepare(`
        UPDATE ${this.tableName}
        SET data = ?, updated_at = ?
        WHERE id = ?
      `);
      
      updateStmt.run(encryptedData, Date.now(), id);
      
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
      const stmt = this.db!.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
      const result = stmt.run(id);
      
      if (result.changes === 0) {
        throw new Error(`未找到ID为 ${id} 的项目`);
      }
      
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
      // 由于数据是加密的，我们需要获取所有数据并在内存中过滤
      const stmt = this.db!.prepare(`SELECT data FROM ${this.tableName}`);
      const rows = stmt.all() as { data: string }[];
      
      const items = rows.map(row => this.decryptData(row.data));
      
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
      const stmt = this.db!.prepare(`DELETE FROM ${this.tableName}`);
      stmt.run();
      
      return true;
    });
  }
}
