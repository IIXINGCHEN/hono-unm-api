import { Hono } from 'hono';
import healthRouter from './health.routes';
import infoRouter from './info.routes';
import musicRouter from './music.routes';
// 如果有其他路由模块，也在这里导入

const apiV1Router = new Hono();

// 在 v1 级别下挂载各个模块的路由
apiV1Router.route('/health', healthRouter);
apiV1Router.route('/info', infoRouter);
apiV1Router.route('/music', musicRouter); // 例如 /api/v1/music/test

export default apiV1Router;
