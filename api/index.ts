import { VercelRequest, VercelResponse } from '@vercel/node';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 导入应用程序
import app from '../src/app.js';

// 处理 Vercel 请求
export default async (req: VercelRequest, res: VercelResponse) => {
  // 使用 Hono 的 Vercel 适配器处理请求
  return handle(app, req, res);
};
