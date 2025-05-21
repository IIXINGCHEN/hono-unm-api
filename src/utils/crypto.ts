import crypto from 'crypto';

// 默认加密密钥，应该通过环境变量设置
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-please-change-in-production';
// 初始化向量长度
const IV_LENGTH = 16;

/**
 * 加密文本数据
 * @param text 要加密的文本
 * @returns 加密后的文本（格式：iv:加密数据）
 */
export function encrypt(text: string): string {
  // 生成随机初始化向量
  const iv = crypto.randomBytes(IV_LENGTH);
  // 创建加密器
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), // 确保密钥长度为32字节
    iv
  );
  
  // 加密数据
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  // 返回格式：iv:加密数据（都是十六进制字符串）
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * 解密文本数据
 * @param text 加密的文本（格式：iv:加密数据）
 * @returns 解密后的原始文本
 */
export function decrypt(text: string): string {
  try {
    // 分离初始化向量和加密数据
    const textParts = text.split(':');
    if (textParts.length !== 2) {
      throw new Error('加密文本格式无效');
    }
    
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    
    // 创建解密器
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), // 确保密钥长度为32字节
      iv
    );
    
    // 解密数据
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    // 返回解密后的文本
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('解密失败:', error);
    throw new Error('解密失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * 生成安全的随机令牌
 * @param length 令牌长度（字节数）
 * @returns 十六进制格式的随机令牌
 */
export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 计算字符串的哈希值
 * @param data 要哈希的数据
 * @param algorithm 哈希算法，默认为SHA-256
 * @returns 哈希值（十六进制字符串）
 */
export function hash(data: string, algorithm = 'sha256'): string {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

/**
 * 安全比较两个字符串（防止时序攻击）
 * @param a 第一个字符串
 * @param b 第二个字符串
 * @returns 是否相等
 */
export function safeCompare(a: string, b: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(a, 'utf8'),
    Buffer.from(b.padEnd(a.length).slice(0, a.length), 'utf8')
  );
}
