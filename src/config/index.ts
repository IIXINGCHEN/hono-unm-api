import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// 使用硬编码的版本号，避免JSON导入问题
const pkgVersion = '1.0.6';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

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
}

const appNameFromEnv = process.env.APP_NAME;
if (!appNameFromEnv) {
  console.error('错误：环境变量 APP_NAME 未设置。');
  process.exit(1);
}

const allowedOriginsFromEnv = process.env.ALLOWED_ORIGINS;
if (!allowedOriginsFromEnv && process.env.NODE_ENV === 'production') {
  console.warn('警告：生产环境中 ALLOWED_ORIGINS 未设置，CORS 可能不允许任何源。');
}


const config: AppConfig = {
  appName: appNameFromEnv,
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'production',
  port: parseInt(process.env.PORT || '5678', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: (process.env.LOG_LEVEL as AppConfig['logLevel']) || 'info',
  allowedOrigins: (allowedOriginsFromEnv || '').split(',').map(origin => origin.trim()).filter(Boolean),
  proxyUrl: process.env.PROXY_URL || undefined,
  externalMusicApiUrl:
    process.env.EXTERNAL_MUSIC_API_URL ||
    'https://music-api.gdstudio.xyz/api.php',
  enableFlac: process.env.ENABLE_FLAC === 'true',
  appVersion: process.env.APP_VERSION || pkgVersion || '1.0.0',
};

if (isNaN(config.port) || config.port <= 0 || config.port > 65535) {
  console.error(`错误：无效的端口号配置: ${process.env.PORT}`);
  process.exit(1);
}


export default config;
