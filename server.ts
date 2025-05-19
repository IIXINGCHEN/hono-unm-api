import { serve } from '@hono/node-server';
import { inspect } from 'util'; // 用于打印复杂对象
import net from 'net'; // 用于端口检查

import app from '@/app'; // 导入 Hono 应用实例
import config from '@/config';
import logger from '@/utils/logger';
import { pinoHttp } from 'pino-http'; // 用于 Node.js HTTP 请求的结构化日志

// 为 Node.js HTTP 请求添加结构化日志 (Pino)
// 这个中间件应该在 Hono 应用级别使用，但 @hono/node-server 的 serve 函数
// 直接接收 Hono app。一种方式是修改 Hono app 本身，在其中加入 pinoHttp 中间件。
// Hono v4 更新：可以直接将 pinoHttp 作为 Hono 中间件使用。
// 在 app.ts 中:
// import { Hono } from 'hono';
// import { pino } from 'pino-http';
// const app = new Hono();
// app.use('*', pino({ logger })); // 在 app.ts 顶部添加

// 如果不修改 app.ts, 另一种方式是只在启动日志中记录，或者在 Hono 的路由/中间件中手动记录。
// 为了保持 app.ts 的通用性 (跨运行时)，我们这里仅在启动时记录。
// 对于更细致的请求日志，应在 app.ts 中集成 pino-http。

// 端口检查函数
const checkPort = (port: number, host: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false); // 端口被占用
      } else {
        logger.error(err, `检查端口 ${host}:${port} 时发生未知错误`);
        resolve(false); // 其他错误也视为不可用
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(true)); // 端口可用
    });
    server.listen(port, host);
  });
};

const startServer = async () => {
  let currentPort = config.port;
  const maxPortAttempts = 10; // 最多尝试10个端口
  let isPortAvailable = false;

  for (let i = 0; i < maxPortAttempts; i++) {
    isPortAvailable = await checkPort(currentPort, config.host);
    if (isPortAvailable) {
      break;
    }
    logger.warn(`端口 ${config.host}:${currentPort} 已被占用，尝试端口 ${currentPort + 1}`);
    currentPort++;
  }

  if (!isPortAvailable) {
    logger.fatal(`无法在 ${config.host} 上找到可用端口 (从 ${config.port} 开始尝试了 ${maxPortAttempts} 个)。`);
    process.exit(1);
  }

  const serverInstance = serve(
    {
      fetch: app.fetch, // Hono app 的 fetch 处理函数
      port: currentPort,
      hostname: config.host,
    },
    (info) => {
      logger.info(
        `服务已启动！环境: ${config.nodeEnv}, 版本: ${config.appVersion}`,
      );
      logger.info(`监听于: http://${info.address}:${info.port}`);
      logger.info(`允许的 CORS 源: ${config.allowedOrigins.join(', ')}`);
      logger.info('按 CTRL-C 停止服务');
    },
  );

  // 优雅关闭处理
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`接收到 ${signal} 信号，开始优雅关闭...`);
      serverInstance.close((err) => {
        if (err) {
          logger.error(err, '服务器关闭时发生错误');
          process.exit(1);
        }
        logger.info('服务器已成功关闭。');
        process.exit(0);
      });
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal(
      { reason, promise: inspect(promise) },
      '捕获到未处理的 Promise Rejection',
    );
    // 考虑是否需要关闭服务器
    // process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal(error, '捕获到未捕获的异常');
    // 对于未捕获的异常，通常建议立即退出，因为应用可能处于不稳定状态
    process.exit(1);
  });
};

startServer().catch((error) => {
  logger.fatal(error, '启动服务器失败');
  process.exit(1);
});
