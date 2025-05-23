import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
// 使用硬编码的版本号，避免JSON导入问题
const pkgVersion = '1.0.6';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
// 如果通过命令行参数指定了环境文件，则使用该文件
// 否则使用默认的 .env 文件
const envFile = process.env.ENV_FILE || '.env';
dotenv.config({ path: path.resolve(__dirname, `../../../${envFile}`) });

// 扩展配置接口，添加安全相关配置
interface AppConfig {
  appName: string;
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  host: string;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  allowedOrigins: string[];
  proxyUrl?: string;
  externalMusicApiUrl: string;
  enableFlac: boolean;
  appVersion: string;
  // 安全相关配置
  rateLimitMax: number;
  rateLimitWindowMs: number;
  encryptionKey?: string;
  jwtSecret?: string;
  enableStrictCsp: boolean;
  // API密钥相关配置
  apiKeyEnabled: boolean;
  apiKeyRequiredPaths: string[];
  apiKeySignatureRequired: boolean;
  apiKeySignatureExpiryMs: number;

  // 存储相关配置
  storageType: string;
  storagePath: string;

  // 缓存相关配置
  cacheType: string;
  cacheTtl: number;

  // 监控相关配置
  monitorEnabled: boolean;
  alertEnabled: boolean;
  alertWebhookUrl?: string;

  // 权限相关配置
  permissionEnabled: boolean;
  defaultRole: string;
}

// 定义环境变量验证模式
const envSchema = z.object({
  // 基本配置
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.string()
    .transform(val => parseInt(val, 10))
    .refine(val => !isNaN(val) && val > 0 && val < 65536, {
      message: '端口号必须是1-65535之间的有效数字'
    })
    .default('5678'),
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  ALLOWED_ORIGINS: z.string().default(''),
  PROXY_URL: z.string().optional(),
  EXTERNAL_MUSIC_API_URL: z.string()
    .url({ message: '外部音乐API URL必须是有效的URL' })
    .default('https://music-api.gdstudio.xyz/api.php'),
  ENABLE_FLAC: z.enum(['true', 'false']).default('true'),
  APP_VERSION: z.string().optional(),
  APP_NAME: z.string().min(1).default('hono-unm-api-prod'),

  // 安全相关配置
  RATE_LIMIT_MAX: z.string()
    .transform(val => parseInt(val, 10))
    .default('100'),
  RATE_LIMIT_WINDOW_MS: z.string()
    .transform(val => parseInt(val, 10))
    .default('900000'), // 默认15分钟
  ENCRYPTION_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  ENABLE_STRICT_CSP: z.enum(['true', 'false']).default('true'),

  // API密钥相关配置
  API_KEY_ENABLED: z.enum(['true', 'false']).default('true'),
  API_KEY_REQUIRED_PATHS: z.string().default('/api/v1/music/*'),
  API_KEY_SIGNATURE_REQUIRED: z.enum(['true', 'false']).default('false'),
  API_KEY_SIGNATURE_EXPIRY_MS: z.string()
    .transform(val => parseInt(val, 10))
    .default('300000'), // 默认5分钟

  // 存储相关配置
  STORAGE_TYPE: z.enum(['file', 'sqlite', 'memory']).default('file'),
  STORAGE_PATH: z.string().default('./data'),

  // 缓存相关配置
  CACHE_TYPE: z.enum(['memory', 'redis', 'none']).default('memory'),
  CACHE_TTL: z.string()
    .transform(val => parseInt(val, 10))
    .default('300'), // 默认5分钟

  // 监控相关配置
  MONITOR_ENABLED: z.enum(['true', 'false']).default('true'),
  ALERT_ENABLED: z.enum(['true', 'false']).default('false'),
  ALERT_WEBHOOK_URL: z.string().url().optional(),

  // 权限相关配置
  PERMISSION_ENABLED: z.enum(['true', 'false']).default('true'),
  DEFAULT_ROLE: z.string().default('read')
});

// 验证环境变量
let validatedEnv;
try {
  validatedEnv = envSchema.parse(process.env);
} catch (error) {
  console.error('环境变量验证失败:', error);
  // 不退出进程，使用默认值继续
  validatedEnv = envSchema.parse({});
}

// 检查生产环境中的关键配置
if (validatedEnv.NODE_ENV === 'production') {
  // 检查CORS配置
  if (validatedEnv.ALLOWED_ORIGINS.includes('*')) {
    console.warn('安全风险: ALLOWED_ORIGINS 包含通配符 "*"，这在生产环境中不安全');
  }

  if (!validatedEnv.ALLOWED_ORIGINS) {
    console.warn('警告: ALLOWED_ORIGINS 未配置，这可能导致CORS问题');
  }

  // 检查外部API URL
  if (!validatedEnv.EXTERNAL_MUSIC_API_URL.startsWith('https://')) {
    console.warn('安全风险: EXTERNAL_MUSIC_API_URL 不是HTTPS URL');
  }

  // 检查加密密钥
  if (!validatedEnv.ENCRYPTION_KEY) {
    console.warn('安全风险: ENCRYPTION_KEY 未设置，将使用不安全的默认值');
  }
}

// 解析CORS配置
const allowedOrigins = (validatedEnv.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// 解析API密钥必需路径
const apiKeyRequiredPaths = (validatedEnv.API_KEY_REQUIRED_PATHS || '')
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);

// 创建配置对象
const config: AppConfig = {
  appName: validatedEnv.APP_NAME,
  nodeEnv: validatedEnv.NODE_ENV,
  port: validatedEnv.PORT,
  host: validatedEnv.HOST,
  logLevel: validatedEnv.LOG_LEVEL,
  allowedOrigins,
  proxyUrl: validatedEnv.PROXY_URL,
  externalMusicApiUrl: validatedEnv.EXTERNAL_MUSIC_API_URL,
  enableFlac: validatedEnv.ENABLE_FLAC === 'true',
  appVersion: validatedEnv.APP_VERSION || pkgVersion || '1.0.6',
  // 安全相关配置
  rateLimitMax: validatedEnv.RATE_LIMIT_MAX,
  rateLimitWindowMs: validatedEnv.RATE_LIMIT_WINDOW_MS,
  encryptionKey: validatedEnv.ENCRYPTION_KEY,
  jwtSecret: validatedEnv.JWT_SECRET,
  enableStrictCsp: validatedEnv.ENABLE_STRICT_CSP === 'true',
  // API密钥相关配置
  apiKeyEnabled: validatedEnv.API_KEY_ENABLED === 'true',
  apiKeyRequiredPaths,
  apiKeySignatureRequired: validatedEnv.API_KEY_SIGNATURE_REQUIRED === 'true',
  apiKeySignatureExpiryMs: validatedEnv.API_KEY_SIGNATURE_EXPIRY_MS,
  // 存储相关配置
  storageType: validatedEnv.STORAGE_TYPE,
  storagePath: validatedEnv.STORAGE_PATH,
  // 缓存相关配置
  cacheType: validatedEnv.CACHE_TYPE,
  cacheTtl: validatedEnv.CACHE_TTL,
  // 监控相关配置
  monitorEnabled: validatedEnv.MONITOR_ENABLED === 'true',
  alertEnabled: validatedEnv.ALERT_ENABLED === 'true',
  alertWebhookUrl: validatedEnv.ALERT_WEBHOOK_URL,
  // 权限相关配置
  permissionEnabled: validatedEnv.PERMISSION_ENABLED === 'true',
  defaultRole: validatedEnv.DEFAULT_ROLE,
};

export default config;
