export interface Employee {
  id: string;
  username: string;
  email: string;
  roles:Roles [];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  image?: string; 
  referralCode?: string;
}

export  interface Roles{
  id:string;
  name:string;
  description:string;
  isActive:boolean;
  priority:number;
  permissions:EmployeePermission[];
  updatedAt:string;
  createdAt:string
}
export interface EmployeePermission {
  id: number;
  name: string;
  description: string;
  action: string;
  resource: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
export interface CreateEmployeeDto {
  username: string;
  email: string;
  password: string;
  roleIds: [];
}

export interface UpdateEmployeeDto {
  username?: string;
  roleIds?: [];
  isActive?: boolean;
}