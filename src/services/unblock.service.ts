import unblockMatch from '@unblockneteasemusic/server';
import config from '@/config';
import logger from '@/utils/logger';
import { ApiError } from '@/utils/ApiError';
import type { SongMatchData } from '@/types';

const DEFAULT_SERVERS = [
  'pyncmd', 'kuwo', 'bilibili', 'migu', 'kugou', 'qq',
  'youtube', 'youtube-dl', 'yt-dlp',
];

export const testMatchService = async (
  songId: number | string = 1962165898,
): Promise<SongMatchData> => {
  try {
    logger.info(`[UnblockService] 测试匹配歌曲 ID: ${songId}`);
    // @ts-ignore: @unblockneteasemusic/server 类型定义可能不完整或不准确
    const result: SongMatchData = await unblockMatch(songId, DEFAULT_SERVERS);
    if (!result || !result.url) {
      throw new ApiError(404, `测试 ID ${songId} 未找到匹配`);
    }
    return result;
  } catch (error: any) {
    logger.error(error, `[UnblockService] testMatchService 错误 (ID: ${songId})`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `测试匹配歌曲失败: ${error.message || '未知错误'}`);
  }
};

export const findMatchService = async (
  id: string,
  clientServers?: string[],
): Promise<SongMatchData> => {
  const serversToUse =
    clientServers && clientServers.length > 0 ? clientServers : DEFAULT_SERVERS;
  logger.info(
    `[UnblockService] 尝试匹配 ID: ${id}，使用源: ${serversToUse.join(', ')}`,
  );

  try {
    // @ts-ignore: @unblockneteasemusic/server 类型定义可能不完整或不准确
    const data: SongMatchData = await unblockMatch(id, serversToUse);

    if (!data || !data.url) {
      throw new ApiError(404, `ID ${id} 未找到匹配`);
    }

    if (config.proxyUrl && data.url && data.url.includes('kuwo.cn')) {
      data.proxyUrl = `${config.proxyUrl.replace(/\/$/, '')}/${data.url.replace(/^http(s?):\/\//, '')}`;
      logger.info(`[UnblockService] 应用代理: ${data.proxyUrl}`);
    }

    return data;
  } catch (error: any) {
    logger.error(error, `[UnblockService] findMatchService 错误 (ID: ${id})`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `匹配 ID ${id} 失败: ${error.message || '未知错误'}`);
  }
};
