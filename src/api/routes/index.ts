import { Hono } from 'hono';
import healthRouter from './health.routes.js';
import infoRouter from './info.routes.js';
import musicRouter from './music.routes.js';
import authRouter from './auth.routes.js';
import monitorRouter from './monitor.routes.js';
import permissionRouter from './permission.routes.js';

const apiV1Router = new Hono();

apiV1Router.route('/health', healthRouter);
apiV1Router.route('/info', infoRouter);
apiV1Router.route('/music', musicRouter);
apiV1Router.route('/auth', authRouter);
apiV1Router.route('/monitor', monitorRouter);
apiV1Router.route('/permission', permissionRouter);

export default apiV1Router;
