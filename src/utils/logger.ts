import pino from 'pino';
import config from '@/config'; // 使用路径别名 @/

const logger = pino({
  name: config.appName,
  level: config.logLevel,
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined, // 生产环境直接输出 JSON
});

export default logger;
