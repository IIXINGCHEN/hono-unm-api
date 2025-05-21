import config from '../config/index.js';
import { StorageFactory } from './storage/index.js';
import { CacheFactory } from './cache/index.js';
import { securityMonitor } from './monitor/securityMonitor.js';
import { AlertChannelFactory } from './monitor/index.js';
import { PermissionFactory } from './permission/index.js';
import { apiKeyService } from './apiKey.service.js';
import logger from '../utils/logger.js';

/**
 * 服务初始化管理器
 * 负责协调所有服务的初始化过程
 */
export class InitManager {
  private static initialized = false;

  /**
   * 初始化所有服务
   * @param config 应用配置
   */
  static async initialize(config: any): Promise<void> {
    if (this.initialized) {
      logger.debug('服务已经初始化，跳过');
      return;
    }

    try {
      logger.info('开始初始化服务...');

      // 初始化存储服务
      try {
        await StorageFactory.initialize({
          storageType: config.storageType,
          storagePath: config.storagePath,
          encryptionKey: config.encryptionKey,
        });
      } catch (error) {
        logger.error({ err: error }, '初始化存储服务失败，但继续初始化其他服务');
      }

      // 初始化缓存服务
      try {
        await CacheFactory.initialize({
          cacheType: config.cacheType,
          cacheTtl: config.cacheTtl,
        });
      } catch (error) {
        logger.error({ err: error }, '初始化缓存服务失败，但继续初始化其他服务');
      }

      // 初始化安全监控服务
      try {
        await securityMonitor.initialize({
          monitorEnabled: config.monitorEnabled,
          alertEnabled: config.alertEnabled,
          alertWebhookUrl: config.alertWebhookUrl,
          storageType: config.storageType,
          storagePath: config.storagePath,
          encryptionKey: config.encryptionKey,
          cacheType: config.cacheType,
          cacheTtl: config.cacheTtl,
        });
      } catch (error) {
        logger.error({ err: error }, '初始化安全监控服务失败，但继续初始化其他服务');
      }

      // 初始化报警通道工厂
      try {
        await AlertChannelFactory.initialize({
          alertEnabled: config.alertEnabled,
          alertWebhookUrl: config.alertWebhookUrl,
        });
      } catch (error) {
        logger.error({ err: error }, '初始化报警通道工厂失败，但继续初始化其他服务');
      }

      // 初始化权限系统
      try {
        await PermissionFactory.initialize({
          permissionEnabled: config.permissionEnabled,
          defaultRole: config.defaultRole,
          storageType: config.storageType,
          storagePath: config.storagePath,
          encryptionKey: config.encryptionKey,
          cacheType: config.cacheType,
          cacheTtl: config.cacheTtl,
        });
      } catch (error) {
        logger.error({ err: error }, '初始化权限系统失败，但继续初始化其他服务');
      }

      // 初始化API密钥服务
      try {
        await apiKeyService.initialize();
      } catch (error) {
        logger.error({ err: error }, '初始化API密钥服务失败，但继续初始化其他服务');
      }

      this.initialized = true;
      logger.info('所有服务初始化完成');
    } catch (error) {
      logger.error({ err: error }, '初始化服务失败');
      throw new Error(`初始化服务失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 关闭所有服务
   */
  static async shutdown(): Promise<void> {
    if (!this.initialized) {
      logger.debug('服务未初始化，无需关闭');
      return;
    }

    try {
      logger.info('开始关闭服务...');

      // 关闭存储服务
      await StorageFactory.closeAll();

      // 关闭缓存服务
      await CacheFactory.closeAll();

      this.initialized = false;
      logger.info('所有服务已关闭');
    } catch (error) {
      logger.error({ err: error }, '关闭服务失败');
      throw new Error(`关闭服务失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
