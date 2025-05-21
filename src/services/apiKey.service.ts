import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import {
  ApiKeyInfo,
  ApiKeyStatus,
  ApiKeyPermission,
  ApiKeyCreateRequest,
  ApiKeyCreateResponse,
  ApiKeyValidationResult,
  RequestSignature,
  AuthErrorType,
} from '../types/auth.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { encrypt, decrypt, hash, safeCompare, generateToken } from '../utils/crypto.js';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API密钥存储路径
const API_KEYS_DIR = path.resolve(__dirname, '../../../data/api-keys');
const API_KEYS_FILE = path.join(API_KEYS_DIR, 'api-keys.json');

// 确保API密钥目录存在
if (!fs.existsSync(API_KEYS_DIR)) {
  fs.mkdirSync(API_KEYS_DIR, { recursive: true });
}

// 默认密钥过期时间（30天）
const DEFAULT_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

// 签名有效期（5分钟）
const SIGNATURE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * API密钥服务类
 */
class ApiKeyService {
  private apiKeys: Map<string, ApiKeyInfo> = new Map();
  private initialized = false;

  /**
   * 初始化API密钥服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 检查是否在测试环境中
      const isTestEnv = process.env.ENV_FILE === '.env.production.test';

      if (isTestEnv) {
        // 测试环境：创建一个默认的API密钥
        logger.info('测试环境：API密钥服务使用内存存储，创建默认API密钥');
        this.apiKeys.clear();

        // 创建默认API密钥
        const apiKeyId = 'test-api-key-id';
        const apiKeyRaw = 'test-api-key-value';
        const hashedKey = hash(apiKeyRaw);

        // 创建API密钥信息
        const now = Date.now();
        const expiresIn = 365 * 24 * 60 * 60; // 1年

        const apiKeyInfo: ApiKeyInfo = {
          id: apiKeyId,
          key: hashedKey,
          name: 'Test API Key',
          clientId: 'test-client',
          domain: '*',
          createdAt: now,
          expiresAt: now + expiresIn * 1000,
          status: ApiKeyStatus.ACTIVE,
          permission: ApiKeyPermission.ADMIN,
          metadata: {
            createdBy: 'test-environment',
            environment: 'test'
          },
        };

        // 存储API密钥
        this.apiKeys.set(apiKeyId, apiKeyInfo);

        logger.info(`测试环境：已创建默认API密钥，ID: ${apiKeyId}`);
        logger.info(`测试环境：API密钥: ${apiKeyId}.${apiKeyRaw}`);
        logger.info('测试环境：请在请求中使用以下头部:');
        logger.info(`测试环境：X-API-Key: ${apiKeyId}.${apiKeyRaw}`);

        this.initialized = true;
        return;
      }

      // 如果API密钥文件存在，则加载
      if (fs.existsSync(API_KEYS_FILE)) {
        try {
          const encryptedData = fs.readFileSync(API_KEYS_FILE, 'utf8');
          if (encryptedData) {
            const decryptedData = decrypt(encryptedData);
            const apiKeysArray: ApiKeyInfo[] = JSON.parse(decryptedData);

            // 将API密钥加载到内存中
            for (const apiKey of apiKeysArray) {
              this.apiKeys.set(apiKey.id, apiKey);
            }

            logger.info(`已加载 ${this.apiKeys.size} 个API密钥`);
          }
        } catch (decryptError) {
          // 如果解密失败，记录错误但不中断初始化过程
          logger.error({ err: decryptError }, '解密API密钥文件失败，将使用空的API密钥列表');
          // 清空API密钥列表
          this.apiKeys.clear();
        }
      } else {
        // 创建空的API密钥文件
        try {
          this.saveApiKeys();
          logger.info('已创建新的API密钥存储文件');
        } catch (saveError) {
          // 如果保存失败，记录错误但不中断初始化过程
          logger.error({ err: saveError }, '创建API密钥存储文件失败，将使用内存存储');
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error({ err: error }, '初始化API密钥服务失败');
      // 不抛出错误，而是将服务标记为已初始化，以便继续运行
      this.initialized = true;
    }
  }

  /**
   * 保存API密钥到文件
   * @returns 是否成功
   */
  private saveApiKeys(): boolean {
    try {
      // 确保目录存在
      const dir = path.dirname(API_KEYS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const apiKeysArray = Array.from(this.apiKeys.values());
      const jsonData = JSON.stringify(apiKeysArray, null, 2);
      const encryptedData = encrypt(jsonData);
      fs.writeFileSync(API_KEYS_FILE, encryptedData);
      return true;
    } catch (error) {
      logger.error({ err: error }, '保存API密钥失败');
      return false;
    }
  }

  /**
   * 生成新的API密钥
   * @param request API密钥创建请求
   * @returns API密钥创建响应
   */
  async createApiKey(request: ApiKeyCreateRequest): Promise<ApiKeyCreateResponse> {
    await this.initialize();

    // 生成API密钥
    const apiKeyRaw = generateToken(32);
    const apiKeyId = generateToken(16);
    const hashedKey = hash(apiKeyRaw);

    // 创建API密钥信息
    const now = Date.now();
    const expiresIn = request.expiresIn || DEFAULT_EXPIRY_SECONDS;

    const apiKeyInfo: ApiKeyInfo = {
      id: apiKeyId,
      key: hashedKey,
      name: request.name,
      clientId: request.clientId,
      domain: request.domain,
      createdAt: now,
      expiresAt: now + expiresIn * 1000,
      status: ApiKeyStatus.ACTIVE,
      permission: request.permission || ApiKeyPermission.STANDARD,
      metadata: request.metadata,
    };

    // 存储API密钥
    this.apiKeys.set(apiKeyId, apiKeyInfo);
    // 尝试保存API密钥，但不中断流程
    this.saveApiKeys();

    // 返回API密钥（不包含哈希后的密钥）
    const { key, ...keyInfoWithoutKey } = apiKeyInfo;

    logger.info({
      operation: 'createApiKey',
      keyId: apiKeyId,
      clientId: request.clientId,
      domain: request.domain,
    }, '已创建新的API密钥');

    return {
      apiKey: `${apiKeyId}.${apiKeyRaw}`,
      keyInfo: keyInfoWithoutKey,
    };
  }

  /**
   * 验证API密钥
   * @param apiKey API密钥
   * @param domain 请求域名
   * @returns 验证结果
   */
  async validateApiKey(apiKey: string, domain?: string): Promise<ApiKeyValidationResult> {
    await this.initialize();

    // 解析API密钥
    const parts = apiKey.split('.');
    if (parts.length !== 2) {
      return {
        valid: false,
        error: AuthErrorType.INVALID_API_KEY,
      };
    }

    const [keyId, keyValue] = parts;

    // 查找API密钥
    const keyInfo = this.apiKeys.get(keyId);
    if (!keyInfo) {
      return {
        valid: false,
        error: AuthErrorType.INVALID_API_KEY,
      };
    }

    // 验证API密钥哈希
    const hashedKey = hash(keyValue);
    if (!safeCompare(hashedKey, keyInfo.key)) {
      return {
        valid: false,
        error: AuthErrorType.INVALID_API_KEY,
      };
    }

    // 检查API密钥状态
    if (keyInfo.status === ApiKeyStatus.REVOKED) {
      return {
        valid: false,
        error: AuthErrorType.REVOKED_API_KEY,
      };
    }

    // 检查API密钥是否过期
    if (keyInfo.expiresAt < Date.now()) {
      // 更新密钥状态为过期
      keyInfo.status = ApiKeyStatus.EXPIRED;
      this.apiKeys.set(keyId, keyInfo);
      // 尝试保存API密钥，但不中断流程
      this.saveApiKeys();

      return {
        valid: false,
        error: AuthErrorType.EXPIRED_API_KEY,
      };
    }

    // 如果提供了域名，则验证域名
    if (domain && keyInfo.domain !== '*') {
      // 支持通配符子域名，例如 *.example.com
      const isWildcardDomain = keyInfo.domain.startsWith('*.');
      const domainWithoutWildcard = isWildcardDomain ? keyInfo.domain.substring(2) : null;

      const domainMatches =
        keyInfo.domain === domain ||
        (isWildcardDomain && domain.endsWith(domainWithoutWildcard!));

      if (!domainMatches) {
        return {
          valid: false,
          error: AuthErrorType.DOMAIN_NOT_ALLOWED,
        };
      }
    }

    // 更新最后使用时间
    keyInfo.lastUsedAt = Date.now();
    this.apiKeys.set(keyId, keyInfo);
    // 尝试保存API密钥，但不中断流程
    this.saveApiKeys();

    // 返回验证结果
    const { key, ...keyInfoWithoutKey } = keyInfo;
    return {
      valid: true,
      keyInfo: keyInfoWithoutKey,
    };
  }

  /**
   * 撤销API密钥
   * @param keyId API密钥ID
   * @returns 是否成功
   */
  async revokeApiKey(keyId: string): Promise<boolean> {
    await this.initialize();

    const keyInfo = this.apiKeys.get(keyId);
    if (!keyInfo) {
      return false;
    }

    keyInfo.status = ApiKeyStatus.REVOKED;
    this.apiKeys.set(keyId, keyInfo);
    // 尝试保存API密钥，但不中断流程
    this.saveApiKeys();

    logger.info({
      operation: 'revokeApiKey',
      keyId,
      clientId: keyInfo.clientId,
    }, '已撤销API密钥');

    return true;
  }

  /**
   * 刷新API密钥
   * @param keyId API密钥ID
   * @param expiresIn 新的过期时间（秒）
   * @returns 新的API密钥
   */
  async refreshApiKey(keyId: string, expiresIn?: number): Promise<ApiKeyCreateResponse | null> {
    await this.initialize();

    const keyInfo = this.apiKeys.get(keyId);
    if (!keyInfo || keyInfo.status !== ApiKeyStatus.ACTIVE) {
      return null;
    }

    // 撤销旧的API密钥
    await this.revokeApiKey(keyId);

    // 创建新的API密钥
    return this.createApiKey({
      name: keyInfo.name,
      clientId: keyInfo.clientId,
      domain: keyInfo.domain,
      expiresIn: expiresIn || DEFAULT_EXPIRY_SECONDS,
      permission: keyInfo.permission,
      metadata: keyInfo.metadata,
    });
  }

  /**
   * 获取API密钥信息
   * @param keyId API密钥ID
   * @returns API密钥信息
   */
  async getApiKeyInfo(keyId: string): Promise<Omit<ApiKeyInfo, 'key'> | null> {
    await this.initialize();

    const keyInfo = this.apiKeys.get(keyId);
    if (!keyInfo) {
      return null;
    }

    const { key, ...keyInfoWithoutKey } = keyInfo;
    return keyInfoWithoutKey;
  }

  /**
   * 获取客户端的所有API密钥
   * @param clientId 客户端ID
   * @returns API密钥信息列表
   */
  async getClientApiKeys(clientId: string): Promise<Omit<ApiKeyInfo, 'key'>[]> {
    await this.initialize();

    const clientKeys: Omit<ApiKeyInfo, 'key'>[] = [];

    for (const keyInfo of this.apiKeys.values()) {
      if (keyInfo.clientId === clientId) {
        const { key, ...keyInfoWithoutKey } = keyInfo;
        clientKeys.push(keyInfoWithoutKey);
      }
    }

    return clientKeys;
  }

  /**
   * 生成请求签名
   * @param apiKeyId API密钥ID
   * @param method 请求方法
   * @param path 请求路径
   * @param body 请求体
   * @returns 签名信息
   */
  generateSignature(apiKeyId: string, method: string, path: string, body?: any): RequestSignature {
    const timestamp = Date.now();
    const nonce = generateToken(8);

    // 创建签名字符串
    const payload = `${apiKeyId}:${method}:${path}:${timestamp}:${nonce}`;
    const bodyString = body ? `:${typeof body === 'string' ? body : JSON.stringify(body)}` : '';
    const signatureString = payload + bodyString;

    // 使用密钥签名
    const signature = crypto.createHmac('sha256', config.encryptionKey || 'default-key')
      .update(signatureString)
      .digest('hex');

    return {
      timestamp,
      nonce,
      signature,
    };
  }

  /**
   * 验证请求签名
   * @param apiKeyId API密钥ID
   * @param method 请求方法
   * @param path 请求路径
   * @param signature 签名信息
   * @param body 请求体
   * @returns 是否有效
   */
  verifySignature(
    apiKeyId: string,
    method: string,
    path: string,
    signature: RequestSignature,
    body?: any
  ): boolean {
    // 检查签名是否过期
    if (Date.now() - signature.timestamp > SIGNATURE_EXPIRY_MS) {
      return false;
    }

    // 创建签名字符串
    const payload = `${apiKeyId}:${method}:${path}:${signature.timestamp}:${signature.nonce}`;
    const bodyString = body ? `:${typeof body === 'string' ? body : JSON.stringify(body)}` : '';
    const signatureString = payload + bodyString;

    // 使用密钥验证签名
    const expectedSignature = crypto.createHmac('sha256', config.encryptionKey || 'default-key')
      .update(signatureString)
      .digest('hex');

    return safeCompare(expectedSignature, signature.signature);
  }
}

// 导出单例实例
export const apiKeyService = new ApiKeyService();
