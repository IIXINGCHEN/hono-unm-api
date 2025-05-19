import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; // 用于 ES modules 获取 __dirname
// @ts-ignore // process.env.npm_package_version 只有在 npm run 脚本时有效
import { version as pkgVersion } from '../../package.json';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 根据 NODE_ENV 加载不同的 .env 文件，例如 .env.production, .env.development
// 这里简化为只加载 .env，实际项目中可以扩展
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
  // jwtSecret?: string;
  // jwtExpiresIn?: string;
}

const config: AppConfig = {
  appName: process.env.APP_NAME || 'hono-unm-api',
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',
  port: parseInt(process.env.PORT || '5678', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: (process.env.LOG_LEVEL as AppConfig['logLevel']) || 'info',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(origin => origin.trim()),
  proxyUrl: process.env.PROXY_URL,
  externalMusicApiUrl:
    process.env.EXTERNAL_MUSIC_API_URL ||
    'https://music-api.gdstudio.xyz/api.php',
  enableFlac: process.env.ENABLE_FLAC === 'true',
  appVersion: process.env.APP_VERSION || pkgVersion || 'unknown',
  // jwtSecret: process.env.JWT_SECRET,
  // jwtExpiresIn: process.env.JWT_EXPIRES_IN,
};

export default config;
