import { Badge } from '../ui/Badge'

const STATUS_MAP = {
  active: { label: 'Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'warning' },
  banned: { label: 'Banned', variant: 'danger' },
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  started: { label: 'Started', variant: 'primary' },
  accepted: { label: 'Accepted', variant: 'info' },
  arriving: { label: 'Arriving', variant: 'info' },
  paid: { label: 'Paid', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
  refunded: { label: 'Refunded', variant: 'purple' },
  open: { label: 'Open', variant: 'warning' },
  in_progress: { label: 'In Progress', variant: 'info' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'default' },
  expired: { label: 'Expired', variant: 'default' },
  paused: { label: 'Paused', variant: 'warning' },
  verified: { label: 'Verified', variant: 'success' },
  online: { label: 'Online', variant: 'success' },
  offline: { label: 'Offline', variant: 'default' },
  superadmin: { label: 'Super Admin', variant: 'purple' },
  headmaster: { label: 'Headmaster', variant: 'info' },
  moderator: { label: 'Moderator', variant: 'default' },
  regular: { label: 'Regular', variant: 'default' },
  parent: { label: 'Parent', variant: 'info' },
  business: { label: 'Business', variant: 'purple' },
  cash: { label: 'Cash', variant: 'default' },
  khalti: { label: 'Khalti', variant: 'purple' },
  esewa: { label: 'eSewa', variant: 'success' },
  wallet: { label: 'Wallet', variant: 'info' },
}

export function StatusBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status || '-', variant: 'default' }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
