import { Hono } from 'hono';
import config from '@/config';
import { sendSuccess } from '@/utils/apiResponse';

const infoRouter = new Hono();

infoRouter.get('/info', (c) => {
  const infoData = {
    version: config.appVersion,
    enable_flac: config.enableFlac,
    node_env: config.nodeEnv,
    allowed_origins: config.allowedOrigins,
    external_api: config.externalMusicApiUrl,
    // 可以添加更多希望公开的服务信息
  };
  return sendSuccess(c, infoData, '服务信息获取成功');
});

export default infoRouter;
