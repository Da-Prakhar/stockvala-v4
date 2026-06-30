import { useAuth } from './useAuth'
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../utils/permissions'

export const usePermission = () => {
  const { permissions } = useAuth()

  return {
    can: (permission) => hasPermission(permissions, permission),
    canAny: (permissionList) => hasAnyPermission(permissions, permissionList),
    canAll: (permissionList) => hasAllPermissions(permissions, permissionList),
  }
}
