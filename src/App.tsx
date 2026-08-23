import { Spade } from 'lucide-react'
import { AuthScreen } from './screens/AuthScreen'
import { GameTable } from './screens/GameTable'
import { RoomLobby } from './screens/RoomLobby'
import { RoomsScreen } from './screens/RoomsScreen'
import { AppProvider, useApp } from './state/AppProvider'

function Toasts() {
  const { toasts } = useApp()
  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[60] space-y-2 md:inset-x-auto md:right-4 md:top-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rise rounded-2xl px-4 py-3 text-sm shadow-lg ${
            t.tone === 'danger'
              ? 'bg-red-900/90'
              : t.tone === 'info'
                ? 'bg-slate-800/90'
                : 'bg-[color:var(--color-gold)] text-black'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Spade className="h-10 w-10 text-[color:var(--color-gold)]" fill="currentColor" />
      <p className="font-display text-3xl text-[color:var(--color-gold)]">Three of Spades</p>
      <p className="text-sm text-[color:var(--color-muted)]">Restoring your session…</p>
    </div>
  )
}

function Shell() {
  const { view, booting } = useApp()
  if (booting) return <BootScreen />
  return (
    <>
      {view === 'auth' && <AuthScreen />}
      {view === 'rooms' && <RoomsScreen />}
      {view === 'room' && <RoomLobby />}
      {view === 'game' && <GameTable />}
      <Toasts />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
