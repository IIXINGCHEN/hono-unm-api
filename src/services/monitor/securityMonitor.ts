import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import {
  AlertChannel,
  AlertChannelType,
  AlertConfig,
  AlertResult,
  SecurityEvent,
  SecurityEventCreateRequest,
  SecurityEventQueryOptions,
  SecurityEventSeverity,
  SecurityEventStats,
  SecurityEventType,
} from '../../types/monitor.js';
import { StorageAdapter, StorageFactory, StorageType } from '../storage/index.js';
import { CacheAdapter, CacheFactory, CacheType } from '../cache/index.js';
import { ConsoleAlertChannel } from './consoleAlert.js';
import { WebhookAlertChannel } from './webhookAlert.js';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 增强的安全监控系统
 * 提供安全事件记录、查询和报警功能
 */
export class SecurityMonitorService {
  private readonly logPath: string;
  private readonly maxEventsInMemory: number;
  private events: SecurityEvent[] = [];
  private alertChannels: AlertChannel[] = [];
  private storage: StorageAdapter<SecurityEvent> | null = null;
  private cache: CacheAdapter | null = null;
  private alertConfig: AlertConfig = {
    enabled: false,
    channels: [],
  };
  private initialized = false;

  constructor(
    maxEventsInMemory = 1000,
    logPath = path.resolve(__dirname, '../../../logs/security')
  ) {
    this.maxEventsInMemory = maxEventsInMemory;
    this.logPath = logPath;

    // 确保日志目录存在
    try {
      if (!fs.existsSync(this.logPath)) {
        fs.mkdirSync(this.logPath, { recursive: true });
      }
    } catch (error) {
      logger.error({ err: error }, '创建安全日志目录失败');
    }
  }

