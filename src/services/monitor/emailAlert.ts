import nodemailer from 'nodemailer';
import { BaseAlertChannel } from './alertChannel.js';
import { AlertChannelType, AlertResult, EmailAlertChannelConfig, SecurityEvent } from '../../types/monitor.js';
import logger from '../../utils/logger.js';

/**
 * 电子邮件报警通道
 * 通过电子邮件发送报警
 */
export class EmailAlertChannel extends BaseAlertChannel {
  private readonly emailConfig: EmailAlertChannelConfig;
  private transporter: nodemailer.Transporter | null = null;

  constructor(config: EmailAlertChannelConfig) {
    super(config);
    this.emailConfig = config;
  }

  /**
   * 初始化邮件发送器
   */
  private async initTransporter(): Promise<void> {
    if (this.transporter) return;

    try {
      this.transporter = nodemailer.createTransport({
        host: this.emailConfig.smtp.host,
        port: this.emailConfig.smtp.port,
        secure: this.emailConfig.smtp.secure,
        auth: {
          user: this.emailConfig.smtp.auth.user,
          pass: this.emailConfig.smtp.auth.pass,
        },
      });

      // 验证连接配置
      await this.transporter.verify();

      logger.info({
        channelName: this.config.name,
        channelType: this.config.type,
        host: this.emailConfig.smtp.host,
        port: this.emailConfig.smtp.port,
      }, '邮件发送器初始化成功');
    } catch (error) {
      logger.error({
        channelName: this.config.name,
        channelType: this.config.type,
        error,
      }, '邮件发送器初始化失败');

      throw error;
    }
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
      await this.initTransporter();

      // 准备邮件内容
      const subject = this.emailConfig.subject || `[安全报警] ${event.severity.toUpperCase()} - ${event.type}`;
      const text = this.formatEventDetails(event);
      const html = this.formatHtmlContent(event);

      // 发送邮件
      const info = await this.transporter!.sendMail({
        from: this.emailConfig.from,
        to: this.emailConfig.to.join(', '),
        subject,
        text,
        html,
      });

      logger.info({
        channelName: this.config.name,
        channelType: this.config.type,
        eventId: event.id,
        eventType: event.type,
        messageId: info.messageId,
      }, '报警邮件发送成功');

      return this.createSuccessResult();
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 格式化HTML内容
   * @param event 安全事件
   */
  private formatHtmlContent(event: SecurityEvent): string {
    const severityColor = this.getSeverityColor(event.severity);
    const timestamp = new Date(event.timestamp).toLocaleString();

    let detailsHtml = '';
    for (const [key, value] of Object.entries(event.details)) {
      detailsHtml += `<tr><td><strong>${key}</strong></td><td>${JSON.stringify(value)}</td></tr>`;
    }

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${severityColor}; color: white; padding: 10px; border-radius: 5px; }
            .content { padding: 20px 0; }
            table { width: 100%; border-collapse: collapse; }
            table, th, td { border: 1px solid #ddd; }
            th, td { padding: 10px; text-align: left; }
            .footer { font-size: 12px; color: #777; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>安全报警: ${event.type}</h2>
              <p>严重级别: ${event.severity.toUpperCase()}</p>
            </div>
            <div class="content">
              <p><strong>事件ID:</strong> ${event.id}</p>
              <p><strong>时间:</strong> ${timestamp}</p>
              <p><strong>IP地址:</strong> ${event.ip}</p>
              <p><strong>请求路径:</strong> ${event.path}</p>

              <h3>详细信息:</h3>
              <table>
                <tr>
                  <th>属性</th>
                  <th>值</th>
                </tr>
                ${detailsHtml}
              </table>
            </div>
            <div class="footer">
              <p>此邮件由系统自动发送，请勿回复。</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * 获取严重级别对应的颜色
   * @param severity 严重级别
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'info':
        return '#2196F3'; // 蓝色
      case 'low':
        return '#4CAF50'; // 绿色
      case 'medium':
        return '#FF9800'; // 橙色
      case 'high':
        return '#F44336'; // 红色
      case 'critical':
        return '#9C27B0'; // 紫色
      default:
        return '#757575'; // 灰色
    }
  }
}
