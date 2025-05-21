import logger from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 安全事件类型
 */
interface SecurityEvent {
  type: 'rate_limit' | 'invalid_input' | 'unauthorized' | 'suspicious';
  timestamp: string;
  ip: string;
  path: string;
  details: Record<string, any>;
}

/**
 * 安全监控类
 * 用于记录和分析安全相关事件
 */
class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 1000;
  private readonly logPath: string;
  
  constructor() {
    this.logPath = path.resolve(__dirname, '../../../logs/security');
    
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
   * 记录安全事件
   * @param event 安全事件
   */
  logEvent(event: Omit<SecurityEvent, 'timestamp'>) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };
    
    // 添加到内存缓存
    this.events.push(securityEvent);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    
    // 记录到日志
    logger.warn({ securityEvent }, '安全事件');
    
    // 对于严重事件，写入专门的安全日志文件
    if (event.type === 'unauthorized' || event.type === 'suspicious') {
      try {
        const logFile = path.join(
          this.logPath, 
          `security-${new Date().toISOString().split('T')[0]}.log`
        );
        
        fs.appendFileSync(
          logFile, 
          JSON.stringify(securityEvent) + '\n'
        );
      } catch (error) {
        logger.error({ err: error }, '写入安全日志文件失败');
      }
    }
  }
  
  /**
   * 获取最近的安全事件
   * @param count 事件数量
   * @returns 安全事件列表
   */
  getRecentEvents(count = 100): SecurityEvent[] {
    return this.events.slice(-count);
  }
  
  /**
   * 获取安全事件统计摘要
   * @returns 各类型事件的数量
   */
  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {
      rate_limit: 0,
      invalid_input: 0,
      unauthorized: 0,
      suspicious: 0
    };
    
    for (const event of this.events) {
      summary[event.type]++;
    }
    
    return summary;
  }
}

// 导出单例实例
export const securityMonitor = new SecurityMonitor();
