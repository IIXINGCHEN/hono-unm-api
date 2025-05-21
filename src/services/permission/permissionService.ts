import {
  HTTP_METHOD_TO_OPERATION,
  OperationType,
  PathMatchResult,
  PathPattern,
  PathPatternType,
  PermissionCheckRequest,
  PermissionCheckResult,
  PermissionCondition,
  PermissionConditionContext,
  PermissionRule,
  ResourceType,
  Role,
} from '../../types/permission.js';
import { CacheAdapter } from '../cache/index.js';
import logger from '../../utils/logger.js';

/**
 * 权限服务
 * 提供权限验证和管理功能
 */
export class PermissionService {
  private rules: Map<string, PermissionRule> = new Map();
  private roles: Map<string, Role> = new Map();
  private conditions: Map<string, PermissionCondition> = new Map();
  private pathPatterns: Map<string, PathPattern> = new Map();
  private cache: CacheAdapter | null = null;

  /**
   * 设置缓存适配器
   * @param cache 缓存适配器
   */
  setCache(cache: CacheAdapter): void {
    this.cache = cache;
    logger.info('权限服务已设置缓存适配器');
  }

  /**
   * 添加权限规则
   * @param rule 权限规则
   */
  addRule(rule: PermissionRule): void {
    this.rules.set(rule.id, rule);
    
    // 如果规则包含路径，则创建路径模式
    if (rule.path) {
      this.createPathPattern(rule.id, rule.path);
    }
    
    logger.info({
      ruleId: rule.id,
      resource: rule.resource,
      operation: rule.operation,
    }, '已添加权限规则');
  }

  /**
   * 添加角色
   * @param role 角色
   */
  addRole(role: Role): void {
    this.roles.set(role.id, role);
    
    logger.info({
      roleId: role.id,
      name: role.name,
      permissionCount: role.permissions.length,
    }, '已添加角色');
  }

  /**
   * 添加权限条件
   * @param condition 权限条件
   */
  addCondition(condition: PermissionCondition): void {
    this.conditions.set(condition.id, condition);
    
    logger.info({
      conditionId: condition.id,
      name: condition.name,
    }, '已添加权限条件');
  }

  /**
   * 创建路径模式
   * @param id 规则ID
   * @param path 路径
   */
  private createPathPattern(id: string, path: string): void {
    let type: PathPatternType;
    let pattern: string = path;
    let regex: RegExp | undefined;
    
    // 确定路径模式类型
    if (path.endsWith('*')) {
      type = PathPatternType.PREFIX;
      pattern = path.slice(0, -1);
    } else if (path.startsWith('^') && path.endsWith('$')) {
      type = PathPatternType.REGEX;
      try {
        regex = new RegExp(path);
      } catch (error) {
        logger.error({
          ruleId: id,
          path,
          error,
        }, '创建正则表达式路径模式失败');
        
        // 回退到精确匹配
        type = PathPatternType.EXACT;
      }
    } else if (path.includes('*') || path.includes('?')) {
      type = PathPatternType.GLOB;
      // 将glob模式转换为正则表达式
      const regexPattern = path
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      
      try {
        regex = new RegExp(`^${regexPattern}$`);
      } catch (error) {
        logger.error({
          ruleId: id,
          path,
          error,
        }, '创建glob路径模式失败');
        
        // 回退到精确匹配
        type = PathPatternType.EXACT;
      }
    } else {
      type = PathPatternType.EXACT;
    }
    
    this.pathPatterns.set(id, { type, pattern, regex });
  }

  /**
   * 匹配路径
   * @param requestPath 请求路径
   * @param ruleId 规则ID
   */
  private matchPath(requestPath: string, ruleId: string): PathMatchResult {
    const pattern = this.pathPatterns.get(ruleId);
    
    if (!pattern) {
      return { matched: false };
    }
    
    switch (pattern.type) {
      case PathPatternType.EXACT:
        return { matched: requestPath === pattern.pattern };
      
      case PathPatternType.PREFIX:
        return { matched: requestPath.startsWith(pattern.pattern) };
      
      case PathPatternType.REGEX:
      case PathPatternType.GLOB:
        if (pattern.regex) {
          const matched = pattern.regex.test(requestPath);
          
          if (matched && pattern.regex.exec(requestPath)?.groups) {
            return {
              matched,
              params: pattern.regex.exec(requestPath)?.groups,
            };
          }
          
          return { matched };
        }
        return { matched: false };
      
      default:
        return { matched: false };
    }
  }

