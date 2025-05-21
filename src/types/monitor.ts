/**
 * 监控系统类型定义
 */

/**
 * 安全事件类型
 */
export enum SecurityEventType {
  RATE_LIMIT = 'rate_limit',
  INVALID_INPUT = 'invalid_input',
  UNAUTHORIZED = 'unauthorized',
  SUSPICIOUS = 'suspicious',
  API_KEY_CREATED = 'api_key_created',
  API_KEY_REVOKED = 'api_key_revoked',
  API_KEY_EXPIRED = 'api_key_expired',
  API_KEY_REFRESHED = 'api_key_refreshed',
}

/**
 * 安全事件严重级别
 */
export enum SecurityEventSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 安全事件基础接口
 */
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  timestamp: string;
  ip: string;
  path: string;
  severity: SecurityEventSeverity;
  details: Record<string, any>;
}

/**
 * 安全事件创建请求
 */
export interface SecurityEventCreateRequest {
  type: SecurityEventType;
  ip: string;
  path: string;
  severity?: SecurityEventSeverity;
  details: Record<string, any>;
}

/**
 * 安全事件查询选项
 */
export interface SecurityEventQueryOptions {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  type?: SecurityEventType;
  severity?: SecurityEventSeverity;
  ip?: string;
}

/**
 * 安全事件统计
 */
export interface SecurityEventStats {
  total: number;
  byType: Record<SecurityEventType, number>;
  bySeverity: Record<SecurityEventSeverity, number>;
  byIp: Record<string, number>;
  byPath: Record<string, number>;
  byHour: Record<string, number>;
}

/**
 * 报警通道类型
 */
export enum AlertChannelType {
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  CONSOLE = 'console',
}

/**
 * 报警通道基础配置
 */
export interface BaseAlertChannelConfig {
  type: AlertChannelType;
  enabled: boolean;
  name: string;
  minSeverity: SecurityEventSeverity;
  eventTypes?: SecurityEventType[];
}

/**
 * Webhook报警通道配置
 */
export interface WebhookAlertChannelConfig extends BaseAlertChannelConfig {
  type: AlertChannelType.WEBHOOK;
  url: string;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  timeout?: number;
  retryCount?: number;
}

/**
 * 电子邮件报警通道配置
 */
export interface EmailAlertChannelConfig extends BaseAlertChannelConfig {
  type: AlertChannelType.EMAIL;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  to: string[];
  subject?: string;
}

/**
 * 控制台报警通道配置
 */
export interface ConsoleAlertChannelConfig extends BaseAlertChannelConfig {
  type: AlertChannelType.CONSOLE;
}

/**
 * 报警通道配置联合类型
 */
export type AlertChannelConfig = WebhookAlertChannelConfig | EmailAlertChannelConfig | ConsoleAlertChannelConfig;

/**
 * 报警配置
 */
export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannelConfig[];
}

/**
 * 报警结果
 */
export interface AlertResult {
  success: boolean;
  channelName: string;
  channelType: AlertChannelType;
  error?: Error;
}

/**
 * 报警通道接口
 */
export interface AlertChannel {
  /**
   * 获取通道名称
   */
  getName(): string;

  /**
   * 获取通道类型
   */
  getType(): AlertChannelType;

  /**
   * 是否启用
   */
  isEnabled(): boolean;

  /**
   * 是否应该发送报警
   * @param event 安全事件
   */
  shouldAlert(event: SecurityEvent): boolean;

  /**
   * 发送报警
   * @param event 安全事件
   */
  sendAlert(event: SecurityEvent): Promise<AlertResult>;
}
