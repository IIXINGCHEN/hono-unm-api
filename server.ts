import { serve } from '@hono/node-server';
import { inspect } from 'util';
import net from 'net';

import app from './src/app.js';
import config from './src/config/index.js';
import logger from './src/utils/logger.js';
import { InitManager } from './src/services/initManager.js';

const checkPort = (port: number, host: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref(); // 允许程序在 server 未关闭时退出
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        logger.error({ err }, `检查端口 ${host}:${port} 时发生错误`);
        resolve(false);
      }
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
};

const startServer = async () => {
  let currentPort = config.port;
  const maxPortAttempts = 10;
  let isPortAvailable = false;

  for (let i = 0; i < maxPortAttempts; i++) {
    isPortAvailable = await checkPort(currentPort, config.host);
    if (isPortAvailable) {
      break;
    }
    logger.warn(`端口 ${config.host}:${currentPort} 被占用，尝试端口 ${currentPort + 1}`);
    currentPort++;
  }

  if (!isPortAvailable) {
    logger.fatal(`在 ${config.host} 上未能找到可用端口 (从 ${config.port} 开始尝试)。`);
    process.exit(1);
  }

  const serverInstance = serve(
    {
      fetch: app.fetch,
      port: currentPort,
      hostname: config.host,
    },
    (info) => {
      logger.info(
        `服务已启动。环境: ${config.nodeEnv}, 版本: ${config.appVersion}, PID: ${process.pid}`,
      );
      logger.info(`监听地址: http://${info.address}:${info.port}`);
      if (config.allowedOrigins.length > 0) {
        logger.info(`CORS 允许的源: ${config.allowedOrigins.join(', ')}`);
      } else {
        logger.warn('CORS ALLOWED_ORIGINS 未配置，生产环境可能导致跨域问题。');
      }
      logger.info('按 CTRL-C 停止服务。');
    },
  );

  const gracefulShutdown = async (signal: string) => {
    logger.info(`接收到 ${signal} 信号，开始优雅关闭...`);

    try {
      // 关闭所有服务
      await InitManager.shutdown();

      serverInstance.close((err) => {
        if (err) {
          logger.error({ err }, '服务器关闭期间发生错误');
          process.exit(1);
        }
        logger.info('服务器已成功关闭。');
        process.exit(0);
      });
    } catch (error) {
      logger.error({ err: error }, '关闭服务失败');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    gracefulShutdown('SIGINT').catch(error => {
      logger.error({ err: error }, '处理 SIGINT 信号时发生错误');
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    gracefulShutdown('SIGTERM').catch(error => {
      logger.error({ err: error }, '处理 SIGTERM 信号时发生错误');
      process.exit(1);
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal(
      { reason, promiseDetails: inspect(promise, { depth: 3 }) }, // 增加inspect深度
      '捕获到未处理的 Promise Rejection',
    );
    // 考虑是否总是退出，或者只在特定类型的 unhandledRejection 时退出
    // process.exit(1);
  });

  process.on('uncaughtException', (error, origin) => {
    logger.fatal({ err: error, origin }, '捕获到未捕获的异常');
    // 根据 Node.js 官方文档，发生 uncaughtException 后应立即退出
    process.exit(1);
  });
};

startServer().catch((error) => {
  logger.fatal({ err: error }, '启动服务器时发生致命错误');
  process.exit(1);
});
