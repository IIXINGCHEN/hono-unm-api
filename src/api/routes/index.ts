import { Hono } from 'hono';
import healthRouter from './health.routes.js';
import infoRouter from './info.routes.js';
import musicRouter from './music.routes.js';

const apiV1Router = new Hono();

apiV1Router.route('/health', healthRouter);
apiV1Router.route('/info', infoRouter);
apiV1Router.route('/music', musicRouter);

export default apiV1Router;
