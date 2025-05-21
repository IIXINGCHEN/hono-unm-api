/**
 * API密钥相关类型定义
 */

/**
 * API密钥状态
 */
export enum ApiKeyStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

/**
 * API密钥权限级别
 */
export enum ApiKeyPermission {
  READ = 'read',       // 只读权限
  STANDARD = 'standard', // 标准权限（读写）
  ADMIN = 'admin',     // 管理员权限
}

/**
 * API密钥信息
 */
export interface ApiKeyInfo {
  id: string;           // 密钥ID（唯一标识符）
  key: string;          // 密钥值（哈希后存储）
  name: string;         // 密钥名称（用于标识）
  clientId: string;     // 客户端ID
  domain: string;       // 关联的域名
  createdAt: number;    // 创建时间（时间戳）
  expiresAt: number;    // 过期时间（时间戳）
  lastUsedAt?: number;  // 最后使用时间（时间戳）
  status: ApiKeyStatus; // 密钥状态
  permission: ApiKeyPermission; // 权限级别
  metadata?: Record<string, any>; // 元数据（可选）
}

/**
 * API密钥创建请求
 */
export interface ApiKeyCreateRequest {
  name: string;         // 密钥名称
  clientId: string;     // 客户端ID
  domain: string;       // 关联的域名
  expiresIn?: number;   // 过期时间（秒）
  permission?: ApiKeyPermission; // 权限级别
  metadata?: Record<string, any>; // 元数据（可选）
}

/**
 * API密钥创建响应
 */
export interface ApiKeyCreateResponse {
  apiKey: string;       // 原始API密钥（仅在创建时返回一次）
  keyInfo: Omit<ApiKeyInfo, 'key'>; // 密钥信息（不包含哈希后的密钥）
}

/**
 * API密钥验证结果
 */
export interface ApiKeyValidationResult {
  valid: boolean;       // 是否有效
  keyInfo?: Omit<ApiKeyInfo, 'key'>; // 密钥信息（如果有效）
  error?: string;       // 错误信息（如果无效）
}

/**
 * 请求签名信息
 */
export interface RequestSignature {
  timestamp: number;    // 请求时间戳
  nonce: string;        // 随机数（防止重放攻击）
  signature: string;    // 签名
}

/**
 * 认证错误类型
 */
export enum AuthErrorType {
  MISSING_API_KEY = 'missing_api_key',
  INVALID_API_KEY = 'invalid_api_key',
  EXPIRED_API_KEY = 'expired_api_key',
  REVOKED_API_KEY = 'revoked_api_key',
  DOMAIN_NOT_ALLOWED = 'domain_not_allowed',
  INVALID_SIGNATURE = 'invalid_signature',
  EXPIRED_SIGNATURE = 'expired_signature',
  INSUFFICIENT_PERMISSION = 'insufficient_permission',
}

/**
 * 认证错误
 */
export interface AuthError {
  type: AuthErrorType;
  message: string;
  details?: Record<string, any>;
}

// 扩展Hono上下文类型以包含认证信息
declare module 'hono' {
  interface ContextVariableMap {
    requestId?: string;
    apiKey?: Omit<ApiKeyInfo, 'key'>;
    auth?: {
      authenticated: boolean;
      clientId?: string;
      permission?: ApiKeyPermission;
    };
  }
}
