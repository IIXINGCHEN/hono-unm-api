import { z } from 'zod';

export const matchQuerySchema = z.object({
  id: z.string().min(1, { message: '参数 "id" 为必需项且不能为空。' }),
  server: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()).filter(Boolean) : undefined)),
});

export const ncmGetQuerySchema = z.object({
  id: z.string().min(1, { message: '参数 "id" 为必需项且不能为空。' }),
  br: z
    .enum(['128', '192', '320', '740', '999'], {
      errorMap: (issue, ctx) => ({ message: `参数 "br" 音质值无效，允许的值为: 128, 192, 320, 740, 999。实际收到: ${ctx.data}` }),
    })
    .default('320'), // 确保如果可选，则有默认值
});

export const otherGetQuerySchema = z.object({
  name: z.string().min(1, { message: '参数 "name" 歌曲名称为必需项且不能为空。' }),
});
