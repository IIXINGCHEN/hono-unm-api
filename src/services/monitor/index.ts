import {
  AlertChannel,
  AlertChannelConfig,
  AlertChannelType,
  AlertConfig,
  SecurityEventSeverity,
  ConsoleAlertChannelConfig,
  WebhookAlertChannelConfig
} from '../../types/monitor.js';
import { WebhookAlertChannel } from './webhookAlert.js';
import { EmailAlertChannel } from './emailAlert.js';
import { ConsoleAlertChannel } from './consoleAlert.js';
import { securityMonitor } from './securityMonitor.js';
import logger from '../../utils/logger.js';

/**
 * 报警通道工厂
 * 根据配置创建适当的报警通道
 */
export class AlertChannelFactory {
  private static initialized = false;

  /**
   * 初始化报警通道工厂
   * @param config 配置
   */
  static async initialize(config: {
    alertEnabled: boolean;
    alertWebhookUrl?: string;
  }): Promise<void> {
    if (this.initialized) {
      logger.debug('报警通道工厂已经初始化，跳过');
      return;
    }

    if (!config.alertEnabled) {
      logger.info('报警系统未启用');
      return;
    }

    try {
      // 创建报警配置
      const alertConfig: AlertConfig = {
        enabled: true,
        channels: [],
      };

      // 添加控制台报警通道
      const consoleChannelConfig: ConsoleAlertChannelConfig = {
        type: AlertChannelType.CONSOLE,
        enabled: true,
        name: 'Console',
        minSeverity: SecurityEventSeverity.LOW,
      };

      alertConfig.channels.push(consoleChannelConfig);

      // 添加Webhook报警通道（如果配置了URL）
      if (config.alertWebhookUrl) {
        const webhookChannelConfig: WebhookAlertChannelConfig = {
          type: AlertChannelType.WEBHOOK,
          enabled: true,
          name: 'Webhook',
          url: config.alertWebhookUrl,
          minSeverity: SecurityEventSeverity.MEDIUM,
        };

        alertConfig.channels.push(webhookChannelConfig);
      }

      // 配置安全监控系统
      this.configureSecurityMonitor(alertConfig);

      this.initialized = true;
      logger.info('报警通道工厂初始化成功');
    } catch (error) {
      logger.error({ err: error }, '初始化报警通道工厂失败');
      throw new Error(`初始化报警通道工厂失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 创建报警通道
   * @param config 报警通道配置
   */
  static createAlertChannel(config: AlertChannelConfig): AlertChannel {
    switch (config.type) {
      case AlertChannelType.WEBHOOK:
        return new WebhookAlertChannel(config as WebhookAlertChannelConfig);
      case AlertChannelType.EMAIL:
        return new EmailAlertChannel(config as any);
      case AlertChannelType.CONSOLE:
        return new ConsoleAlertChannel(config as ConsoleAlertChannelConfig);
      default:
        const type = (config as any).type;
        throw new Error(`不支持的报警通道类型: ${type}`);
    }
  }

  /**
   * 配置安全监控系统的报警通道
   * @param config 报警配置
   */
  static configureSecurityMonitor(config: AlertConfig): void {
    // 设置报警配置
    securityMonitor.setAlertConfig(config);

    // 创建并添加报警通道
    for (const channelConfig of config.channels) {
      if (channelConfig.enabled) {
        try {
          const channel = this.createAlertChannel(channelConfig);
          securityMonitor.addAlertChannel(channel);

          logger.info({
            channelName: channelConfig.name,
            channelType: channelConfig.type,
          }, '已添加报警通道');
        } catch (error) {
          logger.error({
            channelName: channelConfig.name,
            channelType: channelConfig.type,
            error,
          }, '创建报警通道失败');
        }
      }
    }
  }
}

// 导出安全监控系统和报警通道类型
export { securityMonitor } from './securityMonitor.js';
export { AlertChannelType, AlertChannel };
export { WebhookAlertChannel } from './webhookAlert.js';
export { EmailAlertChannel } from './emailAlert.js';
export { ConsoleAlertChannel } from './consoleAlert.js';
