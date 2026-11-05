import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { OfflineScreen } from '../screens/OfflineScreen'

export function OfflineButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
      >
        <ClipboardList className="h-4 w-4" /> Offline
      </button>
      {open && <OfflineScreen onClose={() => setOpen(false)} />}
    </>
  )
}
