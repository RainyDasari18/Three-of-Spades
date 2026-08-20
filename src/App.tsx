import { AuthScreen } from './screens/AuthScreen'
import { GameTable } from './screens/GameTable'
import { RoomLobby } from './screens/RoomLobby'
import { RoomsScreen } from './screens/RoomsScreen'
import { AppProvider, useApp } from './state/AppProvider'

function Toasts() {
  const { toasts } = useApp()
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] space-y-2">
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

function Shell() {
  const { view } = useApp()
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
