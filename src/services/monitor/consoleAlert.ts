import { BaseAlertChannel } from './alertChannel.js';
import { AlertResult, ConsoleAlertChannelConfig, SecurityEvent } from '../../types/monitor.js';
import logger from '../../utils/logger.js';

/**
 * 控制台报警通道
 * 通过控制台输出报警信息
 */
export class ConsoleAlertChannel extends BaseAlertChannel {
  constructor(config: ConsoleAlertChannelConfig) {
    super(config);
  }

  /**
   * 发送报警
   * @param event 安全事件
   */
  async sendAlert(event: SecurityEvent): Promise<AlertResult> {
    if (!this.shouldAlert(event)) {
      return this.createSuccessResult();
    }
    
    try {
      const formattedEvent = this.formatEventDetails(event);
      
      // 根据严重级别选择不同的日志级别
      switch (event.severity) {
        case 'info':
          logger.info({ event }, `安全报警: ${event.type}\n${formattedEvent}`);
          break;
        case 'low':
          logger.info({ event }, `安全报警: ${event.type}\n${formattedEvent}`);
          break;
        case 'medium':
          logger.warn({ event }, `安全报警: ${event.type}\n${formattedEvent}`);
          break;
        case 'high':
          logger.error({ event }, `安全报警: ${event.type}\n${formattedEvent}`);
          break;
        case 'critical':
          logger.fatal({ event }, `安全报警: ${event.type}\n${formattedEvent}`);
          break;
        default:
          logger.info({ event }, `安全报警: ${event.type}\n${formattedEvent}`);
      }
      
      return this.createSuccessResult();
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
