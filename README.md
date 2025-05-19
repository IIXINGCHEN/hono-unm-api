这是一个基于 Hono 框架构建的网易云解灰 API 服务，使用 TypeScript 编写，旨在提供一个生产级的代码模板。

## 特性

-   **Hono 框架**: 轻量、快速，支持多 JavaScript 运行时。
-   **TypeScript**: 强类型保证代码质量。
-   **分层架构**: 清晰的代码组织 (路由, 服务, 配置, 工具)。
-   **生产实践**:
    -   环境变量管理 (`.env`)
    -   结构化日志 (Pino)
    -   统一错误处理和 API 响应格式
    -   输入验证 (Zod)
    -   CORS 配置
    -   安全头
-   **代码规范**: ESLint 和 Prettier 保证代码一致性。

## 项目结构

(此处可以粘贴项目结构树)

## 安装依赖

```bash
npm install
# 或者
yarn install
# 或者
pnpm install
# 或者
bun install

配置
 * 复制 .env.example 文件为 .env:
   cp .env.example .env

 * 根据您的需求修改 .env 文件中的配置项。
运行服务
开发模式 (推荐使用 Bun 以获得最佳热重载体验)
npm run dev
# 或者 (如果已安装 Bun)
bun dev

如果未使用 Bun，请修改 package.json 中的 dev 脚本，例如使用 ts-node-dev 或 nodemon：
"dev": "ts-node-dev --respawn --transpile-only src/server.ts"
构建生产代码
npm run build

这将使用 TypeScript 编译器 (tsc) 将 src 目录下的代码编译到 dist 目录。
启动生产服务
npm start

这将运行 dist/server.js。
API 端点 (示例)
所有 API 默认以 /api/v1 为前缀。
 * GET /api/v1/health/healthz: 服务健康检查。
 * GET /api/v1/info/info: 获取服务信息。
 * GET /api/v1/music/test: 测试歌曲匹配功能。
 * GET /api/v1/music/match?id=<songId>&server=<servers>: 匹配歌曲。
 * GET /api/v1/music/ncmget?id=<songId>&br=<bitrate>: 获取网易云歌曲链接。
 * GET /api/v1/music/otherget?name=<songName>: 从其他源搜索歌曲。
代码规范
 * ESLint: 用于代码质量检查。运行 npm run lint。
 * Prettier: 用于代码格式化。运行 npm run format。
注意事项
 * 这是一个模板项目，实际投入生产前，请务必进行充分的测试、安全审计和性能优化。
 * 敏感配置（如 JWT 密钥、数据库密码等）不应硬编码或提交到版本控制，应使用环境变量管理。
<!-- end list -->
