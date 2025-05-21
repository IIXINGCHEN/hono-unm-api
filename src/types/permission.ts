/**
 * 权限系统类型定义
 */

/**
 * 操作类型
 */
export enum OperationType {
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
}

/**
 * HTTP方法到操作类型的映射
 */
export const HTTP_METHOD_TO_OPERATION: Record<string, OperationType> = {
  GET: OperationType.READ,
  HEAD: OperationType.READ,
  OPTIONS: OperationType.READ,
  POST: OperationType.CREATE,
  PUT: OperationType.UPDATE,
  PATCH: OperationType.UPDATE,
  DELETE: OperationType.DELETE,
};

/**
 * 资源类型
 */
export enum ResourceType {
  API_KEY = 'api_key',
  MUSIC = 'music',
  USER = 'user',
  SYSTEM = 'system',
  MONITOR = 'monitor',
}

/**
 * 资源定义
 */
export interface Resource {
  type: ResourceType;
  path: string;
  name: string;
  description?: string;
}

/**
 * 权限规则
 */
export interface PermissionRule {
  id: string;
  resource: ResourceType | string;
  operation: OperationType | string;
  path?: string;
  condition?: string;
  description?: string;
}

/**
 * 角色
 */
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[]; // 权限规则ID列表
  inherits?: string[]; // 继承的角色ID列表
}

/**
 * 权限检查请求
 */
export interface PermissionCheckRequest {
  roleId: string;
  resource: ResourceType | string;
  operation: OperationType | string;
  path: string;
  context?: Record<string, any>;
}

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  rule?: PermissionRule;
}

/**
 * 路径匹配结果
 */
export interface PathMatchResult {
  matched: boolean;
  params?: Record<string, string>;
}

/**
 * 路径模式类型
 */
export enum PathPatternType {
  EXACT = 'exact',
  PREFIX = 'prefix',
  REGEX = 'regex',
  GLOB = 'glob',
}

/**
 * 路径模式
 */
export interface PathPattern {
  type: PathPatternType;
  pattern: string;
  regex?: RegExp;
}

/**
 * 权限条件上下文
 */
export interface PermissionConditionContext {
  resource: ResourceType | string;
  operation: OperationType | string;
  path: string;
  user?: Record<string, any>;
  apiKey?: Record<string, any>;
  request?: Record<string, any>;
  [key: string]: any;
}

/**
 * 权限条件函数
 */
export type PermissionConditionFunction = (
  context: PermissionConditionContext
) => boolean | Promise<boolean>;

/**
 * 权限条件
 */
export interface PermissionCondition {
  id: string;
  name: string;
  description?: string;
  function: PermissionConditionFunction;
}

/**
 * 权限系统配置
 */
export interface PermissionConfig {
  enabled: boolean;
  defaultRole: string;
  resources: Resource[];
  rules: PermissionRule[];
  roles: Role[];
  conditions: PermissionCondition[];
}
