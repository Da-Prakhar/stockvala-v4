import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, Shield, Users, Check, X, ShieldAlert } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Loader } from '../components/ui/Loader';
import { formatDate } from '../utils/formatters';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [adminModal, setAdminModal] = useState({ isOpen: false });
  const [roleModal, setRoleModal] = useState({ isOpen: false, isEdit: false, data: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, role: null });

  // Forms state
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', role: '', password: '' });
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissionIds: [] });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        api.get('/admin/roles'),
        api.get('/admin/admins'),
        api.get('/admin/roles/permissions'),
      ]);
      
      if (results[0].status === 'fulfilled') setRoles(results[0].value.data.data || []);
      else console.error('Roles fetch failed:', results[0].reason);

      if (results[1].status === 'fulfilled') setAdmins(results[1].value.data.data || []);
      else console.error('Admins fetch failed:', results[1].reason);

      if (results[2].status === 'fulfilled') setAvailablePermissions(results[2].value.data.data || []);
      else console.error('Permissions fetch failed:', results[2].reason);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load page data');
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by category
  const groupedPermissions = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  const handleAddAdmin = async () => {
    if (!newAdmin.name || !newAdmin.email || !newAdmin.role) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      const response = await api.post('/admin/admins', newAdmin);
      setAdmins([response.data.data, ...admins]);
      toast.success('Admin user created successfully');
      setAdminModal({ isOpen: false });
      setNewAdmin({ name: '', email: '', role: '', password: '' });
    } catch (err) {
      console.error('Error creating admin:', err);
      toast.error(err.response?.data?.message || 'Failed to create admin user');
    }
  };

  const handleSaveRole = async () => {
    if (!roleForm.name) {
      toast.error('Role name is required');
      return;
    }
    try {
      if (roleModal.isEdit) {
        const response = await api.put(`/admin/roles/${roleModal.data.id}`, roleForm);
        setRoles(roles.map(r => r.id === roleModal.data.id ? response.data.data : r));
        toast.success('Role updated successfully');
      } else {
        const response = await api.post('/admin/roles', roleForm);
        setRoles([response.data.data, ...roles]);
        toast.success('Role created successfully');
      }
      setRoleModal({ isOpen: false, isEdit: false, data: null });
    } catch (err) {
      console.error('Error saving role:', err);
      toast.error(err.response?.data?.message || 'Failed to save role');
    }
  };

  const handleDeleteRole = async () => {
    try {
      await api.delete(`/admin/roles/${deleteModal.role.id}`);
      setRoles(roles.filter(r => r.id !== deleteModal.role.id));
      toast.success('Role deleted successfully');
      setDeleteModal({ isOpen: false, role: null });
    } catch (err) {
      console.error('Error deleting role:', err);
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  const togglePermission = (permId) => {
    setRoleForm(prev => {
      const isSelected = prev.permissionIds.includes(permId);
      return {
        ...prev,
        permissionIds: isSelected 
          ? prev.permissionIds.filter(id => id !== permId)
          : [...prev.permissionIds, permId]
      };
    });
  };

  const isSystemRole = (roleName) => {
    const name = roleName?.toLowerCase();
    return ['admin', 'super admin', 'user', 'support'].includes(name);
  };

  const roleColumns = [
    { 
      key: 'name', 
      label: 'Role Name', 
      sortable: true,
      render: (v) => (
        <div className="flex items-center gap-2">
          {isSystemRole(v) ? <ShieldAlert className="w-4 h-4 text-primary-500" /> : <Shield className="w-4 h-4 text-dark-400" />}
          <span className="font-medium text-dark-900 dark:text-dark-100">{v}</span>
        </div>
      )
    },
    { 
      key: 'permissionIds', 
      label: 'Permissions', 
      render: (perms) => {
        const count = perms ? perms.length : 0;
        return (
          <span className="px-2 py-1 text-xs font-medium bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-300 rounded-md border border-dark-200 dark:border-dark-700">
            {count} permission{count !== 1 && 's'}
          </span>
        );
      }
    },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v) => formatDate(v) },
    {
      key: 'actions',
      label: '',
      render: (_, role) => (
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            icon={Edit2}
            onClick={() => {
              setRoleForm({ name: role.name, description: role.description || '', permissionIds: role.permissionIds || [] });
              setRoleModal({ isOpen: true, isEdit: true, data: role });
            }}
          />
          {!isSystemRole(role.name) && (
            <Button 
              variant="ghost" 
              size="sm" 
              icon={Trash2}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => setDeleteModal({ isOpen: true, role })}
            />
          )}
        </div>
      )
    }
  ];

  const adminColumns = [
    { 
      key: 'name', 
      label: 'Name', 
      sortable: true,
      render: (v, row) => (
        <div>
          <div className="font-medium text-dark-900 dark:text-dark-100">{v}</div>
          <div className="text-sm text-dark-500 dark:text-dark-400">{row.email}</div>
        </div>
      )
    },
    { 
      key: 'role', 
      label: 'Role', 
      sortable: true,
      render: (v) => <StatusBadge status={v === 'Super Admin' ? 'success' : 'info'}>{v}</StatusBadge>
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v}>{v.toUpperCase()}</StatusBadge>,
    },
    { key: 'joined', label: 'Joined', sortable: true, render: (v) => formatDate(v) },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Roles & Permissions</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Manage system access and admin accounts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles Section */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-dark-900 dark:text-dark-50 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-500" />
                Roles ({roles.length})
              </h2>
              <Button size="sm" icon={Plus} onClick={() => {
                setRoleForm({ name: '', description: '', permissionIds: [] });
                setRoleModal({ isOpen: true, isEdit: false, data: null });
              }}>
                New
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              {roles.length === 0 ? (
                <div className="p-8 text-center text-dark-500">No roles defined</div>
              ) : (
                <DataTable columns={roleColumns} data={roles} pageSize={5} />
              )}
            </div>
          </Card>
        </div>

        {/* Admin Users Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-dark-900 dark:text-dark-50 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-500" />
                Admin Users ({admins.length})
              </h2>
              <Button icon={Plus} onClick={() => setAdminModal({ isOpen: true })}>
                Add Admin
              </Button>
            </div>
            <div className="overflow-x-auto">
              {admins.length === 0 ? (
                <div className="p-8 text-center text-dark-500">No admin users found</div>
              ) : (
                <DataTable columns={adminColumns} data={admins} pageSize={10} />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Role Management Modal */}
      <Modal
        isOpen={roleModal.isOpen}
        onClose={() => setRoleModal({ isOpen: false, isEdit: false, data: null })}
        title={roleModal.isEdit ? "Edit Role" : "Create New Role"}
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Role Name"
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              fullWidth
              placeholder="e.g. Support Manager"
              disabled={roleModal.isEdit && isSystemRole(roleModal.data?.name)}
            />
            <Input
              label="Description"
              value={roleForm.description}
              onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              fullWidth
              placeholder="Brief description of this role"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-dark-900 dark:text-dark-100">Permissions</h3>
              <div className="text-sm text-dark-500">
                {roleForm.permissionIds.length} selected
              </div>
            </div>
            
            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(groupedPermissions).map(([category, perms]) => (
                <div key={category} className="bg-dark-50 dark:bg-dark-800/50 rounded-xl p-4 border border-dark-100 dark:border-dark-800">
                  <h4 className="text-sm font-semibold text-primary-600 dark:text-primary-400 mb-3 uppercase tracking-wider">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {perms.map(perm => {
                      const isSelected = roleForm.permissionIds.includes(perm.id);
                      return (
                        <div 
                          key={perm.id}
                          onClick={() => togglePermission(perm.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 dark:border-primary-500/50' 
                              : 'bg-white dark:bg-dark-800 border-dark-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                            isSelected 
                              ? 'bg-primary-500 border-primary-500 text-white' 
                              : 'border-dark-300 dark:border-dark-600'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <span className={`text-sm font-medium ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-dark-700 dark:text-dark-300'}`}>
                            {perm.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-dark-100 dark:border-dark-800">
            <Button variant="secondary" onClick={() => setRoleModal({ isOpen: false, isEdit: false, data: null })}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveRole}>
              {roleModal.isEdit ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Admin Modal */}
      <Modal
        isOpen={adminModal.isOpen}
        onClose={() => setAdminModal({ isOpen: false })}
        title="Create Admin User"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={newAdmin.name}
            onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
            fullWidth
            placeholder="John Doe"
          />
          <Input
            label="Email Address"
            type="email"
            value={newAdmin.email}
            onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
            fullWidth
            placeholder="admin@example.com"
          />
          <Input
            label="Password (Optional)"
            type="password"
            value={newAdmin.password}
            onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
            fullWidth
            placeholder="Leave blank for default (Admin@123)"
          />
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Assign Role
            </label>
            <select
              value={newAdmin.role}
              onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-dark-800 border-2 border-dark-200 dark:border-dark-700 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all text-dark-900 dark:text-dark-100"
            >
              <option value="">Select a role...</option>
              {roles.map(role => (
                <option key={role.id} value={role.name}>{role.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setAdminModal({ isOpen: false })} fullWidth>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddAdmin} fullWidth>
              Create User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, role: null })}
        title="Delete Role"
      >
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl flex gap-3 text-red-600 dark:text-red-400">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div>
              <h4 className="font-semibold mb-1">Confirm Deletion</h4>
              <p className="text-sm">Are you sure you want to delete the role "{deleteModal.role?.name}"? Any admins assigned to this role may lose access.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false, role: null })} fullWidth>
              Cancel
            </Button>
            <Button 
              className="bg-red-500 hover:bg-red-600 text-white w-full" 
              onClick={handleDeleteRole}
            >
              Yes, Delete Role
            </Button>
          </div>
        </div>
      </Modal>

    </motion.div>
  );
}
