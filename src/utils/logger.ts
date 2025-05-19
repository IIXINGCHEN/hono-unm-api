import pino from 'pino';
import config from '@/config';

const pinoConfig: pino.LoggerOptions = {
  name: config.appName,
  level: config.logLevel,
};

if (config.nodeEnv === 'development') {
  pinoConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
      ignore: 'pid,hostname,name', // name 在顶层已定义
    },
  };
}

const logger = pino(pinoConfig);

export default logger;
