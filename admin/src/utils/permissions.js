export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',

  // Clients
  VIEW_CLIENTS: 'view_clients',
  CREATE_CLIENT: 'create_client',
  EDIT_CLIENT: 'edit_client',
  DELETE_CLIENT: 'delete_client',
  SUSPEND_CLIENT: 'suspend_client',
  RESET_CLIENT_PASSWORD: 'reset_client_password',

  // Deposits
  APPROVE_DEPOSIT: 'approve_deposit',
  REJECT_DEPOSIT: 'reject_deposit',
  VIEW_DEPOSITS: 'view_deposits',

  // Withdrawals
  APPROVE_WITHDRAWAL: 'approve_withdrawal',
  REJECT_WITHDRAWAL: 'reject_withdrawal',
  VIEW_WITHDRAWALS: 'view_withdrawals',

  // KYC
  APPROVE_KYC: 'approve_kyc',
  REJECT_KYC: 'reject_kyc',
  VIEW_KYC: 'view_kyc',

  // Trading
  MANAGE_COPY_TRADING: 'manage_copy_trading',
  MANAGE_MAM: 'manage_mam',
  MANAGE_PAMM: 'manage_pamm',

  // Admin
  MANAGE_ROLES: 'manage_roles',
  MANAGE_ADMINS: 'manage_admins',
  VIEW_SETTINGS: 'view_settings',
  EDIT_SETTINGS: 'edit_settings',

  // Support
  VIEW_SUPPORT: 'view_support',
  MANAGE_SUPPORT: 'manage_support',
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPPORT: 'support',
  FINANCE: 'finance',
  COMPLIANCE: 'compliance',
}

export const rolePermissions = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CLIENTS,
    PERMISSIONS.EDIT_CLIENT,
    PERMISSIONS.APPROVE_DEPOSIT,
    PERMISSIONS.APPROVE_WITHDRAWAL,
    PERMISSIONS.MANAGE_COPY_TRADING,
  ],
  [ROLES.SUPPORT]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CLIENTS,
    PERMISSIONS.VIEW_SUPPORT,
    PERMISSIONS.MANAGE_SUPPORT,
  ],
  [ROLES.FINANCE]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.APPROVE_DEPOSIT,
    PERMISSIONS.REJECT_DEPOSIT,
    PERMISSIONS.APPROVE_WITHDRAWAL,
    PERMISSIONS.REJECT_WITHDRAWAL,
    PERMISSIONS.VIEW_CLIENTS,
  ],
  [ROLES.COMPLIANCE]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CLIENTS,
    PERMISSIONS.APPROVE_KYC,
    PERMISSIONS.REJECT_KYC,
    PERMISSIONS.VIEW_KYC,
  ],
}

export const hasPermission = (permissions, requiredPermission) => {
  return permissions.includes(requiredPermission)
}

export const hasAnyPermission = (permissions, requiredPermissions) => {
  return requiredPermissions.some((perm) => permissions.includes(perm))
}

export const hasAllPermissions = (permissions, requiredPermissions) => {
  return requiredPermissions.every((perm) => permissions.includes(perm))
}
