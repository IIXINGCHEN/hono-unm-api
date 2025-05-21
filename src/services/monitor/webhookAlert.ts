import axios from 'axios';
import { BaseAlertChannel } from './alertChannel.js';
import { AlertChannelType, AlertResult, SecurityEvent, WebhookAlertChannelConfig } from '../../types/monitor.js';
import logger from '../../utils/logger.js';

/**
 * Webhook报警通道
 * 通过HTTP请求发送报警
 */
export class WebhookAlertChannel extends BaseAlertChannel {
  private readonly webhookConfig: WebhookAlertChannelConfig;

  constructor(config: WebhookAlertChannelConfig) {
    super(config);
    this.webhookConfig = config;
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
      const method = this.webhookConfig.method || 'POST';
      const timeout = this.webhookConfig.timeout || 5000;
      const retryCount = this.webhookConfig.retryCount || 3;

      // 准备请求数据
      const data = {
        event,
        timestamp: new Date().toISOString(),
        source: 'hono-unm-api',
      };

      // 发送请求
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < retryCount) {
        try {
          const response = await axios({
            method,
            url: this.webhookConfig.url,
            headers: this.webhookConfig.headers || {
              'Content-Type': 'application/json',
            },
            data: method === 'POST' ? data : undefined,
            params: method === 'GET' ? data : undefined,
            timeout,
          });

          logger.info({
            channelName: this.config.name,
            channelType: this.config.type,
            eventId: event.id,
            eventType: event.type,
            statusCode: response.status,
          }, '报警发送成功');

          return this.createSuccessResult();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          logger.warn({
            channelName: this.config.name,
            channelType: this.config.type,
            eventId: event.id,
            eventType: event.type,
            attempt: attempt + 1,
            error: lastError,
          }, '报警发送失败，准备重试');

          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          attempt++;
        }
      }

      // 所有重试都失败
      throw lastError || new Error('发送报警失败，超过最大重试次数');
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