  /**
   * 检查权限
   * @param request 权限检查请求
   */
  async checkPermission(request: PermissionCheckRequest): Promise<PermissionCheckResult> {
    const { roleId, resource, operation, path, context = {} } = request;
    
    // 尝试从缓存中获取结果
    if (this.cache) {
      const cacheKey = `permission:${roleId}:${resource}:${operation}:${path}`;
      const cacheResult = await this.cache.get<PermissionCheckResult>(cacheKey);
      
      if (cacheResult.success && cacheResult.data) {
        return cacheResult.data;
      }
    }
    
    // 获取角色
    const role = this.roles.get(roleId);
    
    if (!role) {
      const result: PermissionCheckResult = {
        allowed: false,
        reason: `角色 ${roleId} 不存在`,
      };
      
      return result;
    }
    
    // 获取角色的所有权限（包括继承的权限）
    const permissions = this.getAllRolePermissions(role);
    
    // 检查每个权限规则
    for (const permissionId of permissions) {
      const rule = this.rules.get(permissionId);
      
      if (!rule) {
        continue;
      }
      
      // 检查资源和操作是否匹配
      const resourceMatched = rule.resource === '*' || rule.resource === resource;
      const operationMatched = rule.operation === '*' || rule.operation === operation;
      
      if (!resourceMatched || !operationMatched) {
        continue;
      }
      
      // 检查路径是否匹配
      let pathMatched = true;
      let pathParams: Record<string, string> | undefined;
      
      if (rule.path) {
        const pathMatchResult = this.matchPath(path, rule.id);
        pathMatched = pathMatchResult.matched;
        pathParams = pathMatchResult.params;
      }
      
      if (!pathMatched) {
        continue;
      }
      
      // 检查条件是否满足
      if (rule.condition) {
        const condition = this.conditions.get(rule.condition);
        
        if (condition) {
          const conditionContext: PermissionConditionContext = {
            resource,
            operation,
            path,
            pathParams,
            ...context,
          };
          
          try {
            const conditionResult = await condition.function(conditionContext);
            
            if (!conditionResult) {
              continue;
            }
          } catch (error) {
            logger.error({
              ruleId: rule.id,
              conditionId: rule.condition,
              error,
            }, '执行权限条件失败');
            
            continue;
          }
        } else {
          // 条件不存在，跳过此规则
          continue;
        }
      }
      
      // 所有检查都通过，允许访问
      const result: PermissionCheckResult = {
        allowed: true,
        rule,
      };
      
      // 缓存结果
      if (this.cache) {
        const cacheKey = `permission:${roleId}:${resource}:${operation}:${path}`;
        await this.cache.set(cacheKey, result, 300); // 缓存5分钟
      }
      
      return result;
    }
    
    // 没有匹配的规则，拒绝访问
    const result: PermissionCheckResult = {
      allowed: false,
      reason: `没有匹配的权限规则`,
    };
    
    // 缓存结果
    if (this.cache) {
      const cacheKey = `permission:${roleId}:${resource}:${operation}:${path}`;
      await this.cache.set(cacheKey, result, 300); // 缓存5分钟
    }
    
    return result;
  }

  /**
   * 获取角色的所有权限（包括继承的权限）
   * @param role 角色
   */
  private getAllRolePermissions(role: Role): Set<string> {
    const permissions = new Set<string>();
    
    // 添加角色自身的权限
    for (const permission of role.permissions) {
      permissions.add(permission);
    }
    
    // 添加继承的角色的权限
    if (role.inherits) {
      for (const inheritedRoleId of role.inherits) {
        const inheritedRole = this.roles.get(inheritedRoleId);
        
        if (inheritedRole) {
          const inheritedPermissions = this.getAllRolePermissions(inheritedRole);
          
          for (const permission of inheritedPermissions) {
            permissions.add(permission);
          }
        }
      }
    }
    
    return permissions;
  }

  /**
   * 检查HTTP请求权限
   * @param roleId 角色ID
   * @param method HTTP方法
   * @param path 请求路径
   * @param resource 资源类型
   * @param context 上下文
   */
  async checkHttpPermission(
    roleId: string,
    method: string,
    path: string,
    resource: ResourceType | string,
    context: Record<string, any> = {}
  ): Promise<PermissionCheckResult> {
    // 将HTTP方法映射到操作类型
    const operation = HTTP_METHOD_TO_OPERATION[method] || OperationType.READ;
    
    return this.checkPermission({
      roleId,
      resource,
      operation,
      path,
      context,
    });
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
      logger.info('已清除权限缓存');
    }
  }
}

// 导出单例实例
export const permissionService = new PermissionService();
