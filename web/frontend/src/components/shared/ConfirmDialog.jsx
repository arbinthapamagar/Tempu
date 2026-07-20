import { AlertTriangle } from '@/components/ui/icons'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="xs">
      <div className="flex flex-col items-center text-center">
        <div className={`rounded-full p-2.5 ${variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
          <AlertTriangle className={`h-5 w-5 ${variant === 'danger' ? 'text-red-600' : 'text-amber-600'}`} />
        </div>
        <p className="text-sm text-gray-600 mt-3">{message}</p>
      </div>
      <div className="mt-5 flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button size="sm" variant={variant} className="flex-1" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
