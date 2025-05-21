# Hono UnblockNeteaseMusic API

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.7-brightgreen.svg)](https://hono.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js->=18.x-green.svg)](https://nodejs.org/)

基于 Hono 框架构建的网易云解灰 API 服务，使用 TypeScript 编写，旨在提供一个生产级的代码模板。本项目可以帮助用户解锁网易云音乐中的灰色（不可播放）歌曲，通过替代音源提供播放链接。

## 📋 目录

- [特性](#特性)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
  - [安装依赖](#安装依赖)
  - [配置](#配置)
  - [运行服务](#运行服务)
- [API 端点](#api-端点)
- [开发指南](#开发指南)
- [贡献](#贡献)
- [许可证](#许可证)

## ✨ 特性

- **Hono 框架**: 轻量、快速，支持多 JavaScript 运行时
- **TypeScript**: 强类型保证代码质量
- **分层架构**: 清晰的代码组织 (路由, 服务, 配置, 工具)
- **生产实践**:
  - 环境变量管理 (`.env`)
  - 结构化日志 (Pino)
  - 统一错误处理和 API 响应格式
  - 输入验证 (Zod)
  - CORS 配置
  - 安全头
- **代码规范**: ESLint 和 Prettier 保证代码一致性

## 🗂️ 项目结构

```
hono-unm-api/
├── public/                 # 静态资源
│   ├── css/                # 样式文件
│   ├── js/                 # JavaScript 文件
│   ├── 404.html            # 404 页面
│   └── index.html          # 首页
├── src/                    # 源代码
│   ├── api/                # API 相关代码
│   │   ├── routes/         # 路由定义
│   │   └── validators/     # 请求验证器
│   ├── config/             # 配置文件
│   ├── services/           # 业务逻辑服务
│   ├── types/              # TypeScript 类型定义
│   ├── utils/              # 工具函数
│   └── app.ts              # 应用主文件
├── .env.example            # 环境变量示例
├── .eslintrc.js            # ESLint 配置
├── eslint.config.mjs       # ESLint 新配置
├── package.json            # 项目依赖和脚本
├── server.ts               # 服务器入口文件
├── tsconfig.json           # TypeScript 配置
└── README.md               # 项目文档
```

## 🚀 快速开始

### 安装依赖

推荐使用 pnpm 作为包管理器：

```bash
# 安装 pnpm (如果尚未安装)
npm install -g pnpm

# 安装项目依赖
pnpm install
```

也支持其他包管理器：

```bash
# 使用 npm
npm install

# 使用 yarn
yarn install

# 使用 bun
bun install
```

### 配置

1. 复制环境变量示例文件：

```bash
cp .env.example .env
```

2. 根据需求修改 `.env` 文件中的配置项：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| NODE_ENV | 运行环境 | production |
| PORT | 服务端口 | 5678 |
| HOST | 服务主机 | 0.0.0.0 |
| LOG_LEVEL | 日志级别 | info |
| ALLOWED_ORIGINS | CORS 允许的源 (逗号分隔) | (空) |
| PROXY_URL | API 代理 (可选) | (空) |
| EXTERNAL_MUSIC_API_URL | 外部音乐 API | https://music-api.gdstudio.xyz/api.php |
| ENABLE_FLAC | 是否启用 FLAC 格式 | true |
| APP_VERSION | 应用版本 | (从 package.json 读取) |
| APP_NAME | 服务名称 | hono-unm-api-prod |

### 运行服务

#### 开发模式

```bash
# 使用 pnpm
pnpm dev

# 或使用其他包管理器
npm run dev
yarn dev
bun dev
```

如果需要使用 ts-node-dev 进行热重载，可以修改 `package.json` 中的 `dev` 脚本：

```json
"dev": "ts-node-dev --respawn --transpile-only src/server.ts"
```

#### 构建生产代码

```bash
pnpm build
```

这将使用 TypeScript 编译器 (tsc) 将源代码编译到 `dist` 目录。

#### 启动生产服务

```bash
pnpm start
```

这将运行编译后的 `dist/server.js` 文件。

## 📡 API 端点

所有 API 默认以 `/api/v1` 为前缀。

| 端点 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/v1/health/healthz` | GET | 无 | 服务健康检查 |
| `/api/v1/info/info` | GET | 无 | 获取服务信息 |
| `/api/v1/music/test` | GET | 无 | 测试歌曲匹配功能 |
| `/api/v1/music/match` | GET | `id`: 歌曲ID<br>`server`: 服务器列表(可选) | 匹配歌曲 |
| `/api/v1/music/ncmget` | GET | `id`: 歌曲ID<br>`br`: 比特率(可选) | 获取网易云歌曲链接 |
| `/api/v1/music/otherget` | GET | `name`: 歌曲名称 | 从其他源搜索歌曲 |

## 💻 开发指南

### 代码规范

项目使用 ESLint 和 Prettier 来保证代码质量和一致性：

```bash
# 运行代码检查
pnpm lint

# 格式化代码
pnpm format
```

### 注意事项

- 实际投入生产前，请务必进行充分的测试、安全审计和性能优化。
- 敏感配置（如 JWT 密钥、数据库密码等）不应硬编码或提交到版本控制，应使用环境变量管理。
- 项目默认支持 Node.js 18.x 及以上版本。

## 🤝 贡献

欢迎贡献代码、报告问题或提出改进建议！请遵循以下步骤：

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。