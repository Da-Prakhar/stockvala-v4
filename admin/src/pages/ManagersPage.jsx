import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/ui/DataTable'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Loader } from '../components/ui/Loader'
import { formatDate } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function ManagersPage() {
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null })
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'Admin' })

  useEffect(() => {
    fetchManagers()
  }, [])

  const fetchManagers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/admins')
      setManagers(res.data?.data || res.data || [])
    } catch (err) {
      console.error('Error fetching managers:', err)
      toast.error('Failed to load managers')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData({ name: '', email: '', password: '', role: 'Admin' })
    setModalOpen(true)
  }

  const handleOpenEdit = (manager) => {
    setEditingId(manager.id)
    setFormData({
      name: `${manager.firstName || ''} ${manager.lastName || manager.name || ''}`.trim(),
      email: manager.email,
      password: '',
      role: manager.role || 'Admin',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast.error('Name and email are required')
      return
    }
    if (!editingId && !formData.password) {
      toast.error('Password is required for new managers')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        ...(formData.password ? { password: formData.password } : {}),
      }
      if (editingId) {
        const res = await api.put(`/admin/admins/${editingId}`, payload)
        const updated = res.data?.data || res.data
        setManagers((prev) => prev.map((m) => m.id === editingId ? { ...m, ...updated } : m))
        toast.success('Manager updated successfully')
      } else {
        const res = await api.post('/admin/admins', payload)
        const created = res.data?.data || res.data
        setManagers((prev) => [...prev, created])
        toast.success('Manager added successfully')
      }
      setModalOpen(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save manager')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/admins/${deleteModal.id}`)
      setManagers((prev) => prev.filter((m) => m.id !== deleteModal.id))
      toast.success('Manager deleted')
    } catch (err) {
      toast.error('Failed to delete manager')
    } finally {
      setDeleteModal({ isOpen: false, id: null })
    }
  }

  const handleToggleStatus = async (manager) => {
    const newStatus = manager.status === 'active' ? 'inactive' : 'active'
    try {
      await api.put(`/admin/admins/${manager.id}`, { status: newStatus })
      setManagers((prev) => prev.map((m) => m.id === manager.id ? { ...m, status: newStatus } : m))
      toast.success(`Manager ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (v, row) => `${row.firstName || ''} ${row.lastName || row.name || ''}`.trim() || v || '-',
    },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role', sortable: true, render: (v) => v || '-' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => v ? <StatusBadge status={v}>{v.toUpperCase()}</StatusBadge> : <span className="text-dark-400">-</span>,
    },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v) => v ? formatDate(v) : '-' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={Edit2} onClick={() => handleOpenEdit(row)}>Edit</Button>
          <Button size="sm" variant="secondary" onClick={() => handleToggleStatus(row)}>
            {row.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => setDeleteModal({ isOpen: true, id: row.id })}>Delete</Button>
        </div>
      ),
    },
  ]

  if (loading) {
    return <div className="flex items-center justify-center min-h-96"><Loader /></div>
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Admin Managers</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Manage admin user accounts ({managers.length})</p>
        </div>
        <Button icon={Plus} onClick={handleOpenAdd}>Add Manager</Button>
      </div>

      <Card noPadding>
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={managers} pageSize={10} />
        </div>
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingId(null) }}
        title={editingId ? 'Edit Manager' : 'Add New Manager'}
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            fullWidth
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            fullWidth
          />
          <Input
            label={editingId ? 'New Password (leave blank to keep)' : 'Password'}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            fullWidth
          />
          <Select
            label="Role"
            options={[
              { label: 'Super Admin', value: 'Super Admin' },
              { label: 'Admin', value: 'Admin' },
              { label: 'Finance Manager', value: 'Finance Manager' },
              { label: 'Compliance Manager', value: 'Compliance Manager' },
              { label: 'Support Manager', value: 'Support Manager' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            fullWidth
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditingId(null) }} fullWidth>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving} fullWidth>
              {editingId ? 'Update' : 'Create'} Manager
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Manager"
        message="This will permanently delete this manager account. They will lose all access."
        confirmText="Delete"
        variant="danger"
      />
    </motion.div>
  )
}
