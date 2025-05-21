declare module '@unblockneteasemusic/server' {
  interface MatchOptions {
    id?: string;
    name?: string;
    artist?: string;
    album?: string;
    duration?: number;
    track?: number;
    year?: number;
    source?: string[];
    skip?: string[];
    format?: string;
    limit?: number;
    onlyMatched?: boolean;
    [key: string]: any;
  }

  interface MatchResult {
    id: string;
    name: string;
    artist: string;
    album: string;
    source: string;
    url: string;
    duration?: number;
    track?: number;
    year?: number;
    [key: string]: any;
  }

  function match(options: MatchOptions): Promise<MatchResult[]>;
  export default match;
}
