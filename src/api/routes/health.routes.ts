import { Hono } from 'hono';
import { sendSuccess } from '@/utils/apiResponse';
import config from '@/config';

const healthRouter = new Hono();

healthRouter.get('/healthz', (c) => {
  return sendSuccess(
    c,
    {
      status: 'UP',
      timestamp: new Date().toISOString(),
      version: config.appVersion,
      environment: config.nodeEnv,
    },
    '服务健康状态良好',
  );
});

export default healthRouter;
