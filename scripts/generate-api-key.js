// 生成API密钥的脚本
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 配置
const API_KEYS_FILE = path.resolve('./data/api-keys/api-keys.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-in-production-32-characters';

// 生成随机令牌
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// 计算哈希值
function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// 加密数据
function encrypt(text) {
  // 生成随机初始化向量
  const iv = crypto.randomBytes(16);
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

// 解密数据
function decrypt(text) {
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
    throw new Error('解密失败: ' + error.message);
  }
}

// 创建API密钥
function createApiKey() {
  // 生成API密钥
  const apiKeyRaw = generateToken(32);
  const apiKeyId = generateToken(16);
  const hashedKey = hash(apiKeyRaw);
  
  // 创建API密钥信息
  const now = Date.now();
  const expiresIn = 365 * 24 * 60 * 60; // 1年
  
  const apiKeyInfo = {
    id: apiKeyId,
    key: hashedKey,
    name: 'Development API Key',
    clientId: 'dev-client',
    domain: '*',
    createdAt: now,
    expiresAt: now + expiresIn * 1000,
    status: 'active',
    permission: 'admin',
    metadata: {
      createdBy: 'generate-api-key.js',
      environment: 'development'
    },
  };
  
  // 读取现有API密钥
  let apiKeys = [];
  try {
    if (fs.existsSync(API_KEYS_FILE)) {
      const encryptedData = fs.readFileSync(API_KEYS_FILE, 'utf8');
      if (encryptedData) {
        const decryptedData = decrypt(encryptedData);
        apiKeys = JSON.parse(decryptedData);
      }
    }
  } catch (error) {
    console.error('读取API密钥文件失败:', error);
    // 如果读取失败，使用空数组
    apiKeys = [];
  }
  
  // 添加新的API密钥
  apiKeys.push(apiKeyInfo);
  
  // 确保目录存在
  const dir = path.dirname(API_KEYS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 保存API密钥
  const jsonData = JSON.stringify(apiKeys, null, 2);
  const encryptedData = encrypt(jsonData);
  fs.writeFileSync(API_KEYS_FILE, encryptedData);
  
  console.log('API密钥创建成功:');
  console.log(`API密钥: ${apiKeyId}.${apiKeyRaw}`);
  console.log('请在请求中使用以下头部:');
  console.log(`X-API-Key: ${apiKeyId}.${apiKeyRaw}`);
  console.log('或者在URL中添加以下查询参数:');
  console.log(`api_key=${apiKeyId}.${apiKeyRaw}`);
}

// 执行创建API密钥
createApiKey();
