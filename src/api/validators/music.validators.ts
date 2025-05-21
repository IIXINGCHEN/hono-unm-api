import { z } from 'zod';

// 安全的ID验证模式
const safeIdSchema = z.string()
  .min(1, { message: '参数 "id" 为必需项且不能为空。' })
  .regex(/^[0-9]+$/, { message: '参数 "id" 必须为数字。' })
  .transform(val => val.trim());

// 安全的服务器列表验证模式
const safeServerListSchema = z.string()
  .optional()
  .transform((val) =>
    val
      ? val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)) // 只允许字母、数字、下划线和连字符
      : undefined,
  );

// 安全的比特率验证模式
const safeBitrateSchema = z.enum(['128', '192', '320', '740', '999'], {
  errorMap: (issue, ctx) => ({
    message: `参数 "br" 音质值无效，允许的值为: 128, 192, 320, 740, 999。实际收到: ${ctx.data}`,
  }),
}).default('320');

// 安全的名称验证模式
const safeNameSchema = z.string()
  .min(1, { message: '参数 "name" 歌曲名称为必需项且不能为空。' })
  .max(100, { message: '参数 "name" 歌曲名称不能超过100个字符。' })
  .transform(val => val.trim())
  .refine(val => !/[<>]/.test(val), {
    message: '参数 "name" 包含无效字符。'
  });

// 匹配查询验证模式
export const matchQuerySchema = z.object({
  id: safeIdSchema,
  server: safeServerListSchema,
});

// 网易云获取链接验证模式
export const ncmGetQuerySchema = z.object({
  id: safeIdSchema,
  br: safeBitrateSchema,
});

// 其他源获取链接验证模式
export const otherGetQuerySchema = z.object({
  name: safeNameSchema,
});
