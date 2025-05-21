import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handle } from 'hono/vercel';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 设置 Vercel 环境标记
process.env.VERCEL = '1';

// 设置默认环境变量，确保应用程序不会因为缺少环境变量而崩溃
if (!process.env.APP_NAME) {
  process.env.APP_NAME = 'hono-unm-api-prod';
}

// 尝试加载环境变量，但不依赖它们的存在
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
} catch (error) {
  console.warn('无法加载 .env 文件，将使用默认值或环境变量。', error);
}

// 导入应用程序
import app from '../src/app.js';

// 处理 Vercel 请求
// @ts-ignore - 忽略类型推断问题
const handler = async (req: VercelRequest, res: VercelResponse) => {
  try {
    // 记录一些调试信息
    console.log('Vercel 环境变量:', {
      APP_NAME: process.env.APP_NAME,
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      HOST: process.env.HOST,
      VERCEL: process.env.VERCEL,
    });

    // 使用 Hono 的 Vercel 适配器处理请求
    // @ts-ignore - 类型定义可能不匹配，但实际上这是正确的用法
    return handle(app)(req, res);
  } catch (error) {
    console.error('处理请求时发生错误:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '服务器内部错误',
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

export default handler;
