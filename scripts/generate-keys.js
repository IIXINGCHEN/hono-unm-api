// 生成随机密钥的脚本
import crypto from 'crypto';

// 生成随机令牌
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// 生成加密密钥
const encryptionKey = generateToken(32);
console.log(`ENCRYPTION_KEY=${encryptionKey}`);

// 生成JWT密钥
const jwtSecret = generateToken(32);
console.log(`JWT_SECRET=${jwtSecret}`);
