import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Edit, Trash2, ToggleLeft, ToggleRight, Shield,
  Users, Car, Navigation, CreditCard, FileText, MessageSquare,
  ShieldCheck, BarChart2, Repeat, Building2, CheckCircle, XCircle, Info,
  Mail, Phone, Calendar, Clock, Eye, Bell, Send, X
} from '@/components/ui/icons'
import { SendNotificationModal } from '../../components/shared/SendNotificationModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable } from '../../components/shared/DataTable'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { adminsApi } from '../../api/admins.api'
import { authApi } from '../../api/auth.api'
import { formatDate, formatRelative } from '../../utils/format'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

const createSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(10, 'Invalid phone'),
  password: z.string().min(6, 'Min 6 chars'),
  role: z.enum(['headmaster', 'moderator']),
})

const PERMISSIONS = [
  {
    key: 'manageUsers',
    label: 'Manage Users',
    icon: Users,
    color: 'indigo',
    description: 'View, suspend, ban, and delete user accounts',
    allows: ['View all users', 'Suspend accounts', 'Ban accounts', 'Delete accounts'],
  },
  {
    key: 'manageDrivers',
    label: 'Manage Drivers',
    icon: Car,
    color: 'blue',
    description: 'Approve, reject, and suspend driver accounts',
    allows: ['View all drivers', 'Approve applications', 'Reject applications', 'Suspend drivers'],
  },
  {
    key: 'manageTrips',
    label: 'Manage Trips',
    icon: Navigation,
    color: 'purple',
    description: 'Monitor and manage all platform trips',
    allows: ['View trip history', 'View trip details', 'Cancel trips', 'View bids'],
  },
  {
    key: 'managePayments',
    label: 'Manage Payments',
    icon: CreditCard,
    color: 'emerald',
    description: 'Access financial transactions and issue refunds',
    allows: ['View all transactions', 'Issue refunds', 'Export reports', 'View revenue stats'],
  },
  {
    key: 'verifyDocuments',
    label: 'Verify Documents',
    icon: FileText,
    color: 'amber',
    description: 'Review and verify driver uploaded documents',
    allows: ['View document queue', 'Approve documents', 'Reject documents', 'View document history'],
  },
  {
    key: 'editDocuments',
    label: 'Edit Documents',
    icon: FileText,
    color: 'blue',
    description: 'Edit a document’s type and expiry date',
    allows: ['Edit document type', 'Edit expiry date'],
  },
  {
    key: 'deleteDocuments',
    label: 'Delete Documents',
    icon: FileText,
    color: 'red',
    description: 'Permanently delete uploaded documents',
    allows: ['Delete documents'],
  },
  {
    key: 'handleSupport',
    label: 'Handle Support',
    icon: MessageSquare,
    color: 'rose',
    description: 'Manage user and driver support tickets',
    allows: ['View all tickets', 'Reply to tickets', 'Assign tickets', 'Resolve & close tickets'],
  },
  {
    key: 'manageAdmins',
    label: 'Manage Admins',
    icon: ShieldCheck,
    color: 'red',
    description: 'Create and manage other admin accounts',
    allows: ['Create new admins', 'Edit permissions', 'Deactivate admins', 'Delete admins'],
  },
  {
    key: 'viewAnalytics',
    label: 'View Analytics',
    icon: BarChart2,
    color: 'teal',
    description: 'Access platform analytics and reports',
    allows: ['View trip analytics', 'Revenue reports', 'User growth charts', 'Driver performance'],
  },
  {
    key: 'manageSubscriptions',
    label: 'Manage Subscriptions',
    icon: Repeat,
    color: 'violet',
    description: 'Manage parent and business subscription plans',
    allows: ['View subscriptions', 'Pause subscriptions', 'Cancel subscriptions', 'Assign drivers'],
  },
  {
    key: 'manageSuppliers',
    label: 'Manage Suppliers',
    icon: Building2,
    color: 'orange',
    description: 'Verify and manage vehicle supplier accounts',
    allows: ['View all suppliers', 'Verify suppliers', 'Manage plans', 'Activate/deactivate'],
  },
]

