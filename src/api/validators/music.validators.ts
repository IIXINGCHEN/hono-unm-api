import { z } from 'zod';

export const matchQuerySchema = z.object({
  id: z.string().min(1, { message: '参数 "id" 不能为空' }),
  server: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : undefined)), // 确保去除空格
});

export const ncmGetQuerySchema = z.object({
  id: z.string().min(1, { message: '参数 "id" 不能为空' }),
  br: z
    .enum(['128', '192', '320', '740', '999'], {
      errorMap: () => ({ message: '参数 "br" 音质值无效' }),
    })
    .default('320')
    .optional(),
});

export const otherGetQuerySchema = z.object({
  name: z.string().min(1, { message: '参数 "name" 歌曲名称不能为空' }),
});
