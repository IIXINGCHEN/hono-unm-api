import config from '../config/index.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import type { NcmTrackUrlData, OtherSourceTrackData } from '../types/index.js';

async function fetchExternalApi(
  url: URL,
  operationName: string,
  contextData: Record<string, any>,
) {
  const childLogger = logger.child({
    service: 'MusicService',
    operation: operationName,
    ...contextData,
    targetUrl: url.toString(),
  });
  childLogger.debug('开始请求外部 API');

  const response = await fetch(url.toString(), {
    // 可以添加超时、请求头等配置
    signal: AbortSignal.timeout(10000), // 10秒超时
  });

  if (!response.ok) {
    let errorBody = '无法读取响应体';
    try {
      errorBody = await response.text();
    } catch (e) {
      childLogger.warn('读取外部API错误响应体失败');
    }
    childLogger.error(
      { status: response.status, body: errorBody },
      '外部 API 请求失败',
    );
    throw new ApiError(
      response.status,
      `外部 API 操作 '${operationName}' 失败: ${response.statusText}`,
    );
  }

  try {
    const jsonData = await response.json();
    childLogger.debug('外部 API 响应成功并解析为 JSON');
    return jsonData;
  } catch (error: any) {
    childLogger.error({ err: error }, '解析外部 API 响应 JSON 失败');
    throw new ApiError(500, `解析外部 API 响应失败: ${error.message}`);
  }
}

export const getNcmTrackUrlService = async (
  id: string,
  br: string,
): Promise<NcmTrackUrlData> => {
  const operationName = 'getNcmTrackUrl';
  const apiUrl = new URL(config.externalMusicApiUrl);
  apiUrl.searchParams.append('types', 'url');
  apiUrl.searchParams.append('id', id);
  apiUrl.searchParams.append('br', br);

  const result = (await fetchExternalApi(apiUrl, operationName, {
    id,
    br,
  })) as { url?: string; [key: string]: any };

  if (!result || !result.url) {
    logger.warn(
      { operation: operationName, id, br, apiResult: result },
      '未在外部 API 响应中找到 NCM 歌曲链接',
    );
    throw new ApiError(404, '未在外部 API 响应中找到 NCM 歌曲链接');
  }

  const trackData: NcmTrackUrlData = { id, br, url: result.url };

  if (config.proxyUrl && trackData.url && trackData.url.includes('kuwo.cn')) {
    trackData.proxyUrl = `${config.proxyUrl.replace(/\/$/, '')}/${trackData.url.replace(/^https?:\/\//, '')}`;
    logger.info(
      { operation: operationName, proxyUrl: trackData.proxyUrl },
      '已应用代理',
    );
  }

  return trackData;
};

export const getOtherSourceTrackUrlService = async (
  name: string,
): Promise<OtherSourceTrackData> => {
  const searchOperation = 'searchOtherSourceTrack';
  const searchApiUrl = new URL(config.externalMusicApiUrl);
  searchApiUrl.searchParams.append('types', 'search');
  searchApiUrl.searchParams.append('source', 'kuwo');
  searchApiUrl.searchParams.append('name', name);
  searchApiUrl.searchParams.append('count', '1');
  searchApiUrl.searchParams.append('pages', '1');

  const searchResult = (await fetchExternalApi(searchApiUrl, searchOperation, {
    name,
  })) as any[];

  if (
    !Array.isArray(searchResult) ||
    searchResult.length === 0 ||
    !searchResult[0] ||
    !searchResult[0].url_id
  ) {
    logger.warn(
      { operation: searchOperation, name, apiResult: searchResult },
      '未在搜索结果中找到歌曲 ID',
    );
    throw new ApiError(404, `歌曲 '${name}' 未从指定源找到`);
  }
  const trackSourceId = searchResult[0].url_id as string;
  logger.info(
    { operation: searchOperation, name, foundId: trackSourceId },
    '已找到歌曲源 ID',
  );

  const getUrlOperation = 'getUrlForOtherSourceTrack';
  const idUrlApi = new URL(config.externalMusicApiUrl);
  idUrlApi.searchParams.append('types', 'url');
  idUrlApi.searchParams.append('source', 'kuwo');
  idUrlApi.searchParams.append('id', trackSourceId);
  idUrlApi.searchParams.append('br', '999');

  const urlResult = (await fetchExternalApi(idUrlApi, getUrlOperation, {
    sourceId: trackSourceId,
  })) as { url?: string; [key: string]: any };

  if (!urlResult || !urlResult.url) {
    logger.warn(
      {
        operation: getUrlOperation,
        sourceId: trackSourceId,
        apiResult: urlResult,
      },
      '未在外部 API 响应中找到歌曲链接',
    );
    throw new ApiError(404, '搜索后未从外部 API 获取到歌曲链接');
  }

  const trackData: OtherSourceTrackData = {
    name,
    sourceId: trackSourceId,
    url: urlResult.url,
  };

  if (config.proxyUrl && trackData.url && trackData.url.includes('kuwo.cn')) {
    trackData.proxyUrl = `${config.proxyUrl.replace(/\/$/, '')}/${trackData.url.replace(/^https?:\/\//, '')}`;
    logger.info(
      { operation: getUrlOperation, proxyUrl: trackData.proxyUrl },
      '已应用代理',
    );
  }
  return trackData;
};
