import { useState } from 'react'
import { Archive, LogOut, Plus, Spade, Users } from 'lucide-react'
import { useApp } from '../state/AppProvider'

export function RoomsScreen() {
  const { user, rooms, logout, createRoom, joinRoom, openRoom } = useApp()
  const [name, setName] = useState('Late Night Table')
  const [code, setCode] = useState('')

  const live = rooms.filter((r) => !r.archived)
  const archived = rooms.filter((r) => r.archived)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Spade className="h-8 w-8 text-[color:var(--color-gold)]" fill="currentColor" />
          <div>
            <h1 className="font-display text-4xl text-[color:var(--color-gold)]">Rooms</h1>
            <p className="text-sm text-[color:var(--color-muted)]">Signed in as {user?.name}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </header>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <form
          className="rounded-2xl border border-white/10 bg-black/20 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            createRoom(name)
          }}
        >
          <div className="mb-3 flex items-center gap-2 font-medium">
            <Plus className="h-4 w-4 text-[color:var(--color-gold)]" /> Create room
          </div>
          <input
            className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="rounded-xl bg-[color:var(--color-gold)] px-4 py-2 font-semibold text-black">
            Create
          </button>
        </form>
        <form
          className="rounded-2xl border border-white/10 bg-black/20 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            joinRoom(code)
          }}
        >
          <div className="mb-3 font-medium">Join with room code</div>
          <input
            placeholder="SPADE3"
            className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 uppercase tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="rounded-xl border border-[color:var(--color-gold)] px-4 py-2 text-[color:var(--color-gold)]">
            Join
          </button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {live.map((room) => (
          <button
            key={room.id}
            onClick={() => openRoom(room.id)}
            className="rounded-2xl border border-white/10 bg-black/20 p-5 text-left hover:border-[color:var(--color-gold)]/50"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-2xl">{room.name}</h2>
                <p className="text-sm tracking-[0.2em] text-[color:var(--color-gold)]">{room.code}</p>
              </div>
              <span className="flex items-center gap-1 text-sm text-[color:var(--color-muted)]">
                <Users className="h-4 w-4" /> {room.members.length}/8
              </span>
            </div>
            <p className="text-sm text-[color:var(--color-muted)]">
              Persistent room · {room.history.length} games in history · Owner{' '}
              {room.members.find((m) => m.id === room.ownerId)?.name}
            </p>
          </button>
        ))}
      </div>

      {archived.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
            <Archive className="h-4 w-4" /> Archived
          </h3>
          <div className="space-y-2 text-sm text-[color:var(--color-muted)]">
            {archived.map((r) => (
              <div key={r.id}>
                {r.name} · {r.code} · history preserved
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
