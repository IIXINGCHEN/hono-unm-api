import {
  AlertChannel,
  AlertChannelType,
  AlertResult,
  BaseAlertChannelConfig,
  SecurityEvent,
} from '../../types/monitor.js';
import logger from '../../utils/logger.js';

/**
 * 基础报警通道类
 * 提供通用的报警逻辑
 */
export abstract class BaseAlertChannel implements AlertChannel {
  protected readonly config: BaseAlertChannelConfig;

  constructor(config: BaseAlertChannelConfig) {
    this.config = config;
  }

  /**
   * 获取通道名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 获取通道类型
   */
  getType(): AlertChannelType {
    return this.config.type;
  }

  /**
   * 是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 是否应该发送报警
   * @param event 安全事件
   */
  shouldAlert(event: SecurityEvent): boolean {
    // 如果通道未启用，则不发送报警
    if (!this.config.enabled) {
      return false;
    }
    
    // 检查事件严重级别
    if (this.getSeverityLevel(event.severity) < this.getSeverityLevel(this.config.minSeverity)) {
      return false;
    }
    
    // 检查事件类型
    if (this.config.eventTypes && this.config.eventTypes.length > 0) {
      if (!this.config.eventTypes.includes(event.type)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 发送报警
   * @param event 安全事件
   */
  abstract sendAlert(event: SecurityEvent): Promise<AlertResult>;

  /**
   * 获取严重级别数值
   * @param severity 严重级别
   */
  protected getSeverityLevel(severity: string): number {
    switch (severity) {
      case 'info':
        return 0;
      case 'low':
        return 1;
      case 'medium':
        return 2;
      case 'high':
        return 3;
      case 'critical':
        return 4;
      default:
        return 0;
    }
  }

  /**
   * 创建成功结果
   */
  protected createSuccessResult(): AlertResult {
    return {
      success: true,
      channelName: this.config.name,
      channelType: this.config.type,
    };
  }

  /**
   * 创建错误结果
   * @param error 错误
   */
  protected createErrorResult(error: Error | string): AlertResult {
    const err = typeof error === 'string' ? new Error(error) : error;
    
    logger.error({
      channelName: this.config.name,
      channelType: this.config.type,
      error: err,
    }, `发送报警失败: ${err.message}`);
    
    return {
      success: false,
      channelName: this.config.name,
      channelType: this.config.type,
      error: err,
    };
  }

  /**
   * 格式化事件详情
   * @param event 安全事件
   */
  protected formatEventDetails(event: SecurityEvent): string {
    const details = [
      `ID: ${event.id}`,
      `类型: ${event.type}`,
      `时间: ${event.timestamp}`,
      `IP: ${event.ip}`,
      `路径: ${event.path}`,
      `严重级别: ${event.severity}`,
      '详情:',
    ];
    
    for (const [key, value] of Object.entries(event.details)) {
      details.push(`  ${key}: ${JSON.stringify(value)}`);
    }
    
    return details.join('\n');
  }
}
