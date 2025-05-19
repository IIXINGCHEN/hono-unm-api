// 注意: Hono 内置了 fetch，通常不需要额外安装 node-fetch，除非特定 Node.js 版本或场景
// import fetch from 'node-fetch'; // 如果在不支持全局 fetch 的旧 Node.js 环境
import config from '@/config';
import logger from '@/utils/logger';
import { ApiError } from '@/utils/ApiError';
import type { NcmTrackUrlData, OtherSourceTrackData } from '@/types';

export const getNcmTrackUrlService = async (
  id: string,
  br: string,
): Promise<NcmTrackUrlData> => {
  logger.info(
    `[MusicService] 获取网易云歌曲链接，ID: ${id}, 音质: ${br}`,
  );
  const apiUrl = new URL(config.externalMusicApiUrl);
  apiUrl.searchParams.append('types', 'url');
  apiUrl.searchParams.append('id', id);
  apiUrl.searchParams.append('br', br);

  try {
    const response = await fetch(apiUrl.toString());
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        `[MusicService] 外部 API 错误 (NCM Track)。状态: ${response.status}, 响应体: ${errorBody}`,
      );
      throw new ApiError(
        response.status,
        `获取网易云歌曲链接失败: 外部 API 响应 ${response.statusText}`,
      );
    }
    const result = (await response.json()) as { url?: string; [key: string]: any };

    if (!result || !result.url) {
      logger.warn(
        `[MusicService] 未在外部 API 响应中找到 NCM 歌曲链接 (ID: ${id})`,
        result,
      );
      throw new ApiError(404, '未在外部 API 响应中找到 NCM 歌曲链接');
    }

    const trackData: NcmTrackUrlData = {
      id,
      br,
      url: result.url,
    };

    if (config.proxyUrl && trackData.url && trackData.url.includes('kuwo.cn')) {
      trackData.proxyUrl = `${config.proxyUrl.replace(/\/$/, '')}/${trackData.url.replace(/^http(s?):\/\//, '')}`;
      logger.info(`[MusicService] 应用代理 (NCM Track): ${trackData.proxyUrl}`);
    }

    return trackData;
  } catch (error: any) {
    logger.error(error, `[MusicService] getNcmTrackUrlService 错误 (ID: ${id})`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      500,
      `获取网易云歌曲链接失败: ${error.message || '未知错误'}`,
    );
  }
};

export const getOtherSourceTrackUrlService = async (
  name: string,
): Promise<OtherSourceTrackData> => {
  logger.info(`[MusicService] 从其他源搜索歌曲: ${name}`);

  const searchApiUrl = new URL(config.externalMusicApiUrl);
  searchApiUrl.searchParams.append('types', 'search');
  searchApiUrl.searchParams.append('source', 'kuwo'); // 可配置化
  searchApiUrl.searchParams.append('name', name);
  searchApiUrl.searchParams.append('count', '1');
  searchApiUrl.searchParams.append('pages', '1');

  let searchResult: any[];
  try {
    logger.debug(`[MusicService] 请求搜索 URL: ${searchApiUrl.toString()}`);
    const searchResponse = await fetch(searchApiUrl.toString());
    if (!searchResponse.ok) {
      const errorBody = await searchResponse.text();
      logger.error(
        `[MusicService] 外部 API 搜索错误。状态: ${searchResponse.status}, 响应体: ${errorBody}`,
      );
      throw new ApiError(
        searchResponse.status,
        `外部 API 搜索失败: ${searchResponse.statusText}`,
      );
    }
    searchResult = (await searchResponse.json()) as any[];
    logger.debug({ searchResult }, '[MusicService] 搜索 API 响应已接收');
  } catch (error: any) {
    logger.error(error, `[MusicService] 歌曲搜索错误 (名称: ${name})`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `歌曲搜索失败: ${error.message || '未知错误'}`);
  }

  if (
    !Array.isArray(searchResult) ||
    searchResult.length === 0 ||
    !searchResult[0] ||
    !searchResult[0].url_id
  ) {
    logger.warn(
      `[MusicService] 未在搜索结果中找到歌曲 ID (名称: ${name})`,
      searchResult,
    );
    throw new ApiError(404, `歌曲 '${name}' 未从指定源找到`);
  }
  const trackSourceId = searchResult[0].url_id as string;
  logger.info(`[MusicService] 找到歌曲 ID: ${trackSourceId} (名称: ${name})`);

  const idUrlApi = new URL(config.externalMusicApiUrl);
  idUrlApi.searchParams.append('types', 'url');
  idUrlApi.searchParams.append('source', 'kuwo');
  idUrlApi.searchParams.append('id', trackSourceId);
  idUrlApi.searchParams.append('br', '999'); // 最高音质，可配置

  try {
    logger.debug(`[MusicService] 请求歌曲链接 URL: ${idUrlApi.toString()}`);
    const urlResponse = await fetch(idUrlApi.toString());
    if (!urlResponse.ok) {
      const errorBody = await urlResponse.text();
      logger.error(
        `[MusicService] 外部 API 获取链接错误。状态: ${urlResponse.status}, 响应体: ${errorBody}`,
      );
      throw new ApiError(
        urlResponse.status,
        `外部 API 获取链接失败: ${urlResponse.statusText}`,
      );
    }
    const urlResult = (await urlResponse.json()) as { url?: string; [key: string]: any };
    logger.debug({ urlResult }, '[MusicService] 歌曲链接 API 响应已接收');

    if (!urlResult || !urlResult.url) {
      logger.warn(
        `[MusicService] 未在外部 API 响应中找到歌曲链接 (ID: ${trackSourceId})`,
      );
      throw new ApiError(404, '搜索后未从外部 API 获取到歌曲链接');
    }

    const trackData: OtherSourceTrackData = {
      name,
      sourceId: trackSourceId,
      url: urlResult.url,
    };

    if (config.proxyUrl && trackData.url && trackData.url.includes('kuwo.cn')) {
      trackData.proxyUrl = `${config.proxyUrl.replace(/\/$/, '')}/${trackData.url.replace(/^http(s?):\/\//, '')}`;
      logger.info(`[MusicService] 应用代理 (Other Source): ${trackData.proxyUrl}`);
    }
    return trackData;
  } catch (error: any) {
    logger.error(error, `[MusicService] 获取歌曲链接错误 (ID: ${trackSourceId})`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      500,
      `搜索后获取歌曲链接失败: ${error.message || '未知错误'}`,
    );
  }
};
