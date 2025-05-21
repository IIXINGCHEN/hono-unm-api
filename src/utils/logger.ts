import pino from 'pino';
import config from '../config/index.js';

// 自定义日志格式，避免中文乱码问题
const customLogger = {
  info: (obj: any, msg?: string) => {
    if (msg) {
      console.log(`[INFO] ${msg}`);
    } else {
      console.log(
        `[INFO] ${typeof obj === 'string' ? obj : JSON.stringify(obj)}`,
      );
    }
    return customLogger;
  },
  warn: (obj: any, msg?: string) => {
    if (msg) {
      console.log(`[WARN] ${msg}`);
    } else {
      console.log(
        `[WARN] ${typeof obj === 'string' ? obj : JSON.stringify(obj)}`,
      );
    }
    return customLogger;
  },
  error: (obj: any, msg?: string) => {
    if (msg) {
      console.error(`[ERROR] ${msg}`);
    } else {
      console.error(
        `[ERROR] ${typeof obj === 'string' ? obj : JSON.stringify(obj)}`,
      );
    }
    return customLogger;
  },
  debug: (obj: any, msg?: string) => {
    if (config.logLevel === 'debug' || config.logLevel === 'trace') {
      if (msg) {
        console.log(`[DEBUG] ${msg}`);
      } else {
        console.log(
          `[DEBUG] ${typeof obj === 'string' ? obj : JSON.stringify(obj)}`,
        );
      }
    }
    return customLogger;
  },
  fatal: (obj: any, msg?: string) => {
    if (msg) {
      console.error(`[FATAL] ${msg}`);
    } else {
      console.error(
        `[FATAL] ${typeof obj === 'string' ? obj : JSON.stringify(obj)}`,
      );
    }
    return customLogger;
  },
  child: () => customLogger,
};

// 如果不是开发环境，使用标准的pino日志
const pinoConfig: pino.LoggerOptions = {
  name: config.appName,
  level: config.logLevel,
};

// 根据环境选择日志器
const logger =
  config.nodeEnv === 'development' ? customLogger : pino(pinoConfig);

export default logger;
