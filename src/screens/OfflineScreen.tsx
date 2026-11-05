import { Fragment, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, ClipboardList, Plus, Trash2, Trophy, X } from 'lucide-react'
import { PointsHistogram } from '../components/PointsHistogram'

const STORAGE_KEY = 'tos.offlineRooms'

interface OfflinePlayer {
  id: string
  name: string
}

interface OfflineRow {
  id: string
  bid: string
  scores: Record<string, string>
  bidderId: string
  made: boolean
}

interface OfflineRoom {
  id: string
  name: string
  players: OfflinePlayer[]
  rows: OfflineRow[]
}

function blankRow(players: OfflinePlayer[]): OfflineRow {
  return {
    id: crypto.randomUUID(),
    bid: '',
    scores: Object.fromEntries(players.map((p) => [p.id, ''])),
    bidderId: '',
    made: true,
  }
}

function loadRooms(): OfflineRoom[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OfflineRoom[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((room) => ({
      ...room,
      rows: room.rows.map((row) => enforceBidderScore(row).row),
    }))
  } catch {
    return []
  }
}

function parseNumber(value: string): number | null {
  const text = value.trim()
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function rowHasEntry(row: OfflineRow) {
  return parseNumber(row.bid) !== null || Object.values(row.scores).some((score) => parseNumber(score) !== null)
}

/** Made: bidder scores 2× the bid. Failed: bidder scores the negative bid. */
function reservedBidderScore(row: OfflineRow): number | null {
  if (!row.bidderId) return null
  const bid = parseNumber(row.bid)
  if (bid === null) return null
  return row.made ? bid * 2 : -bid
}

function enforceBidderScore(row: OfflineRow): { row: OfflineRow; cleared: boolean } {
  const reserved = reservedBidderScore(row)
  if (reserved === null || !row.bidderId) return { row, cleared: false }
  const scores = { ...row.scores, [row.bidderId]: String(reserved) }
  let cleared = false
  for (const id of Object.keys(scores)) {
    if (id === row.bidderId) continue
    if (parseNumber(scores[id] ?? '') === reserved) {
      scores[id] = ''
      cleared = true
    }
  }
  return { row: { ...row, scores }, cleared }
}

function bestName(counts: Map<string, number>, players: OfflinePlayer[]) {
  if (counts.size === 0) return '—'
  let winner = ''
  let best = -Infinity
  for (const [id, count] of counts) {
    if (count > best) {
      best = count
      winner = id
    }
  }
  return players.find((p) => p.id === winner)?.name || '—'
}

export function OfflineScreen({ onClose }: { onClose: () => void }) {
  const [rooms, setRooms] = useState<OfflineRoom[]>(loadRooms)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [roomName, setRoomName] = useState('')
  const [playerNames, setPlayerNames] = useState(['', '', '', '', ''])
  const [error, setError] = useState('')
  const [rowNotes, setRowNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms))
  }, [rooms])

  const active = rooms.find((room) => room.id === activeId) ?? null

  const stats = useMemo(() => {
    if (!active) return null
    const hands = active.rows.filter(rowHasEntry)
    const totals = Object.fromEntries(active.players.map((p) => [p.id, 0]))
    const made = new Map<string, number>()
    const failed = new Map<string, number>()
    let bestBid: { amount: number; bidder: string } | null = null

    for (const row of hands) {
      for (const player of active.players) {
        const score = parseNumber(row.scores[player.id] ?? '')
        if (score !== null) totals[player.id] += score
      }
      const bid = parseNumber(row.bid)
      if (bid !== null && (bestBid === null || bid > bestBid.amount)) {
        bestBid = {
          amount: bid,
          bidder: active.players.find((p) => p.id === row.bidderId)?.name ?? '—',
        }
      }
      if (row.bidderId) {
        const bucket = row.made ? made : failed
        bucket.set(row.bidderId, (bucket.get(row.bidderId) ?? 0) + 1)
      }
    }

    const leaderboard = active.players
      .map((player) => ({ name: player.name, score: totals[player.id] ?? 0 }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

    return {
      gamesPlayed: hands.length,
      bestBid,
      bestBidder: bestName(made, active.players),
      worstBidder: bestName(failed, active.players),
      leaderboard,
    }
  }, [active])

  function createRoom() {
    const name = roomName.trim()
    const players = playerNames.map((n) => n.trim()).filter(Boolean)
    if (!name) {
      setError('Give the room a name.')
      return
    }
    if (players.length < 2) {
      setError('Add at least two players.')
      return
    }
    if (new Set(players.map((n) => n.toLowerCase())).size !== players.length) {
      setError('Player names need to be different.')
      return
    }
    const seated: OfflinePlayer[] = players.map((player) => ({ id: crypto.randomUUID(), name: player }))
    const room: OfflineRoom = {
      id: crypto.randomUUID(),
      name,
      players: seated,
      rows: Array.from({ length: 8 }, () => blankRow(seated)),
    }
    setRooms((current) => [room, ...current])
    setActiveId(room.id)
    setRoomName('')
    setPlayerNames(['', '', '', '', ''])
    setError('')
  }

  function updateRoom(id: string, patch: (room: OfflineRoom) => OfflineRoom) {
    setRooms((current) => current.map((room) => (room.id === id ? patch(room) : room)))
  }

  function updateRow(roomId: string, rowId: string, patch: Partial<OfflineRow>) {
    const room = rooms.find((item) => item.id === roomId)
    const row = room?.rows.find((item) => item.id === rowId)
    if (!room || !row) return
    const merged: OfflineRow = { ...row, ...patch, scores: patch.scores ?? row.scores }
    const reserved = reservedBidderScore(merged)
    const { row: next, cleared } = enforceBidderScore(merged)
    const bidder = room.players.find((player) => player.id === next.bidderId)?.name ?? 'The bidder'
    const note =
      cleared && reserved !== null
        ? next.made
          ? `Only ${bidder} can have ${reserved} when the bid is made.`
          : `Only ${bidder} can have ${reserved} when the bid fails.`
        : ''
    setRowNotes((current) => ({ ...current, [rowId]: note }))
    updateRoom(roomId, (current) => ({
      ...current,
      rows: current.rows.map((item) => (item.id === rowId ? next : item)),
    }))
  }

  function openRoom(id: string) {
    setRooms((current) =>
      current.map((room) =>
        room.id === id ? { ...room, rows: room.rows.map((row) => enforceBidderScore(row).row) } : room,
      ),
    )
    setActiveId(id)
  }

  function changeScore(row: OfflineRow, playerId: string, value: string) {
    const reserved = reservedBidderScore(row)
    if (playerId !== row.bidderId && reserved !== null && parseNumber(value) === reserved) {
      const bidder = active?.players.find((player) => player.id === row.bidderId)?.name ?? 'The bidder'
      const note = row.made
        ? `Only ${bidder} can have ${reserved} when the bid is made.`
        : `Only ${bidder} can have ${reserved} when the bid fails.`
      setRowNotes((current) => ({ ...current, [row.id]: note }))
      return
    }
    updateRow(active!.id, row.id, { scores: { ...row.scores, [playerId]: value } })
  }

  return (
    <div className="app-bg fixed inset-0 z-[80] flex flex-col text-[color:var(--color-ink)]">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {active && (
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="rounded-full border border-white/10 p-2 hover:bg-white/5"
              aria-label="Back to offline rooms"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-xs tracking-[0.25em] text-[color:var(--color-gold)] uppercase">Offline</p>
            <h2 className="truncate font-display text-3xl text-[color:var(--color-gold)]">
              {active ? active.name : 'New room'}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 p-2 hover:bg-white/10"
          aria-label="Close offline"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {!active ? (
        <div className="mx-auto w-full max-w-xl overflow-auto px-4 py-8">
          <form
            className="rounded-3xl border border-white/10 bg-black/25 p-6"
            onSubmit={(e) => {
              e.preventDefault()
              createRoom()
            }}
          >
            <div className="mb-4 flex items-center gap-2 font-medium">
              <Plus className="h-4 w-4 text-[color:var(--color-gold)]" /> Create offline room
            </div>
            <label className="mb-4 block text-sm">
              Room name
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-[color:var(--color-gold)]"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Friday table"
              />
            </label>
            <div className="mb-2 text-sm">Players</div>
            <div className="mb-4 space-y-2">
              {playerNames.map((name, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-[color:var(--color-gold)]"
                    value={name}
                    placeholder={`Player ${index + 1}`}
                    onChange={(e) =>
                      setPlayerNames((current) => current.map((item, i) => (i === index ? e.target.value : item)))
                    }
                  />
                  {playerNames.length > 2 && (
                    <button
                      type="button"
                      className="rounded-xl border border-white/10 px-3 hover:bg-white/5"
                      onClick={() => setPlayerNames((current) => current.filter((_, i) => i !== index))}
                      aria-label={`Remove player ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {playerNames.length < 8 && (
              <button
                type="button"
                className="mb-4 text-sm text-[color:var(--color-gold)]"
                onClick={() => setPlayerNames((current) => [...current, ''])}
              >
                Add player
              </button>
            )}
            {error && <p className="mb-3 text-sm text-[color:var(--color-danger)]">{error}</p>}
            <button className="rounded-xl bg-[color:var(--color-gold)] px-4 py-2 font-semibold text-black">
              Create room
            </button>
          </form>

          {rooms.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm text-[color:var(--color-muted)]">Saved on this browser</h3>
              <div className="space-y-2">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => openRoom(room.id)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left hover:bg-white/5"
                  >
                    <span>{room.name}</span>
                    <span className="text-sm text-[color:var(--color-muted)]">
                      {room.players.length} players · {room.rows.filter(rowHasEntry).length} hands
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section className="flex min-h-0 flex-[3] flex-col border-white/10 lg:border-r">
            <div className="flex items-center justify-between px-4 py-3 sm:px-5">
              <h3 className="flex items-center gap-2 font-medium">
                <ClipboardList className="h-4 w-4 text-[color:var(--color-gold)]" /> Score sheet
              </h3>
              <button
                type="button"
                className="rounded-xl border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
                onClick={() =>
                  updateRoom(active.id, (room) => ({ ...room, rows: [...room.rows, blankRow(room.players)] }))
                }
              >
                Add hand
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 sm:px-5">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[color:var(--color-muted)]">
                    <th className="sticky top-0 bg-[#082017] px-2 py-2 font-medium">#</th>
                    <th className="sticky top-0 bg-[#082017] px-2 py-2 font-medium">Bid amount</th>
                    {active.players.map((player) => (
                      <th key={player.id} className="sticky top-0 bg-[#082017] px-2 py-2 font-medium">
                        {player.name}
                      </th>
                    ))}
                    <th className="sticky top-0 bg-[#082017] px-2 py-2 font-medium">Bidder</th>
                    <th className="sticky top-0 bg-[#082017] px-2 py-2 font-medium">Result</th>
                    <th className="sticky top-0 bg-[#082017] px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {active.rows.map((row, index) => {
                    const reserved = reservedBidderScore(row)
                    const columnCount = active.players.length + 5
                    return (
                    <Fragment key={row.id}>
                    <tr className="border-t border-white/10">
                      <td className="px-2 py-1.5 text-[color:var(--color-muted)]">{index + 1}</td>
                      <td className="px-2 py-1.5">
                        <input
                          inputMode="numeric"
                          className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[color:var(--color-gold)]"
                          value={row.bid}
                          onChange={(e) => updateRow(active.id, row.id, { bid: e.target.value })}
                        />
                      </td>
                      {active.players.map((player) => {
                        const locked = player.id === row.bidderId && reserved !== null
                        const raw = row.scores[player.id] ?? ''
                        const takenByBidder = !locked && reserved !== null && parseNumber(raw) === reserved
                        return (
                        <td key={player.id} className="px-2 py-1.5">
                          <input
                            inputMode="numeric"
                            readOnly={locked}
                            title={
                              locked
                                ? row.made
                                  ? 'Bidder scores twice the bid'
                                  : 'Bidder scores the negative bid'
                                : undefined
                            }
                            className={`w-20 rounded-lg border px-2 py-1.5 outline-none focus:border-[color:var(--color-gold)] ${
                              locked
                                ? 'border-[color:var(--color-gold)]/50 bg-[color:var(--color-gold)]/10'
                                : 'border-white/10 bg-white/5'
                            }`}
                            value={locked ? String(reserved) : takenByBidder ? '' : raw}
                            onChange={(e) => changeScore(row, player.id, e.target.value)}
                          />
                        </td>
                        )
                      })}
                      <td className="px-2 py-1.5">
                        <select
                          className="rounded-lg border border-white/10 bg-[#0b241c] px-2 py-1.5"
                          value={row.bidderId}
                          onChange={(e) => updateRow(active.id, row.id, { bidderId: e.target.value })}
                        >
                          <option value="">—</option>
                          {active.players.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                            row.made
                              ? 'bg-[color:var(--color-gold)] text-black'
                              : 'bg-[color:var(--color-danger)] text-white'
                          }`}
                          onClick={() => updateRow(active.id, row.id, { made: !row.made })}
                        >
                          {row.made ? 'Made' : 'Failed'}
                        </button>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-[color:var(--color-muted)] hover:bg-white/10 hover:text-white"
                          aria-label={`Delete hand ${index + 1}`}
                          onClick={() =>
                            updateRoom(active.id, (room) => ({
                              ...room,
                              rows: room.rows.filter((item) => item.id !== row.id),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {rowNotes[row.id] && (
                      <tr>
                        <td colSpan={columnCount} className="px-2 pb-2 text-xs text-[color:var(--color-danger)]">
                          {rowNotes[row.id]}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="min-h-0 flex-[2] overflow-auto bg-black/20 p-4 sm:p-6">
            {stats && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <h3 className="mb-4 flex items-center gap-2 font-medium">
                    <Trophy className="h-4 w-4 text-[color:var(--color-gold)]" /> Room stats
                  </h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>Games played</div>
                    <div>{stats.gamesPlayed}</div>
                    <div>Best bid</div>
                    <div>
                      {stats.bestBid ? `${stats.bestBid.amount} · ${stats.bestBid.bidder}` : '—'}
                    </div>
                    <div>Best bidder</div>
                    <div>{stats.bestBidder}</div>
                    <div>Worst bidder</div>
                    <div>{stats.worstBidder}</div>
                  </dl>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <h3 className="mb-4 font-medium">Leaderboard</h3>
                  <ol className="space-y-2">
                    {stats.leaderboard.map((row, i) => (
                      <li key={row.name} className="flex justify-between text-sm">
                        <span>
                          {i + 1}. {row.name}
                        </span>
                        <span className="text-[color:var(--color-gold)]">
                          {row.score > 0 ? '+' : ''}
                          {row.score}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <h3 className="mb-5 flex items-center gap-2 font-medium">
                    <BarChart3 className="h-4 w-4 text-[color:var(--color-gold)]" /> Points histogram
                  </h3>
                  {stats.gamesPlayed === 0 ? (
                    <p className="text-sm text-[color:var(--color-muted)]">
                      Enter a bid or a score to see points by player.
                    </p>
                  ) : (
                    <PointsHistogram rows={stats.leaderboard} />
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
