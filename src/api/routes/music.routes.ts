import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  getNcmTrackUrlService,
  getOtherSourceTrackUrlService,
} from '@/services/music.service';
import {
  findMatchService,
  testMatchService,
} from '@/services/unblock.service';
import {
  matchQuerySchema,
  ncmGetQuerySchema,
  otherGetQuerySchema,
} from '@/api/validators/music.validators';
import { sendSuccess } from '@/utils/apiResponse';

const musicRouter = new Hono();

musicRouter.get('/test', async (c) => {
  const data = await testMatchService();
  return sendSuccess(c, data, '测试匹配成功');
});

musicRouter.get(
  '/match',
  zValidator('query', matchQuerySchema),
  async (c) => {
    const { id, server } = c.req.valid('query');
    const data = await findMatchService(id, server);
    return sendSuccess(c, data, '匹配成功');
  },
);

musicRouter.get(
  '/ncmget',
  zValidator('query', ncmGetQuerySchema),
  async (c) => {
    const { id, br } = c.req.valid('query');
    // br 从 Zod schema 获得，确保是定义的枚举值或默认值
    const data = await getNcmTrackUrlService(id, br as string); // br 可能为 undefined，但 schema 有 default
    return sendSuccess(c, data, '网易云歌曲链接获取成功');
  },
);

musicRouter.get(
  '/otherget',
  zValidator('query', otherGetQuerySchema),
  async (c) => {
    const { name } = c.req.valid('query');
    const data = await getOtherSourceTrackUrlService(name);
    return sendSuccess(c, data, '其他源歌曲链接获取成功');
  },
);

export default musicRouter;

