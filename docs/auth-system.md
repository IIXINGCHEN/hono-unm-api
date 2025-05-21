# API 安全鉴权系统使用文档

本文档提供了 Hono UnblockNeteaseMusic API 服务的安全鉴权系统的详细说明和使用指南。

## 目录

- [概述](#概述)
- [配置](#配置)
- [域名白名单验证](#域名白名单验证)
- [API密钥验证](#api密钥验证)
- [请求签名验证](#请求签名验证)
- [数据库存储](#数据库存储)
- [缓存机制](#缓存机制)
- [安全监控和报警](#安全监控和报警)
- [细粒度权限控制](#细粒度权限控制)
- [API端点](#api端点)
- [客户端集成](#客户端集成)
- [安全最佳实践](#安全最佳实践)
- [故障排除](#故障排除)

## 概述

安全鉴权系统提供以下主要功能：

1. **域名白名单验证**：限制只有特定域名可以通过CORS访问API
2. **API密钥验证**：基于密钥的API访问控制
3. **请求签名验证**：防止请求篡改
4. **速率限制**：防止暴力攻击
5. **数据库存储**：支持多种存储后端，提高可扩展性
6. **缓存机制**：提高性能和响应速度
7. **安全监控和报警**：实时监控和报警系统
8. **细粒度权限控制**：基于资源和操作的权限控制

## 配置

安全鉴权系统的配置在 `.env` 文件中设置：

```bash
# API密钥配置
# 是否启用API密钥验证
API_KEY_ENABLED=true
# 需要API密钥的路径 (多个用逗号分隔)
# 支持通配符，例如 /api/v1/music/* 表示所有音乐相关的API
API_KEY_REQUIRED_PATHS=/api/v1/music/*
# 是否要求请求签名
API_KEY_SIGNATURE_REQUIRED=false
# 请求签名有效期 (毫秒) - 默认5分钟
API_KEY_SIGNATURE_EXPIRY_MS=300000

# CORS 配置 (多个用逗号分隔)
# 安全提示: 不要使用 "*"，应明确指定允许的源
# 例如: ALLOWED_ORIGINS=https://yourfrontend.com,https://anotherfrontend.com
ALLOWED_ORIGINS=

# 用于加密敏感数据的密钥 (32字节)
# 生产环境中必须设置为强随机值
# 可以使用以下命令生成: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=change-this-in-production-32-characters

# 存储配置
# 存储类型: file, sqlite, memory
STORAGE_TYPE=file
# 存储路径 (对于file和sqlite类型)
STORAGE_PATH=./data

# 缓存配置
# 缓存类型: memory, redis, none
CACHE_TYPE=memory
# 缓存生存时间 (秒)
CACHE_TTL=300

# 监控配置
# 是否启用安全监控
MONITOR_ENABLED=true
# 是否启用报警
ALERT_ENABLED=false
# Webhook报警URL (可选)
# ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# 权限配置
# 是否启用细粒度权限控制
PERMISSION_ENABLED=true
# 默认角色
DEFAULT_ROLE=read
```

## 域名白名单验证

域名白名单验证通过 `ALLOWED_ORIGINS` 环境变量配置，用于限制哪些域名可以通过CORS访问API。

### 配置示例

```bash
# 允许多个域名，用逗号分隔
ALLOWED_ORIGINS=https://example.com,https://app.example.com

# 允许所有子域名
ALLOWED_ORIGINS=*.example.com

# 允许特定子域名和其他域名
ALLOWED_ORIGINS=*.example.com,https://trusted-partner.com
```

### 工作原理

1. 当请求到达API服务器时，系统会检查请求的 `Origin` 或 `Referer` 头
2. 如果请求的域名不在白名单中，系统会返回 403 错误
3. 所有验证失败的尝试都会被记录下来，包括IP地址和时间戳

## API密钥验证

API密钥验证通过 `API_KEY_ENABLED` 和 `API_KEY_REQUIRED_PATHS` 环境变量配置，用于控制哪些路径需要API密钥验证。

### API密钥格式

API密钥的格式为：`{keyId}.{keyValue}`，例如：`a1b2c3d4e5f6.g7h8i9j0k1l2m3n4o5p6q7r8s9t0`

- `keyId`：API密钥的唯一标识符
- `keyValue`：API密钥的值（随机生成的字符串）

### 使用API密钥

在请求中使用API密钥有两种方式：

1. 在请求头中添加 `X-API-Key` 头：

```
X-API-Key: a1b2c3d4e5f6.g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

2. 在查询参数中添加 `api_key` 参数：

```
https://api.example.com/api/v1/music/match?id=123456&api_key=a1b2c3d4e5f6.g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

### API密钥权限级别

API密钥有三种权限级别：

1. `read`：只读权限，只能访问GET请求
2. `standard`：标准权限，可以访问GET、POST、PUT请求
3. `admin`：管理员权限，可以访问所有请求，包括API密钥管理

## 请求签名验证

请求签名验证通过 `API_KEY_SIGNATURE_REQUIRED` 环境变量配置，用于防止请求篡改。

### 签名生成

签名生成的步骤如下：

1. 准备签名字符串：`{keyId}:{method}:{path}:{timestamp}:{nonce}:{body}`
   - `keyId`：API密钥的唯一标识符
   - `method`：请求方法（GET、POST、PUT、DELETE等）
   - `path`：请求路径（例如 `/api/v1/music/match`）
   - `timestamp`：当前时间戳（毫秒）
   - `nonce`：随机字符串（防止重放攻击）
   - `body`：请求体（如果有）

2. 使用HMAC-SHA256算法和加密密钥对签名字符串进行签名

### 在请求中使用签名

在请求中使用签名需要添加以下请求头：

```
X-API-Key: a1b2c3d4e5f6.g7h8i9j0k1l2m3n4o5p6q7r8s9t0
X-Timestamp: 1621234567890
X-Nonce: abcdef123456
X-Signature: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

## 数据库存储

系统支持多种存储后端，用于存储API密钥、安全事件和权限信息。

### 支持的存储类型

- **文件存储 (file)**：使用JSON文件存储数据，适合小型部署
- **SQLite存储 (sqlite)**：使用SQLite数据库存储数据，适合中型部署
- **内存存储 (memory)**：使用内存存储数据，适合开发和测试环境

### 配置存储

存储配置通过 `STORAGE_TYPE` 和 `STORAGE_PATH` 环境变量设置：

```bash
# 存储类型: file, sqlite, memory
STORAGE_TYPE=file
# 存储路径 (对于file和sqlite类型)
STORAGE_PATH=./data
```

### 存储目录结构

```
data/
  ├── api-keys/
  │   └── api-keys.json
  ├── security/
  │   └── events.json
  └── permissions/
      └── roles.json
```

## 缓存机制

系统使用缓存来提高性能和响应速度，减少数据库访问。

### 支持的缓存类型

- **内存缓存 (memory)**：使用Node.js内置的内存缓存，适合单实例部署
- **Redis缓存 (redis)**：使用Redis作为缓存，适合多实例部署
- **无缓存 (none)**：禁用缓存，适合开发和测试环境

### 配置缓存

缓存配置通过 `CACHE_TYPE` 和 `CACHE_TTL` 环境变量设置：

```bash
# 缓存类型: memory, redis, none
CACHE_TYPE=memory
# 缓存生存时间 (秒)
CACHE_TTL=300
```

### 缓存命名空间

系统使用不同的命名空间来隔离不同类型的缓存数据：

- **api-keys**：API密钥相关的缓存
- **security**：安全事件相关的缓存
- **permission**：权限相关的缓存

## 安全监控和报警

系统提供实时安全监控和报警功能，帮助管理员及时发现和响应安全威胁。

### 安全事件类型

- **速率限制 (rate_limit)**：请求速率超过限制
- **无效输入 (invalid_input)**：请求包含无效的输入
- **未授权 (unauthorized)**：未经授权的访问尝试
- **可疑活动 (suspicious)**：可疑的访问模式
- **API密钥相关 (api_key_created, api_key_revoked, api_key_expired, api_key_refreshed)**：API密钥生命周期事件

### 报警通道

- **控制台 (console)**：将报警输出到控制台
- **Webhook (webhook)**：将报警发送到指定的Webhook URL
- **电子邮件 (email)**：将报警发送到指定的电子邮件地址（可选）

### 配置报警

报警配置通过 `MONITOR_ENABLED`、`ALERT_ENABLED` 和 `ALERT_WEBHOOK_URL` 环境变量设置：

```bash
# 是否启用安全监控
MONITOR_ENABLED=true
# 是否启用报警
ALERT_ENABLED=false
# Webhook报警URL (可选)
# ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
```

### 安全事件API

系统提供API端点来查询和管理安全事件：

```
GET /api/v1/monitor/security/events
GET /api/v1/monitor/security/stats
GET /api/v1/monitor/security/recent
GET /api/v1/monitor/security/ip/{ip}
GET /api/v1/monitor/security/type/{type}
GET /api/v1/monitor/security/severity/{severity}
```

## 细粒度权限控制

系统提供基于资源和操作的细粒度权限控制，允许更精确地控制API访问。

### 资源类型

- **API密钥 (api_key)**：API密钥相关的资源
- **音乐 (music)**：音乐相关的资源
- **用户 (user)**：用户相关的资源
- **系统 (system)**：系统相关的资源
- **监控 (monitor)**：监控相关的资源

### 操作类型

- **读取 (read)**：读取资源
- **创建 (create)**：创建资源
- **更新 (update)**：更新资源
- **删除 (delete)**：删除资源
- **执行 (execute)**：执行操作

### 角色

系统预定义了以下角色：

- **管理员 (admin)**：具有所有权限
- **标准用户 (standard)**：具有标准权限
- **只读用户 (read)**：只具有读取权限

### 配置权限

权限配置通过 `PERMISSION_ENABLED` 和 `DEFAULT_ROLE` 环境变量设置：

```bash
# 是否启用细粒度权限控制
PERMISSION_ENABLED=true
# 默认角色
DEFAULT_ROLE=read
```

### 权限API

系统提供API端点来管理角色和权限：

```
GET /api/v1/permission/roles
GET /api/v1/permission/roles/{id}
POST /api/v1/permission/roles
PUT /api/v1/permission/roles/{id}
DELETE /api/v1/permission/roles/{id}
POST /api/v1/permission/roles/{id}/permissions/{permissionId}
DELETE /api/v1/permission/roles/{id}/permissions/{permissionId}
POST /api/v1/permission/check
```

## API端点

安全鉴权系统提供以下API端点：

### 创建API密钥

```
POST /api/v1/auth/keys
```

请求体：

```json
{
  "name": "Frontend App",
  "clientId": "frontend-app",
  "domain": "example.com",
  "expiresIn": 2592000,
  "permission": "standard"
}
```

响应：

```json
{
  "success": true,
  "message": "API密钥创建成功",
  "data": {
    "apiKey": "a1b2c3d4e5f6.g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    "keyInfo": {
      "id": "a1b2c3d4e5f6",
      "name": "Frontend App",
      "clientId": "frontend-app",
      "domain": "example.com",
      "createdAt": 1621234567890,
      "expiresAt": 1623826567890,
      "status": "active",
      "permission": "standard"
    }
  }
}
```

### 刷新API密钥

```
POST /api/v1/auth/keys/refresh
```

请求体：

```json
{
  "keyId": "a1b2c3d4e5f6",
  "expiresIn": 2592000
}
```

### 撤销API密钥

```
POST /api/v1/auth/keys/revoke
```

请求体：

```json
{
  "keyId": "a1b2c3d4e5f6"
}
```

### 获取API密钥信息

```
GET /api/v1/auth/keys/{keyId}
```

### 获取客户端的所有API密钥

```
GET /api/v1/auth/keys/client/{clientId}
```

### 验证API密钥

```
GET /api/v1/auth/keys/verify
```

### 生成请求签名示例

```
POST /api/v1/auth/signature/generate
```

请求体：

```json
{
  "method": "GET",
  "path": "/api/v1/music/match",
  "body": {
    "id": "123456"
  }
}
```

## 客户端集成

### JavaScript客户端示例

```javascript
class ApiClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey
    };

    const options = {
      method,
      headers,
      credentials: 'include'
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '请求失败');
    }

    return response.json();
  }

  async get(path) {
    return this.request('GET', path);
  }

  async post(path, body) {
    return this.request('POST', path, body);
  }

  async put(path, body) {
    return this.request('PUT', path, body);
  }

  async delete(path) {
    return this.request('DELETE', path);
  }
}

// 使用示例
const apiClient = new ApiClient('https://api.example.com', 'a1b2c3d4e5f6.g7h8i9j0k1l2m3n4o5p6q7r8s9t0');
const result = await apiClient.get('/api/v1/music/match?id=123456');
```

## 安全最佳实践

### API密钥管理
1. **不要在客户端代码中硬编码API密钥**：使用环境变量或安全的密钥管理系统
2. **定期轮换API密钥**：使用刷新API密钥的端点定期更新密钥
3. **使用HTTPS**：确保所有API请求都通过HTTPS进行
4. **限制API密钥的权限**：根据需要分配最小权限
5. **监控API使用情况**：定期检查API使用日志，发现异常情况

### 存储和缓存
6. **在生产环境中使用数据库存储**：对于生产环境，建议使用SQLite或其他数据库存储，而不是文件存储
7. **配置适当的缓存TTL**：根据数据的敏感性和更新频率，配置适当的缓存生存时间
8. **使用Redis缓存**：对于多实例部署，建议使用Redis缓存，确保缓存数据的一致性

### 监控和报警
9. **启用安全监控**：在生产环境中启用安全监控，及时发现安全威胁
10. **配置报警通道**：配置适当的报警通道，确保安全事件能够及时通知到相关人员
11. **定期审查安全事件**：定期审查安全事件，分析安全威胁模式，调整安全策略

### 权限控制
12. **使用细粒度权限控制**：根据实际需求，配置细粒度的权限控制，限制API访问
13. **遵循最小权限原则**：为每个角色分配最小必要的权限
14. **定期审查角色和权限**：定期审查角色和权限配置，确保符合安全要求

## 故障排除

### 常见错误

1. **401 Unauthorized**：API密钥缺失或无效
2. **403 Forbidden**：API密钥权限不足或域名不在白名单中
3. **429 Too Many Requests**：请求速率超过限制
4. **500 Internal Server Error**：服务器内部错误

### 解决方案

1. **API密钥验证失败**：检查API密钥是否正确，是否已过期或被撤销
2. **域名验证失败**：检查域名是否在白名单中，是否正确配置了CORS
3. **请求签名验证失败**：检查签名生成是否正确，时间戳是否在有效期内
4. **存储相关错误**：
   - 检查存储路径是否存在且可写
   - 检查存储类型是否正确配置
   - 检查加密密钥是否正确设置
5. **缓存相关错误**：
   - 检查缓存类型是否正确配置
   - 如果使用Redis缓存，检查Redis服务是否可用
   - 尝试禁用缓存（设置`CACHE_TYPE=none`）进行故障排除
6. **监控和报警相关错误**：
   - 检查监控配置是否正确
   - 如果使用Webhook报警，检查Webhook URL是否可访问
   - 检查日志目录是否存在且可写
7. **权限相关错误**：
   - 检查角色和权限配置是否正确
   - 检查默认角色是否存在
   - 尝试禁用细粒度权限控制（设置`PERMISSION_ENABLED=false`）进行故障排除

### 日志和调试

系统提供详细的日志记录，可以帮助排除故障：

1. **查看应用日志**：检查应用日志中的错误和警告信息
2. **启用调试日志**：设置`LOG_LEVEL=debug`以获取更详细的日志
3. **查看安全事件**：使用安全事件API查看安全相关的事件和错误

### 联系支持

如果您无法解决问题，请联系支持团队，并提供以下信息：

1. 错误消息和堆栈跟踪
2. 应用配置（不包含敏感信息）
3. 复现步骤
4. 系统环境信息（Node.js版本、操作系统等）