const ROLE_PRESETS = {
  headmaster: {
    manageUsers: true, manageDrivers: true, manageTrips: true,
    managePayments: false, verifyDocuments: true, handleSupport: true,
    manageAdmins: false, viewAnalytics: true, manageSubscriptions: true,
    manageSuppliers: true,
  },
  moderator: {
    manageUsers: true, manageDrivers: true, manageTrips: false,
    managePayments: false, verifyDocuments: true, handleSupport: true,
    manageAdmins: false, viewAnalytics: false, manageSubscriptions: false,
    manageSuppliers: false,
  },
  custom: null,
}

const ICON_COLORS = {
  indigo: 'bg-orange-50 text-orange-600',
  blue: 'bg-orange-50 text-orange-600',
  purple: 'bg-orange-50 text-orange-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  red: 'bg-red-50 text-red-600',
  teal: 'bg-teal-50 text-teal-600',
  violet: 'bg-orange-50 text-orange-600',
  orange: 'bg-orange-50 text-orange-600',
}

export default function AdminList() {
  const { admin: currentAdmin, updateAdmin } = useAuthStore()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editAdmin, setEditAdmin] = useState(null)
  const [deleteAdmin, setDeleteAdmin] = useState(null)
  const [viewAdmin, setViewAdmin] = useState(null)
  const [editProfile, setEditProfile] = useState(false)
  const [selected, setSelected] = useState([]) // [{ id, label }]
  const [notify, setNotify] = useState(null)   // { recipients }

  const profileMutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (res) => {
      const updated = res?.data || res
      updateAdmin(updated)
      qc.invalidateQueries({ queryKey: ['admins'] })
      toast.success('Profile updated')
      setEditProfile(false)
    },
    onError: (err) => toast.error(err?.message || 'Failed to update profile'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: adminsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: adminsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); toast.success('Admin created'); setShowCreate(false) },
    onError: (err) => toast.error(err?.message || 'Failed to create admin'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => adminsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); toast.success('Permissions saved'); setEditAdmin(null) },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => adminsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); toast.success('Admin deleted'); setDeleteAdmin(null) },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => adminsApi.toggle(id, isActive),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); toast.success('Updated') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const admins = data?.data || []

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])
  const labelOf = (a) => a.name || a.email || 'Admin'
  const toggleRow = (a) =>
    setSelected((prev) => prev.some((s) => s.id === a._id)
      ? prev.filter((s) => s.id !== a._id)
      : [...prev, { id: a._id, label: labelOf(a) }])
  const toggleAllOnPage = () => {
    const allSelected = admins.length > 0 && admins.every((a) => selectedIds.has(a._id))
    setSelected(allSelected ? [] : admins.map((a) => ({ id: a._id, label: labelOf(a) })))
  }

  const columns = [
    {
      key: 'name',
      header: 'Admin',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.avatarUrl} name={val} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900">{val}</p>
            <p className="text-xs text-gray-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone' },
    {
      key: 'role',
      header: 'Role',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'permissions',
      header: 'Access',
      render: (val, row) => {
        if (row.role === 'superadmin') return <span className="text-xs text-orange-600 font-medium">Full Access</span>
        const active = PERMISSIONS.filter((p) => val?.[p.key])
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {active.slice(0, 3).map((p) => (
              <span key={p.key} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {p.label.replace('Manage ', '').replace('Handle ', '').replace('View ', '')}
              </span>
            ))}
            {active.length > 3 && (
              <span className="text-xs text-gray-400">+{active.length - 3} more</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (val) => <StatusBadge status={val ? 'active' : 'suspended'} />,
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      render: (val) => <span className="text-xs text-gray-500">{formatRelative(val) || 'Never'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (val) => <span className="text-xs text-gray-500">{formatDate(val)}</span>,
    },
    {
      key: '_id',
      header: 'Actions',
      render: (id, row) => {
        const viewBtn = (
          <button
            onClick={(e) => { e.stopPropagation(); setViewAdmin(row) }}
            className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </button>
        )
        const notifyBtn = (
          <button
            onClick={(e) => { e.stopPropagation(); setNotify({ recipients: [{ id, label: labelOf(row) }] }) }}
            className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600"
            title="Send notification"
          >
            <Bell className="h-4 w-4" />
          </button>
        )
        if (row._id === currentAdmin?._id) return <div className="flex items-center gap-1">{viewBtn}<span className="text-xs text-orange-500 font-medium">You</span></div>
        if (row.role === 'superadmin') return <div className="flex items-center gap-1">{viewBtn}{notifyBtn}</div>
        return (
          <div className="flex items-center gap-1">
            {viewBtn}
            {notifyBtn}
            <button
              onClick={(e) => { e.stopPropagation(); setEditAdmin(row) }}
              className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600"
              title="Edit permissions"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleMutation.mutate({ id, isActive: !row.isActive }) }}
              className="p-1.5 hover:bg-amber-50 rounded text-gray-400 hover:text-amber-600"
              title={row.isActive ? 'Deactivate' : 'Activate'}
            >
              {row.isActive ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteAdmin(row) }}
              className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Admin Users"
        description="Create admin accounts and control exactly what each admin can access"
        actions={
          <Button icon={Plus} onClick={() => setShowCreate(true)}>
            Add Admin
          </Button>
        }
      />

      {/* Role summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {
            role: 'Superadmin',
            desc: 'Full control of the entire platform. Can create and manage all other admins.',
            count: admins.filter(a => a.role === 'superadmin').length,
            color: 'border-orange-200 bg-orange-50',
            badge: 'text-orange-700 bg-orange-100',
            permissions: 'All 10 permissions',
          },
          {
            role: 'Headmaster',
            desc: 'Manages day-to-day operations. Cannot manage payments or create admins.',
            count: admins.filter(a => a.role === 'headmaster').length,
            color: 'border-orange-200 bg-orange-50',
            badge: 'text-orange-700 bg-orange-100',
            permissions: '8 of 10 permissions',
          },
          {
            role: 'Moderator',
            desc: 'Front-line support staff. Handles users, drivers, documents and tickets only.',
            count: admins.filter(a => a.role === 'moderator').length,
            color: 'border-gray-200 bg-gray-50',
            badge: 'text-gray-700 bg-gray-100',
            permissions: '4 of 10 permissions',
          },
        ].map((item) => (
          <div key={item.role} className={`rounded-xl border p-4 ${item.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.badge}`}>{item.role}</span>
              <span className="text-xl font-bold text-gray-700">{item.count}</span>
            </div>
            <p className="text-xs text-gray-600 mb-1">{item.desc}</p>
            <p className="text-xs font-medium text-gray-500">{item.permissions}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200">
        {selected.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-50 bg-orange-50/40">
            <span className="text-sm font-medium text-gray-700">{selected.length} selected</span>
            <button onClick={() => setSelected([])} className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1">
              <X className="h-3 w-3" /> Clear
            </button>
            <div className="ml-auto">
              <Button size="sm" icon={Send} onClick={() => setNotify({ recipients: selected })}>
                Send notification
              </Button>
            </div>
          </div>
        )}
        <DataTable
          columns={columns}
          data={admins}
          isLoading={isLoading}
          onRowClick={setViewAdmin}
          emptyTitle="No admins found"
          emptyDesc="Create your first admin account"
          selectable
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAllOnPage}
        />
      </div>

      {/* Create Admin Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Admin Account" size="lg">
        <CreateAdminForm
          onSubmit={(values) => createMutation.mutate(values)}
          loading={createMutation.isPending}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {/* Admin Detail Modal */}
      {viewAdmin && (
        <Modal open={!!viewAdmin} onClose={() => setViewAdmin(null)} title="Admin Details" size="lg">
          <AdminDetail
            admin={viewAdmin}
            isSelf={viewAdmin._id === currentAdmin?._id}
            canManage={viewAdmin.role !== 'superadmin' && viewAdmin._id !== currentAdmin?._id}
            onEditProfile={() => { setEditProfile(true); setViewAdmin(null) }}
            onEdit={() => { setEditAdmin(viewAdmin); setViewAdmin(null) }}
            onToggle={() => { toggleMutation.mutate({ id: viewAdmin._id, isActive: !viewAdmin.isActive }); setViewAdmin(null) }}
            onDelete={() => { setDeleteAdmin(viewAdmin); setViewAdmin(null) }}
          />
        </Modal>
      )}

      {/* Edit My Profile Modal */}
      {editProfile && (
        <Modal open={editProfile} onClose={() => setEditProfile(false)} title="Edit My Profile" size="md">
          <ProfileEditForm
            admin={currentAdmin}
            loading={profileMutation.isPending}
            onCancel={() => setEditProfile(false)}
            onSubmit={(values) => profileMutation.mutate(values)}
          />
        </Modal>
      )}

      {/* Edit Permissions Modal */}
      {editAdmin && (
        <Modal open={!!editAdmin} onClose={() => setEditAdmin(null)} title="Configure Permissions" size="xl">
          <EditPermissionsForm
            admin={editAdmin}
            onSubmit={(permissions) => updateMutation.mutate({ id: editAdmin._id, data: { permissions } })}
            loading={updateMutation.isPending}
            onCancel={() => setEditAdmin(null)}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteAdmin}
        onClose={() => setDeleteAdmin(null)}
        onConfirm={() => deleteMutation.mutate(deleteAdmin._id)}
        loading={deleteMutation.isPending}
        title="Delete Admin"
        message={`Are you sure you want to delete ${deleteAdmin?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      <SendNotificationModal
        open={!!notify}
        onClose={() => setNotify(null)}
        recipientType="admins"
        recipients={notify?.recipients || []}
        onSent={() => setSelected([])}
      />
    </div>
  )
}

function AdminDetail({ admin, isSelf, canManage, onEditProfile, onEdit, onToggle, onDelete }) {
  const isSuper = admin.role === 'superadmin'
  const enabledCount = isSuper ? PERMISSIONS.length : PERMISSIONS.filter((p) => admin.permissions?.[p.key]).length

  const ROLE_DESC = {
    superadmin: 'Full control of the entire platform. Can create and manage all other admins.',
    headmaster: 'Manages day-to-day operations. Cannot manage payments or create admins.',
    moderator: 'Front-line support staff. Handles users, drivers, documents and tickets only.',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl border border-orange-100">
        <Avatar src={admin.avatarUrl} name={admin.name} size="lg" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-lg">{admin.name}</p>
            <StatusBadge status={admin.role} />
            <StatusBadge status={admin.isActive ? 'active' : 'suspended'} />
            {isSelf && <span className="text-xs text-orange-600 font-medium">(You)</span>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{ROLE_DESC[admin.role] || ''}</p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-2xl font-bold text-orange-600">{enabledCount}</p>
          <p className="text-xs text-gray-400">of {PERMISSIONS.length} permissions</p>
        </div>
      </div>

      {/* Contact / meta */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Mail, label: 'Email', value: admin.email },
          { icon: Phone, label: 'Phone', value: admin.phone },
          { icon: Clock, label: 'Last Login', value: admin.lastLoginAt ? formatRelative(admin.lastLoginAt) : 'Never' },
          { icon: Calendar, label: 'Created', value: formatDate(admin.createdAt) },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
            <div className="rounded-lg p-2 bg-gray-50 text-gray-500 shrink-0">
              <row.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">{row.label}</p>
              <p className="text-sm font-medium text-gray-800 truncate">{row.value || '-'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Permissions */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Permissions {isSuper && <span className="text-orange-600 normal-case font-medium">(Full access - all permissions)</span>}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PERMISSIONS.map((perm) => {
            const enabled = isSuper || !!admin.permissions?.[perm.key]
            return (
              <div
                key={perm.key}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  enabled ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-gray-50 opacity-60'
                }`}
              >
                <div className={`rounded-lg p-1.5 shrink-0 ${ICON_COLORS[perm.color]}`}>
                  <perm.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{perm.label}</p>
                </div>
                {enabled
                  ? <CheckCircle className="h-4 w-4 text-orange-500 shrink-0" />
                  : <XCircle className="h-4 w-4 text-gray-300 shrink-0" />
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      {isSelf && (
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button icon={Edit} className="flex-1" onClick={onEditProfile}>Edit My Profile</Button>
        </div>
      )}
      {canManage && (
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" icon={Edit} className="flex-1" onClick={onEdit}>Edit Permissions</Button>
          <Button variant="warning" icon={admin.isActive ? ToggleLeft : ToggleRight} onClick={onToggle}>
            {admin.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="danger" icon={Trash2} onClick={onDelete}>Delete</Button>
        </div>
      )}
    </div>
  )
}

function ProfileEditForm({ admin, loading, onCancel, onSubmit }) {
  const profileSchema = z.object({
    name: z.string().min(2, 'Name required'),
    email: z.string().email('Invalid email'),
    phone: z.string().min(10, 'Invalid phone'),
    currentPassword: z.string().optional().or(z.literal('')),
    newPassword: z.string().optional().or(z.literal('')),
  }).refine((d) => !d.newPassword || d.newPassword.length >= 6, {
    message: 'New password must be at least 6 characters', path: ['newPassword'],
  }).refine((d) => !d.newPassword || !!d.currentPassword, {
    message: 'Enter your current password to change it', path: ['currentPassword'],
  })

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: admin?.name || '', email: admin?.email || '', phone: admin?.phone || '', currentPassword: '', newPassword: '' },
  })

  const submit = handleSubmit((values) => {
    const payload = { name: values.name, email: values.email, phone: values.phone }
    if (values.newPassword) {
      payload.currentPassword = values.currentPassword
      payload.newPassword = values.newPassword
    }
    onSubmit(payload)
  })

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Full Name" error={errors.name?.message} {...register('name')} />
        <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
      </div>
      <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />

      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Change Password (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Current Password" type="password" placeholder="••••••••" error={errors.currentPassword?.message} {...register('currentPassword')} />
          <Input label="New Password" type="password" placeholder="Min 6 characters" error={errors.newPassword?.message} {...register('newPassword')} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={loading}>Save Changes</Button>
      </div>
    </form>
  )
}

function CreateAdminForm({ onSubmit, loading, onCancel }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'moderator' },
  })
  const selectedRole = watch('role')
  const [perms, setPerms] = useState(ROLE_PRESETS.moderator)
  const [step, setStep] = useState(1) // 1 = details, 2 = permissions

  const handleRoleChange = (e) => {
    const role = e.target.value
    setValue('role', role)
    if (ROLE_PRESETS[role]) setPerms({ ...ROLE_PRESETS[role] })
  }

  const togglePerm = (key) => setPerms((p) => ({ ...p, [key]: !p[key] }))
  const allowedCount = PERMISSIONS.filter((p) => perms[p.key]).length

  const handleFinalSubmit = handleSubmit((values) => {
    onSubmit({ ...values, permissions: perms })
  })

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[{ n: 1, label: 'Account Details' }, { n: 2, label: 'Set Permissions' }].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              step >= n ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-400'
            }`}>{n}</div>
            <span className={`text-sm font-medium ${step >= n ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
            {n < 2 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-orange-600' : 'bg-gray-100'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name" placeholder="John Doe" error={errors.name?.message} {...register('name')} />
            <Input label="Phone" placeholder="9800000000" error={errors.phone?.message} {...register('phone')} />
          </div>
          <Input label="Email" type="email" placeholder="admin@tempu.com" error={errors.email?.message} {...register('email')} />
          <Input label="Password" type="password" placeholder="Min 6 characters" error={errors.password?.message} {...register('password')} />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'headmaster', label: 'Headmaster', desc: 'Operations manager', count: 8 },
                { value: 'moderator', label: 'Moderator', desc: 'Support staff', count: 4 },
              ].map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedRole === r.value ? 'border-orange-500' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input type="radio" value={r.value} className="mt-0.5" {...register('role')} onChange={handleRoleChange} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                    <p className="text-xs text-gray-500">{r.desc}</p>
                    <p className="text-xs text-orange-600 font-medium mt-0.5">{r.count} default permissions</p>
                  </div>
                </label>
              ))}
            </div>
            {errors.role && <p className="text-xs text-red-500">{errors.role.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => handleSubmit(() => setStep(2))()}
            >
              Next: Set Permissions →
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Choose what this admin can access</p>
              <p className="text-xs text-gray-400">{allowedCount} of {PERMISSIONS.length} permissions enabled</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setPerms(Object.fromEntries(PERMISSIONS.map(p => [p.key, true]))) }} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">All ON</button>
              <button onClick={() => { setPerms(Object.fromEntries(PERMISSIONS.map(p => [p.key, false]))) }} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">All OFF</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto scrollbar-thin pr-1">
            {PERMISSIONS.map((perm) => {
              const enabled = !!perms[perm.key]
              return (
                <button
                  key={perm.key}
                  type="button"
                  onClick={() => togglePerm(perm.key)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    enabled ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className={`rounded-lg p-2 shrink-0 ${ICON_COLORS[perm.color]}`}>
                    <perm.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{perm.label}</p>
                    <p className="text-xs text-gray-500">{perm.description}</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full shrink-0 relative transition-colors ${enabled ? 'bg-orange-600' : 'bg-gray-200'}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>← Back</Button>
            <Button type="button" className="flex-1" loading={loading} onClick={handleFinalSubmit}>
              Create Admin ({allowedCount} permissions)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function EditPermissionsForm({ admin, onSubmit, loading, onCancel }) {
  const [perms, setPerms] = useState({ ...admin.permissions })
  const [activePreset, setActivePreset] = useState('custom')

  const applyPreset = (preset) => {
    if (ROLE_PRESETS[preset]) {
      setPerms({ ...ROLE_PRESETS[preset] })
      setActivePreset(preset)
    }
  }

  const toggle = (key) => {
    setPerms((p) => ({ ...p, [key]: !p[key] }))
    setActivePreset('custom')
  }

  const allowedCount = PERMISSIONS.filter((p) => perms[p.key]).length

  return (
    <div className="space-y-5">
      {/* Admin info */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <Avatar name={admin.name} size="md" />
        <div>
          <p className="font-semibold text-gray-900">{admin.name}</p>
          <p className="text-sm text-gray-500">{admin.email}</p>
          <StatusBadge status={admin.role} />
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-orange-600">{allowedCount}</p>
          <p className="text-xs text-gray-400">of {PERMISSIONS.length} permissions</p>
        </div>
      </div>

      {/* Preset buttons */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Presets</p>
        <div className="flex gap-2">
          {[
            { key: 'headmaster', label: 'Headmaster Default', count: 8 },
            { key: 'moderator', label: 'Moderator Default', count: 4 },
          ].map((preset) => (
            <button
              key={preset.key}
              onClick={() => applyPreset(preset.key)}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                activePreset === preset.key
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {preset.label}
              <span className="ml-1 text-xs opacity-60">({preset.count} on)</span>
            </button>
          ))}
          <button
            onClick={() => { setPerms(Object.fromEntries(PERMISSIONS.map(p => [p.key, true]))); setActivePreset('custom') }}
            className="py-2 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            All ON
          </button>
          <button
            onClick={() => { setPerms(Object.fromEntries(PERMISSIONS.map(p => [p.key, false]))); setActivePreset('custom') }}
            className="py-2 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            All OFF
          </button>
        </div>
      </div>

      {/* Permission cards */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Individual Permissions</p>
        <div className="grid grid-cols-2 gap-3">
          {PERMISSIONS.map((perm) => {
            const enabled = !!perms[perm.key]
            return (
              <button
                key={perm.key}
                onClick={() => toggle(perm.key)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  enabled
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-gray-100 bg-gray-50 opacity-60 hover:opacity-80'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`rounded-lg p-1.5 ${ICON_COLORS[perm.color]}`}>
                    <perm.icon className="h-4 w-4" />
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${enabled ? 'bg-orange-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">{perm.label}</p>
                <p className="text-xs text-gray-500 mb-2">{perm.description}</p>
                <div className="space-y-0.5">
                  {perm.allows.map((a) => (
                    <div key={a} className="flex items-center gap-1.5">
                      {enabled
                        ? <CheckCircle className="h-3 w-3 text-orange-500 shrink-0" />
                        : <XCircle className="h-3 w-3 text-gray-300 shrink-0" />
                      }
                      <span className={`text-xs ${enabled ? 'text-gray-600' : 'text-gray-400'}`}>{a}</span>
                    </div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-1">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" loading={loading} onClick={() => onSubmit(perms)}>
          Save Permissions ({allowedCount} enabled)
        </Button>
      </div>
    </div>
  )
}
