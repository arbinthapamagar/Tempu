import { AlertTriangle } from '@/components/ui/icons'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }) {
  return (
    <Modal open={open} onClose={onClose} title="" size="xs">
      <div className="flex flex-col items-center text-center">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <div className={`rounded-full p-2 mt-3 ${variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
          <AlertTriangle className={`h-5 w-5 ${variant === 'danger' ? 'text-red-600' : 'text-amber-600'}`} />
        </div>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
      </div>
      <div className="mt-4 flex justify-center gap-14">
        <Button size="sm" variant="secondary" className="rounded-full" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button size="sm" variant={variant} className="rounded-full" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
