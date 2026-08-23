import {
  Archive,
  ArrowLeft,
  BarChart3,
  Crown,
  History,
  Play,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import { SUIT_SYMBOL } from '../lib/cards'
import { useApp } from '../state/AppProvider'

export function RoomLobby() {
  const {
    user,
    activeRoom,
    roomTab,
    setRoomTab,
    backToRooms,
    toggleReady,
    fillBots,
    startGame,
    kick,
    transferOwner,
    archiveRoom,
    leaveRoom,
  } = useApp()

  if (!user) return null
  if (!activeRoom) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-[color:var(--color-muted)]">
        Loading room…
      </div>
    )
  }
  const you = activeRoom.members.find((m) => m.id.toLowerCase() === user.id.toLowerCase())
  const isOwner = activeRoom.ownerId.toLowerCase() === user.id.toLowerCase()
  const n = activeRoom.members.length
  const canStart =
    isOwner && n >= 5 && n <= 8 && activeRoom.members.every((m) => m.online && m.ready)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <button
        onClick={backToRooms}
        className="mb-6 flex items-center gap-2 text-sm text-[color:var(--color-muted)] hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> All rooms
      </button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-[color:var(--color-gold)] sm:text-5xl">{activeRoom.name}</h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            Playing as {user.name}
            {user.email ? ` · ${user.email}` : ''}
          </p>
          <p className="mt-1 text-sm tracking-[0.25em] text-[color:var(--color-muted)]">
            CODE {activeRoom.code} · MAX 8 
          </p>
        </div>
        <div className="flex gap-2">
          {['lobby', 'history', 'stats'].map((tab) => (
            <button
              key={tab}
              onClick={() => setRoomTab(tab as typeof roomTab)}
              className={`rounded-full px-4 py-2 text-sm capitalize ${
                roomTab === tab
                  ? 'bg-[color:var(--color-gold)] text-black'
                  : 'border border-white/10 text-[color:var(--color-muted)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {roomTab === 'lobby' && (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-medium">
                <Users className="h-4 w-4" /> Members
              </h2>
              <span className="text-sm text-[color:var(--color-muted)]">{n}/8</span>
            </div>
            <div className="space-y-2">
              {activeRoom.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {m.isOwner && <Crown className="h-4 w-4 text-[color:var(--color-gold)]" />}
                      <span>{m.name}</span>
                      {m.id.toLowerCase() === user.id.toLowerCase() && (
                        <span className="text-xs text-[color:var(--color-gold)]">you</span>
                      )}
                    </div>
                    <div className="text-xs text-[color:var(--color-muted)]">
                      {m.online ? 'Online' : 'Offline'} · {m.ready ? 'Ready' : 'Not ready'}
                    </div>
                  </div>
                  {isOwner && m.id.toLowerCase() !== user.id.toLowerCase() && (
                    <div className="flex gap-2">
                      {!m.isBot && (
                        <button
                          className="text-xs text-[color:var(--color-muted)] hover:text-white"
                          onClick={() => transferOwner(m.id)}
                        >
                          Transfer
                        </button>
                      )}
                      <button
                        className="text-xs text-[color:var(--color-danger)]"
                        onClick={() => kick(m.id)}
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={toggleReady}
              className={`w-full rounded-2xl py-3 font-semibold ${
                you?.ready
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[color:var(--color-gold)] text-black'
              }`}
            >
              {you?.ready ? 'Ready' : 'Click to ready up'}
            </button>
            {isOwner && n < 6 && (
              <button
                onClick={fillBots}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3"
              >
                <UserPlus className="h-4 w-4" /> Fill table with dummy players
              </button>
            )}
            <button
              onClick={startGame}
              disabled={!canStart}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 font-semibold text-black disabled:opacity-40"
            >
              <Play className="h-4 w-4" /> Start game
            </button>
            {!isOwner && (
              <p className="text-xs text-[color:var(--color-muted)]">
                Only the room owner can start. Share the room code so friends can join.
              </p>
            )}
            {isOwner && (
              <p className="text-xs text-[color:var(--color-muted)]">
                Starts only with 5–8 players, everyone online and ready. No spectators, no late
                joins.
              </p>
            )}
            {isOwner && (
              <button
                onClick={archiveRoom}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-sm text-[color:var(--color-muted)]"
              >
                <Archive className="h-4 w-4" /> Archive room
              </button>
            )}
            <button
              onClick={leaveRoom}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-sm text-[color:var(--color-muted)]"
            >
              Leave room
            </button>
          </div>
        </div>
      )}

      {roomTab === 'history' && (
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-sm">
            <History className="h-4 w-4" /> Completed games
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-[color:var(--color-muted)]">
              <tr>
                <th className="px-5 py-3 font-normal">When</th>
                <th className="px-5 py-3 font-normal">Bidder</th>
                <th className="px-5 py-3 font-normal">Bid</th>
                <th className="px-5 py-3 font-normal">Cut</th>
                <th className="px-5 py-3 font-normal">Team</th>
                <th className="px-5 py-3 font-normal">You</th>
              </tr>
            </thead>
            <tbody>
              {activeRoom.history.map((g) => (
                <tr key={g.id} className="border-t border-white/5">
                  <td className="px-5 py-3 text-[color:var(--color-muted)]">
                    {new Date(g.playedAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">{g.bidder}</td>
                  <td className="px-5 py-3">{g.bid}</td>
                  <td className="px-5 py-3">{SUIT_SYMBOL[g.trump]}</td>
                  <td className="px-5 py-3">
                    {g.teamPoints} {g.success ? 'made' : 'failed'}
                  </td>
                  <td className={`px-5 py-3 ${g.yourScore >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {g.yourScore > 0 ? '+' : ''}
                    {g.yourScore}
                  </td>
                </tr>
              ))}
              {activeRoom.history.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-[color:var(--color-muted)]" colSpan={6}>
                    No completed games yet. Finish a hand to see it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {roomTab === 'stats' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
            <h3 className="mb-4 flex items-center gap-2 font-medium">
              <Trophy className="h-4 w-4 text-[color:var(--color-gold)]" /> Room stats
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>Games played</div>
              <div>{activeRoom.stats.gamesPlayed}</div>
              <div>Best bidder</div>
              <div>{activeRoom.stats.bestBidder}</div>
              <div>Worst bidder</div>
              <div>{activeRoom.stats.worstBidder}</div>
              <div>Best buddy</div>
              <div>{activeRoom.stats.bestBuddy}</div>
              <div>Worst buddy</div>
              <div>{activeRoom.stats.worstBuddy}</div>
            </dl>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
            <h3 className="mb-4 font-medium">Leaderboard</h3>
            <ol className="space-y-2">
              {activeRoom.stats.leaderboard.length === 0 && (
                <li className="text-sm text-[color:var(--color-muted)]">No scores yet.</li>
              )}
              {activeRoom.stats.leaderboard.map((row, i) => (
                <li key={row.name} className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {row.name}
                  </span>
                  <span className="text-[color:var(--color-gold)]">{row.score}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 md:col-span-2">
            <h3 className="mb-5 flex items-center gap-2 font-medium">
              <BarChart3 className="h-4 w-4 text-[color:var(--color-gold)]" /> Points histogram
            </h3>
            {activeRoom.stats.leaderboard.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                Finish a hand to see points by player.
              </p>
            ) : (
              <PointsHistogram rows={activeRoom.stats.leaderboard} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PointsHistogram({ rows }: { rows: { name: string; score: number }[] }) {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.score)))
  const hasNeg = rows.some((r) => r.score < 0)
  return (
    <div className={`flex items-stretch gap-3 ${hasNeg ? 'h-64' : 'h-52'}`}>
      {rows.map((row) => {
        const pct = Math.max(6, (Math.abs(row.score) / maxAbs) * 100)
        const positive = row.score >= 0
        return (
          <div key={row.name} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="text-xs font-semibold text-[color:var(--color-gold)]">
              {row.score > 0 ? '+' : ''}
              {row.score}
            </div>
            <div className={`mt-2 flex w-full flex-1 ${hasNeg ? 'flex-col' : 'flex-col justify-end'}`}>
              {hasNeg ? (
                <>
                  <div className="flex h-1/2 items-end justify-center">
                    {positive && (
                      <div
                        className="w-[70%] max-w-[3.5rem] rounded-t-md bg-[color:var(--color-gold)]"
                        style={{ height: `${pct}%` }}
                      />
                    )}
                  </div>
                  <div className="h-px w-full bg-white/20" />
                  <div className="flex h-1/2 items-start justify-center">
                    {!positive && row.score !== 0 && (
                      <div
                        className="w-[70%] max-w-[3.5rem] rounded-b-md bg-[color:var(--color-danger)]"
                        style={{ height: `${pct}%` }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full items-end justify-center">
                  <div
                    className="w-[70%] max-w-[3.5rem] rounded-t-md bg-[color:var(--color-gold)]"
                    style={{ height: `${pct}%` }}
                  />
                </div>
              )}
            </div>
            <div className="mt-2 w-full truncate text-center text-xs text-[color:var(--color-muted)]" title={row.name}>
              {row.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
