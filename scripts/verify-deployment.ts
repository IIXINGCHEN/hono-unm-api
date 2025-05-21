/**
 * 部署验证脚本
 * 用于验证部署后的应用是否正常运行，并检查安全配置
 */

// 使用fetch API进行HTTP请求
async function verifyDeployment(baseUrl: string) {
  console.log(`验证部署: ${baseUrl}`);
  
  try {
    // 检查健康端点
    console.log('检查健康端点...');
    const healthResponse = await fetch(`${baseUrl}/api/v1/health/healthz`);
    if (!healthResponse.ok) {
      throw new Error(`健康检查失败: ${healthResponse.status}`);
    }
    console.log('✅ 健康检查通过');
    
    // 检查安全头
    const headers = healthResponse.headers;
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'content-security-policy',
    ];
    
    console.log('检查安全头...');
    for (const header of requiredHeaders) {
      if (!headers.has(header)) {
        console.warn(`⚠️ 缺少安全头: ${header}`);
      } else {
        console.log(`✅ 安全头存在: ${header}`);
      }
    }
    
    // 检查CORS配置
    console.log('检查CORS配置...');
    const corsResponse = await fetch(`${baseUrl}/api/v1/health/healthz`, {
      headers: {
        'Origin': 'https://example.com'
      }
    });
    
    const corsHeader = corsResponse.headers.get('access-control-allow-origin');
    if (corsHeader === '*') {
      console.warn('⚠️ CORS配置允许所有源 (*)');
    } else if (corsHeader) {
      console.log(`✅ CORS配置正确: ${corsHeader}`);
    } else {
      console.log('✅ CORS限制正确 (不允许跨域)');
    }
    
    // 检查API信息端点
    console.log('检查API信息端点...');
    const infoResponse = await fetch(`${baseUrl}/api/v1/info/info`);
    if (!infoResponse.ok) {
      console.warn(`⚠️ 信息端点检查失败: ${infoResponse.status}`);
    } else {
      const infoData = await infoResponse.json();
      console.log('✅ 信息端点检查通过');
      console.log(`应用名称: ${infoData.data.application_name}`);
      console.log(`版本: ${infoData.data.version}`);
      console.log(`环境: ${infoData.data.environment}`);
    }
    
    // 检查速率限制
    console.log('检查速率限制...');
    const rateLimitPromises = [];
    for (let i = 0; i < 5; i++) {
      rateLimitPromises.push(fetch(`${baseUrl}/api/v1/health/healthz`));
    }
    
    const rateLimitResponses = await Promise.all(rateLimitPromises);
    const hasRateLimit = rateLimitResponses.some(response => response.status === 429);
    
    if (hasRateLimit) {
      console.log('✅ 速率限制正常工作');
    } else {
      console.log('ℹ️ 未触发速率限制 (这可能是正常的，取决于配置)');
    }
    
    console.log('部署验证完成');
  } catch (error) {
    console.error('❌ 部署验证失败:', error);
    process.exit(1);
  }
}

// 从命令行参数获取基础URL
const baseUrl = process.argv[2] || 'http://localhost:5678';
verifyDeployment(baseUrl);
