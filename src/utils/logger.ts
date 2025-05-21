import pino from 'pino';
import config from '../config/index.js';

// 敏感字段列表
const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'key', 'authorization', 'auth',
  'credential', 'jwt', 'apikey', 'api_key', 'access_token', 'refresh_token'
];

/**
 * 递归清洗对象中的敏感字段
 * @param obj 要清洗的对象
 * @returns 清洗后的对象
 */
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const result: Record<string, any> = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // 检查是否为敏感字段
    const isFieldSensitive = SENSITIVE_FIELDS.some(field =>
      key.toLowerCase().includes(field.toLowerCase())
    );

    if (isFieldSensitive && typeof value === 'string') {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 清洗日志对象
 * @param obj 日志对象
 * @returns 清洗后的日志对象
 */
function sanitizeLogObject(obj: any): any {
  if (typeof obj === 'string') return obj;
  return sanitizeObject(obj);
}

// 自定义日志格式，避免中文乱码问题，并清洗敏感信息
const customLogger = {
  info: (obj: any, msg?: string) => {
    const sanitizedObj = sanitizeLogObject(obj);
    if (msg) {
      console.log(`[INFO] ${msg}`);
    } else {
      console.log(
        `[INFO] ${typeof sanitizedObj === 'string' ? sanitizedObj : JSON.stringify(sanitizedObj)}`,
      );
    }
    return customLogger;
  },
  warn: (obj: any, msg?: string) => {
    const sanitizedObj = sanitizeLogObject(obj);
    if (msg) {
      console.log(`[WARN] ${msg}`);
    } else {
      console.log(
        `[WARN] ${typeof sanitizedObj === 'string' ? sanitizedObj : JSON.stringify(sanitizedObj)}`,
      );
    }
    return customLogger;
  },
  error: (obj: any, msg?: string) => {
    const sanitizedObj = sanitizeLogObject(obj);
    if (msg) {
      console.error(`[ERROR] ${msg}`);
    } else {
      console.error(
        `[ERROR] ${typeof sanitizedObj === 'string' ? sanitizedObj : JSON.stringify(sanitizedObj)}`,
      );
    }
    return customLogger;
  },
  debug: (obj: any, msg?: string) => {
    if (config.logLevel === 'debug' || config.logLevel === 'trace') {
      const sanitizedObj = sanitizeLogObject(obj);
      if (msg) {
        console.log(`[DEBUG] ${msg}`);
      } else {
        console.log(
          `[DEBUG] ${typeof sanitizedObj === 'string' ? sanitizedObj : JSON.stringify(sanitizedObj)}`,
        );
      }
    }
    return customLogger;
  },
  fatal: (obj: any, msg?: string) => {
    const sanitizedObj = sanitizeLogObject(obj);
    if (msg) {
      console.error(`[FATAL] ${msg}`);
    } else {
      console.error(
        `[FATAL] ${typeof sanitizedObj === 'string' ? sanitizedObj : JSON.stringify(sanitizedObj)}`,
      );
    }
    return customLogger;
  },
  child: (bindings: Record<string, any>) => {
    // 在子日志器中也应用敏感信息过滤
    const sanitizedBindings = sanitizeLogObject(bindings);
    return customLogger;
  },
};

// 如果不是开发环境，使用标准的pino日志
const pinoConfig: pino.LoggerOptions = {
  name: config.appName,
  level: config.logLevel,
  // 添加自定义序列化器
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => sanitizeObject(req),
    res: (res) => sanitizeObject(res),
  },
  // 添加自定义序列化钩子
  hooks: {
    logMethod(inputArgs: any[], method: Function) {
      // 清洗所有日志参数
      const args = inputArgs.map(arg =>
        typeof arg === 'object' ? sanitizeObject(arg) : arg
      );
      // 确保第一个参数是字符串消息
      if (args.length === 0 || typeof args[0] !== 'string') {
        args.unshift('');  // 添加空字符串作为消息
      }
      return method.apply(this, args);
    }
  },
  // 使用 pino-pretty 格式化日志输出，解决中文乱码问题
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }
  }
};

// 检查是否强制使用格式化的日志输出
const forcePrettyLogs = process.env.FORCE_PRETTY_LOGS === 'true';

// 根据环境选择日志器
const logger =
  config.nodeEnv === 'development' || forcePrettyLogs ? customLogger : pino(pinoConfig);

export default logger;
