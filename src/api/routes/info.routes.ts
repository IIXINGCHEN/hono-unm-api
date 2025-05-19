import { Hono } from 'hono';
import config from '@/config';
import { sendSuccess } from '@/utils/apiResponse';

const infoRouter = new Hono();

infoRouter.get('/info', (c) => {
  const infoData = {
    application_name: config.appName,
    version: config.appVersion,
    environment: config.nodeEnv,
    configuration: {
        enable_flac: config.enableFlac,
        allowed_origins_count: config.allowedOrigins.length,
        proxy_enabled: !!config.proxyUrl,
        external_api_configured: !!config.externalMusicApiUrl,
    }
  };
  return sendSuccess(c, infoData, '服务信息');
});

export default infoRouter;
