import { Hono } from 'hono';
import { sendSuccess } from '../../utils/apiResponse.js';
import config from '../../config/index.js';

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
    '服务健康',
  );
});

export default healthRouter;
