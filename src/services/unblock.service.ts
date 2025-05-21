import unblockMatch from '@unblockneteasemusic/server';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import type { SongMatchData } from '../types/index.js';

const DEFAULT_SERVERS = [
  'pyncmd',
  'kuwo',
  'bilibili',
  'migu',
  'kugou',
  'qq',
  'youtube',
  'youtube-dl',
  'yt-dlp',
];

export const testMatchService = async (
  songId: number | string = 1962165898, // 默认测试ID
): Promise<SongMatchData> => {
  const childLogger = logger.child({
    service: 'UnblockService',
    operation: 'testMatch',
    songId,
  });
  childLogger.info('开始测试匹配');
  try {
    // @ts-ignore: @unblockneteasemusic/server 的类型定义可能不完美
    const result: SongMatchData = await unblockMatch(songId, DEFAULT_SERVERS);
    if (!result || !result.url) {
      childLogger.warn('未找到匹配');
      throw new ApiError(404, `测试 ID ${songId} 未找到匹配`);
    }
    childLogger.info('测试匹配成功');
    return result;
  } catch (error: any) {
    childLogger.error({ err: error }, '测试匹配服务发生错误');
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || '测试匹配歌曲时发生未知错误');
  }
};

export const findMatchService = async (
  id: string,
  clientServers?: string[],
): Promise<SongMatchData> => {
  const childLogger = logger.child({
    service: 'UnblockService',
    operation: 'findMatch',
    musicId: id,
  });
  const serversToUse =
    clientServers && clientServers.length > 0 ? clientServers : DEFAULT_SERVERS;
  childLogger.info(`开始匹配，使用源: ${serversToUse.join(', ')}`);

  try {
    // @ts-ignore: @unblockneteasemusic/server 的类型定义可能不完美
    const data: SongMatchData = await unblockMatch(id, serversToUse);

    if (!data || !data.url) {
      childLogger.warn('未找到匹配');
      throw new ApiError(404, `ID ${id} 使用指定源未找到匹配`);
    }

    if (config.proxyUrl && data.url && data.url.includes('kuwo.cn')) {
      // 代理逻辑优化，更精确匹配
      data.proxyUrl = `${config.proxyUrl.replace(/\/$/, '')}/${data.url.replace(/^https?:\/\//, '')}`;
      childLogger.info({ proxyUrl: data.proxyUrl }, '已应用代理');
    }
    childLogger.info('匹配成功');
    return data;
  } catch (error: any) {
    childLogger.error({ err: error }, '匹配服务发生错误');
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || `匹配 ID ${id} 时发生未知错误`);
  }
};
