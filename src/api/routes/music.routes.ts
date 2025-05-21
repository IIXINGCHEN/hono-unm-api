import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  getNcmTrackUrlService,
  getOtherSourceTrackUrlService,
} from '../../services/music.service.js';
import {
  findMatchService,
  testMatchService,
} from '../../services/unblock.service.js';
import {
  matchQuerySchema,
  ncmGetQuerySchema,
  otherGetQuerySchema,
} from '../validators/music.validators.js';
import { sendSuccess } from '../../utils/apiResponse.js';

const musicRouter = new Hono();

musicRouter.get('/test', async (c) => {
  const data = await testMatchService();
  return sendSuccess(c, data, '测试匹配操作成功');
});

musicRouter.get(
  '/match',
  zValidator('query', matchQuerySchema, (result, c) => {
    // Zod 验证失败时的自定义处理
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: '请求参数验证失败。',
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
        400,
      );
    }
  }),
  async (c) => {
    const { id, server } = c.req.valid('query');
    const data = await findMatchService(id, server);
    return sendSuccess(c, data, '歌曲匹配操作成功');
  },
);

musicRouter.get(
  '/ncmget',
  zValidator('query', ncmGetQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: '请求参数验证失败。',
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
        400,
      );
    }
  }),
  async (c) => {
    const { id, br } = c.req.valid('query');
    const data = await getNcmTrackUrlService(id, br);
    return sendSuccess(c, data, '网易云歌曲链接获取成功');
  },
);

musicRouter.get(
  '/otherget',
  zValidator('query', otherGetQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: '请求参数验证失败。',
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
        400,
      );
    }
  }),
  async (c) => {
    const { name } = c.req.valid('query');
    const data = await getOtherSourceTrackUrlService(name);
    return sendSuccess(c, data, '其他音源歌曲链接获取成功');
  },
);

export default musicRouter;
