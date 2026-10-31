// types/permission.types.ts

export interface Permission {
  id: number;
  name: string;
  description: string;
  resource: string;
  action: string;
  roles?: any[]; // You can define a proper Role type
  createdAt: string;
  updatedAt: string;
}

export interface CreatePermissionDto {
  name: string;
  description: string;
  resource?: string;
  action?: string;
}

export interface UpdatePermissionDto {
  name?: string;
  description?: string;
  resource?: string;
  action?: string;
}

export interface QueryPermissionDto {
  resource?: string;
  action?: string;
  search?: string;
  sortBy?: 'name' | 'resource' | 'action' | 'createdAt' | 'updatedAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface BulkCreatePermissionsDto {
  permissions: CreatePermissionDto[];
}

export interface PermissionStats {
  total: number;
  resourceCount: number;
  actionCount: number;
  resources: string[];
  actions: string[];
}

export interface GroupedPermissions {
  [resource: string]: Permission[];
}