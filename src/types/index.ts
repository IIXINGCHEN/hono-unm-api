export interface SongMatchData {
  url: string;
  id?: number | string;
  source?: string;
  br?: number | string;
  size?: number;
  [key: string]: any;
  proxyUrl?: string;
}

export interface NcmTrackUrlData {
  id: string;
  br: string;
  url: string;
  proxyUrl?: string;
}

export interface OtherSourceTrackData {
  name: string;
  sourceId?: string;
  url: string;
  proxyUrl?: string;
}

// Hono 上下文环境变量扩展 (如果通过中间件设置了自定义变量)
// declare module 'hono' {
//   interface ContextVariableMap {
//     requestId?: string;
//     user?: { id: string; role: string };
//   }
// }