  /**
   * 初始化安全监控系统
   * @param config 配置
   */
  async initialize(config: {
    monitorEnabled: boolean;
    alertEnabled: boolean;
    alertWebhookUrl?: string;
    storageType: string;
    storagePath: string;
    encryptionKey?: string;
    cacheType: string;
    cacheTtl: number;
  }): Promise<void> {
    if (this.initialized) {
      logger.debug('安全监控系统已经初始化，跳过');
      return;
    }

    if (!config.monitorEnabled) {
      logger.info('安全监控系统未启用');
      return;
    }

    try {
      // 确保日志目录存在
      if (!fs.existsSync(this.logPath)) {
        fs.mkdirSync(this.logPath, { recursive: true });
        logger.info(`已创建安全日志目录: ${this.logPath}`);
      }

      // 设置存储适配器
      const storageType = config.storageType as StorageType;
      const storagePath = path.join(config.storagePath, 'security', 'events.json');

      const storage = StorageFactory.createStorage<SecurityEvent>({
        type: storageType,
        path: storagePath,
        encryptionKey: config.encryptionKey,
      }, 'security');

      this.setStorage(storage);

      // 设置缓存适配器
      try {
        // 获取缓存实例
        const cache = CacheFactory.getCache('security');

        if (cache) {
          this.setCache(cache);
        } else {
          logger.warn('未找到安全监控缓存实例，将不使用缓存');
        }
      } catch (error) {
        logger.error({ err: error }, '获取安全监控缓存实例失败');
      }

      // 配置报警
      if (config.alertEnabled) {
        // 设置报警配置
        this.setAlertConfig({
          enabled: true,
          channels: [],
        });

        // 添加控制台报警通道
        const consoleChannel = new ConsoleAlertChannel({
          type: AlertChannelType.CONSOLE,
          enabled: true,
          name: 'Console',
          minSeverity: SecurityEventSeverity.LOW,
        });

        this.addAlertChannel(consoleChannel);

        // 添加Webhook报警通道（如果配置了URL）
        if (config.alertWebhookUrl) {
          const webhookChannel = new WebhookAlertChannel({
            type: AlertChannelType.WEBHOOK,
            enabled: true,
            name: 'Webhook',
            url: config.alertWebhookUrl,
            minSeverity: SecurityEventSeverity.MEDIUM,
          });

          this.addAlertChannel(webhookChannel);
        }

        logger.info('安全监控报警已启用');
      }

      this.initialized = true;
      logger.info('安全监控系统已初始化');
    } catch (error) {
      logger.error({ err: error }, '初始化安全监控系统失败');
      throw new Error(`初始化安全监控系统失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 设置存储适配器
   * @param storage 存储适配器
   */
  setStorage(storage: StorageAdapter<SecurityEvent>): void {
    this.storage = storage;
    logger.info('安全监控系统已设置存储适配器');
  }

  /**
   * 设置缓存适配器
   * @param cache 缓存适配器
   */
  setCache(cache: CacheAdapter): void {
    this.cache = cache;
    logger.info('安全监控系统已设置缓存适配器');
  }

  /**
   * 设置报警配置
   * @param config 报警配置
   */
  setAlertConfig(config: AlertConfig): void {
    this.alertConfig = config;
    logger.info({
      enabled: config.enabled,
      channelCount: config.channels.length,
    }, '安全监控系统已设置报警配置');
  }

  /**
   * 添加报警通道
   * @param channel 报警通道
   */
  addAlertChannel(channel: AlertChannel): void {
    this.alertChannels.push(channel);
    logger.info({
      channelName: channel.getName(),
      channelType: channel.getType(),
    }, '安全监控系统已添加报警通道');
  }

  /**
   * 记录安全事件
   * @param request 安全事件创建请求
   */
  async logEvent(request: SecurityEventCreateRequest): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      severity: request.severity || SecurityEventSeverity.LOW,
      ...request,
    };

    // 添加到内存缓存
    this.events.push(event);
    if (this.events.length > this.maxEventsInMemory) {
      this.events.shift();
    }

    // 记录到日志
    logger.warn({ securityEvent: event }, '安全事件');

    // 对于严重事件，写入专门的安全日志文件
    if (
      event.severity === SecurityEventSeverity.HIGH ||
      event.severity === SecurityEventSeverity.CRITICAL
    ) {
      try {
        const logFile = path.join(
          this.logPath,
          `security-${new Date().toISOString().split('T')[0]}.log`
        );

        fs.appendFileSync(
          logFile,
          JSON.stringify(event) + '\n'
        );
      } catch (error) {
        logger.error({ err: error }, '写入安全日志文件失败');
      }
    }

    // 存储到数据库
    if (this.storage) {
      try {
        await this.storage.create(event.id, event);
      } catch (error) {
        logger.error({ err: error }, '存储安全事件失败');
      }
    }

    // 发送报警
    if (this.alertConfig.enabled) {
      this.sendAlerts(event).catch(error => {
        logger.error({ err: error }, '发送安全事件报警失败');
      });
    }

    return event;
  }

  /**
   * 发送报警
   * @param event 安全事件
   */
  private async sendAlerts(event: SecurityEvent): Promise<AlertResult[]> {
    const results: AlertResult[] = [];

    for (const channel of this.alertChannels) {
      if (channel.shouldAlert(event)) {
        try {
          const result = await channel.sendAlert(event);
          results.push(result);
        } catch (error) {
          logger.error({
            channelName: channel.getName(),
            channelType: channel.getType(),
            error,
          }, '发送报警失败');

          results.push({
            success: false,
            channelName: channel.getName(),
            channelType: channel.getType(),
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    }

    return results;
  }

  /**
   * 获取最近的安全事件
   * @param options 查询选项
   */
  async getEvents(options: SecurityEventQueryOptions = {}): Promise<SecurityEvent[]> {
    const { limit = 100, offset = 0, type, severity, ip, startDate, endDate } = options;

    // 如果有存储适配器，则从存储中获取
    if (this.storage) {
      try {
        // 构建查询条件
        const filter: Record<string, any> = {};
        if (type) filter.type = type;
        if (severity) filter.severity = severity;
        if (ip) filter.ip = ip;

        // 获取事件
        const result = await this.storage.getMany({
          limit,
          offset,
          filter,
          sort: {
            field: 'timestamp',
            order: 'desc',
          },
        });

        if (result.success && result.data) {
          // 过滤日期范围
          return result.data.filter(event => {
            const eventDate = new Date(event.timestamp);

            if (startDate && eventDate < new Date(startDate)) {
              return false;
            }

            if (endDate && eventDate > new Date(endDate)) {
              return false;
            }

            return true;
          });
        }
      } catch (error) {
        logger.error({ err: error }, '从存储中获取安全事件失败');
      }
    }

    // 如果没有存储适配器或获取失败，则从内存中获取
    let filteredEvents = this.events;

    // 应用过滤器
    if (type) {
      filteredEvents = filteredEvents.filter(event => event.type === type);
    }

    if (severity) {
      filteredEvents = filteredEvents.filter(event => event.severity === severity);
    }

    if (ip) {
      filteredEvents = filteredEvents.filter(event => event.ip === ip);
    }

    if (startDate) {
      const start = new Date(startDate);
      filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) <= end);
    }

    // 排序和分页
    return filteredEvents
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);
  }

  /**
   * 获取安全事件统计
   */
  async getStats(): Promise<SecurityEventStats> {
    // 尝试从缓存中获取
    if (this.cache) {
      try {
        const cacheResult = await this.cache.get<SecurityEventStats>('security:stats');
        if (cacheResult.success && cacheResult.data) {
          return cacheResult.data;
        }
      } catch (error) {
        logger.error({ err: error }, '从缓存中获取安全事件统计失败');
      }
    }

    // 获取所有事件
    let events: SecurityEvent[] = [];

    if (this.storage) {
      try {
        const result = await this.storage.getMany();
        if (result.success && result.data) {
          events = result.data;
        }
      } catch (error) {
        logger.error({ err: error }, '从存储中获取安全事件失败');
        events = this.events;
      }
    } else {
      events = this.events;
    }

    // 计算统计信息
    const stats: SecurityEventStats = {
      total: events.length,
      byType: {} as Record<SecurityEventType, number>,
      bySeverity: {} as Record<SecurityEventSeverity, number>,
      byIp: {},
      byPath: {},
      byHour: {},
    };

    // 初始化类型统计
    Object.values(SecurityEventType).forEach(type => {
      stats.byType[type] = 0;
    });

    // 初始化严重级别统计
    Object.values(SecurityEventSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0;
    });

    // 统计事件
    for (const event of events) {
      // 按类型统计
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

      // 按严重级别统计
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;

      // 按IP统计
      stats.byIp[event.ip] = (stats.byIp[event.ip] || 0) + 1;

      // 按路径统计
      stats.byPath[event.path] = (stats.byPath[event.path] || 0) + 1;

      // 按小时统计
      const hour = new Date(event.timestamp).toISOString().slice(0, 13);
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    }

    // 缓存统计结果
    if (this.cache) {
      try {
        await this.cache.set('security:stats', stats, 300); // 缓存5分钟
      } catch (error) {
        logger.error({ err: error }, '缓存安全事件统计失败');
      }
    }

    return stats;
  }

  /**
   * 检测异常访问模式
   * @param ip IP地址
   * @param path 请求路径
   * @param timeWindowMs 时间窗口（毫秒）
   * @param threshold 阈值
   */
  async detectAnomalies(
    ip: string,
    path: string,
    timeWindowMs = 60000,
    threshold = 10
  ): Promise<boolean> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowMs);

    // 获取时间窗口内的事件
    const events = await this.getEvents({
      ip,
      startDate: windowStart.toISOString(),
      endDate: now.toISOString(),
    });

    // 计算路径的访问次数
    const pathCount = events.filter(event => event.path === path).length;

    // 如果超过阈值，则认为是异常
    return pathCount > threshold;
  }
}

// 导出单例实例
export const securityMonitor = new SecurityMonitorService();
