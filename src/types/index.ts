// 全局 Hono Context 类型增强 (如果需要)
// import { Context } from 'hono';
// declare module 'hono' {
//   interface ContextVariableMap {
//     user?: { id: string; username: string }; // 示例：认证后挂载用户信息
//   }
// }

export interface SongMatchData {
  url: string;
  id?: number | string;
  source?: string;
  br?: number | string;
  size?: number;
  [key: string]: any; // 允许其他字段
  proxyUrl?: string; // 新增的代理URL字段
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

// 你可以根据服务的返回值定义更具体的类型
