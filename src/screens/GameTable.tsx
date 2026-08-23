import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Clock, Crown, Spade } from 'lucide-react'
import type { Card, PartnerCondition, Rank, Suit } from '../types'
import {
  SUIT_NAME,
  SUIT_SYMBOL,
  SUITS,
  conditionLabel,
  copiesInDeck,
  isRed,
  legalCards,
  partnerConditionCount,
  trickWinner,
} from '../lib/cards'
import { PlayingCard } from '../components/PlayingCard'
import { useApp } from '../state/AppProvider'

const RANK_PICK: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function seatStyle(indexFromHuman: number, total: number): CSSProperties {
  if (indexFromHuman === 0) {
    return { bottom: '1.5%', left: '50%', transform: 'translateX(-50%)' }
  }
  const t = indexFromHuman / total
  const angle = Math.PI * (1.12 - t * 1.04)
  const x = 50 + Math.cos(angle) * 38
  const y = 46 + Math.sin(angle) * -32
  return { left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }
}

export function GameTable() {
  const { game, placeBid, passBid, confirmSelection, playCard, finishToLobby, backToRooms } =
    useApp()

  const humanSeat = game?.players.find((p) => p.isHuman)?.seat ?? 0
  const prevPhase = useRef<string | null>(null)
  const [showCall, setShowCall] = useState(false)
  const [secsLeft, setSecsLeft] = useState<number | null>(null)
  const [heldTrick, setHeldTrick] = useState<{ seat: number; card: Card }[]>([])
  const [holdingTrick, setHoldingTrick] = useState(false)
  const heldKey = useRef('')
  const narrow = useNarrow()

  const order = useMemo(() => {
    if (!game) return []
    return game.players.map((_, i) => (humanSeat + i) % game.players.length)
  }, [game, humanSeat])

  useEffect(() => {
    if (!game) return
    const prev = prevPhase.current
    prevPhase.current = game.phase
    if (game.phase !== 'playing' || !game.trump) return
    if (prev !== 'selecting' && prev !== 'bidding') return
    setShowCall(true)
    const t = window.setTimeout(() => setShowCall(false), 5000)
    return () => window.clearTimeout(t)
    // Only when the phase changes — not on every live snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase])

  useEffect(() => {
    const ends = game?.turnEndsAt
    if (!ends || game.phase === 'complete' || game.phase === 'cancelled') {
      setSecsLeft(null)
      return
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((Date.parse(ends) - Date.now()) / 1000))
      setSecsLeft(Number.isFinite(left) ? left : null)
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [game?.turnEndsAt, game?.phase])

  useEffect(() => {
    if (!game) return
    const n = game.players.length
    const key = game.currentTrick.map((p) => p.card.id).join('|')
    if (game.currentTrick.length === n && n > 0 && key !== heldKey.current) {
      heldKey.current = key
      setHeldTrick(game.currentTrick)
      setHoldingTrick(true)
      const t = window.setTimeout(() => setHoldingTrick(false), 3000)
      return () => window.clearTimeout(t)
    }
  }, [game, game?.currentTrick, game?.players.length])

  if (!game) return null

  const at = (seat: number) => game.players.find((p) => p.seat === seat) ?? game.players[seat]
  const pile = holdingTrick && heldTrick.length > 0 ? heldTrick : game.currentTrick
  const trickTaken = pile.length === game.players.length && pile.length > 0
  const winnerSeat =
    trickTaken && game.trump ? trickWinner(pile, game.trump, pile[0].card.suit) : null
  const takenBy = winnerSeat != null ? at(winnerSeat).name : null
  const showScores = game.phase === 'complete' && !holdingTrick
  const human = at(humanSeat)
  const bidder = game.bidderSeat != null ? at(game.bidderSeat) : null
  const yourTurn = Number(game.currentTurn) === Number(humanSeat)
  const serverIds = new Set(game.playable.map((c) => c.id).filter(Boolean))
  const fromServer = human.hand.filter((c) => serverIds.has(c.id))
  const legal =
    game.phase === 'playing' && yourTurn && !holdingTrick
      ? fromServer.length
        ? fromServer
        : legalCards(human.hand, game.leadSuit)
      : []
  const legalIds = new Set(legal.map((c) => c.id))
  const need = partnerConditionCount(game.players.length)
  const raises = game.hasAnyBid
    ? [game.bid + 10, game.bid + 20, game.bid + 40].filter((n) => n <= 500)
    : [100, 120, 140, 180, 220]

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden">
      <header className="flex shrink-0 items-start justify-between gap-2 px-3 py-2 md:items-center md:gap-4 md:px-5 md:py-3">
        <div className="flex items-center gap-2">
          <Spade className="h-5 w-5 text-[color:var(--color-gold)] md:h-6 md:w-6" fill="currentColor" />
          <span className="font-display text-lg md:text-2xl">Three of Spades</span>
        </div>
        <div className="flex max-w-[70%] flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[0.7rem] text-[color:var(--color-muted)] md:max-w-none md:gap-x-5 md:text-base">
          <span>Dealer {at(game.dealerSeat).name}</span>
          {game.hasAnyBid && (
            <span className="text-[color:var(--color-gold)]">Bid {game.bid}</span>
          )}
          {bidder && <span className="text-amber-300">Bidder {bidder.name}</span>}
          {game.trump && (
            <span className={isRed(game.trump) ? 'text-red-400' : 'text-white'}>
              Cut {SUIT_SYMBOL[game.trump]} {SUIT_NAME[game.trump]}
            </span>
          )}
          <span>
            Trick {Math.min(game.trickNumber, 13)}/13
          </span>
          {secsLeft != null && game.phase !== 'complete' && (
            <span
              className={`flex items-center gap-1 font-semibold tabular-nums ${
                secsLeft <= 10 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-gold)]'
              }`}
            >
              <Clock className="h-4 w-4" />
              {Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, '0')}
            </span>
          )}
          <button className="text-sm underline" onClick={backToRooms}>
            Leave (blocked if active)
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className="relative mx-auto h-full w-full max-w-[1100px]">
        <div className="felt-table absolute inset-0 rounded-none border-0 md:rounded-[46%_/_42%] md:border md:border-[color:var(--color-gold)]/25" />

        {narrow && (
          <div className="absolute inset-x-0 top-0 z-20 flex gap-1 overflow-x-auto px-2 py-2">
            {order
              .filter((seat) => seat !== humanSeat)
              .map((seat) => {
                const p = at(seat)
                const turn = Number(game.currentTurn) === Number(seat) && game.phase !== 'complete'
                return (
                  <div
                    key={p.id}
                    className={`shrink-0 rounded-full px-2 py-1 text-[0.65rem] ${
                      game.bidderSeat === seat
                        ? 'bg-amber-400 text-black'
                        : game.partnerSeats.includes(seat)
                          ? 'bg-sky-400 text-black'
                          : turn
                            ? 'bg-[color:var(--color-gold)] text-black'
                            : 'bg-black/60'
                    }`}
                  >
                    {p.name}
                    {turn && secsLeft != null ? ` ${secsLeft}s` : ''}
                    <span className="ml-1 opacity-70">{p.hand.length}</span>
                  </div>
                )
              })}
          </div>
        )}

        <div className={`absolute left-1/2 z-10 w-[min(920px,94%)] -translate-x-1/2 -translate-y-1/2 ${narrow ? 'top-[48%]' : 'top-[58%]'}`}>
          <div className="mb-3 text-center text-xs tracking-widest text-[color:var(--color-gold)]">
            {game.phase === 'bidding' && 'BIDDING'}
            {game.phase === 'selecting' && 'TRUMP & PARTNERS'}
            {game.phase === 'playing' && 'FOLLOW SUIT · HIDDEN POINTS'}
            {game.phase === 'complete' && 'HAND COMPLETE'}
          </div>
          <div className="flex min-h-[7.5rem] flex-wrap items-center justify-center gap-2 md:min-h-[11rem] md:gap-3">
            {pile.length === 0 && game.phase === 'playing' && (
              <p className="text-sm text-[color:var(--color-muted)]">
                {yourTurn ? 'Your lead — tap a card' : 'Waiting for lead'}
              </p>
            )}
            {pile.map((p) => (
              <div key={p.card.id} className="text-center">
                <PlayingCard card={p.card} size={narrow ? 'md' : 'xl'} />
                <div className="mt-1 max-w-[4.5rem] truncate text-[0.65rem] text-[color:var(--color-muted)] md:max-w-none md:text-sm">
                  {at(p.seat).name}
                </div>
              </div>
            ))}
          </div>
          {takenBy && (
            <p className="mt-1 text-center text-sm font-semibold text-[color:var(--color-gold)]">
              {takenBy} takes the trick
            </p>
          )}
          {game.partnerSeats.length > 0 && (
            <div className="mt-2 text-center text-sm text-sky-300">
              Revealed:{' '}
              {game.partnerSeats.map((s) => at(s).name).join(', ')}
              {game.partnerSeats.includes(game.bidderSeat ?? -1) ? ' · self-partner possible' : ''}
            </div>
          )}
        </div>

        {!narrow &&
        order.map((seat, i) => {
          const p = at(seat)
          const style = seatStyle(i, game.players.length)
          const turn = Number(game.currentTurn) === Number(seat) && game.phase !== 'complete'
          const isBidder = game.bidderSeat === seat
          const isPartner = game.partnerSeats.includes(seat)
          const roleChip = isBidder
            ? 'bg-amber-400 text-black'
            : isPartner
              ? 'bg-sky-400 text-black'
              : turn
                ? 'bg-[color:var(--color-gold)] text-black'
                : 'bg-black/50'
          return (
            <div key={p.id} className="absolute z-20 text-center" style={style}>
              <div
                className={`mx-auto mb-1 w-max rounded-full px-3 py-1 text-xs ${roleChip} ${
                  turn ? 'ring-2 ring-white' : ''
                }`}
              >
                {p.seat === game.dealerSeat && (
                  <Crown className="mr-1 inline h-3 w-3" />
                )}
                {p.name}
                {isBidder ? ' · Bid' : ''}
                {isPartner ? ' · Partner' : ''}
                {turn && secsLeft != null ? ` · ${secsLeft}s` : ''}
              </div>
              {i !== 0 && (
                <div className="flex justify-center">
                  {Array.from({ length: Math.min(p.hand.length, 8) }).map((_, k) => (
                    <div key={k} className="-ml-4 first:ml-0">
                      <PlayingCard back size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>

      <div className="hand-fan relative z-30 shrink-0 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-4 md:pb-4">
        {human.hand.map((card) => {
          const ok = game.phase === 'playing' && yourTurn && legalIds.has(card.id)
          const dimmed = game.phase === 'playing' && yourTurn && !ok
          return (
            <PlayingCard
              key={card.id}
              card={card}
              size={narrow ? 'md' : 'lg'}
              playable={ok}
              dimmed={dimmed}
              onClick={ok ? () => playCard(card.id) : undefined}
            />
          )
        })}
      </div>

      {showScores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="max-h-[85dvh] w-[min(520px,96vw)] overflow-auto rounded-3xl border border-[color:var(--color-gold)]/40 bg-[#0b241c] p-6 rise md:p-8">
            <h2 className="font-display text-4xl text-[color:var(--color-gold)]">
              {game.success ? 'Bid made' : 'Bid failed'}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">
              Team {game.teamPoints} vs bid {game.bid}. Trick points were hidden until now.
            </p>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {game.players.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="py-2">
                      <span
                        className={
                          p.seat === game.bidderSeat
                            ? 'text-amber-300'
                            : game.partnerSeats.includes(p.seat)
                              ? 'text-sky-300'
                              : ''
                        }
                      >
                        {p.name}
                        {p.seat === game.bidderSeat ? ' (bidder)' : ''}
                        {game.partnerSeats.includes(p.seat) && p.seat !== game.bidderSeat
                          ? ' (partner)'
                          : ''}
                        {game.partnerSeats.includes(p.seat) && p.seat === game.bidderSeat
                          ? ' (self-partner)'
                          : ''}
                      </span>
                    </td>
                    <td className="py-2 text-right text-[color:var(--color-muted)]">{p.pointsWon} pts</td>
                    <td className={`py-2 text-right ${p.scoreDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.scoreDelta > 0 ? '+' : ''}
                      {p.scoreDelta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="mt-6 w-full rounded-xl bg-[color:var(--color-gold)] py-3 font-semibold text-black"
              onClick={finishToLobby}
            >
              Return to room
            </button>
          </div>
        </div>
      )}

      {showCall && game.trump && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(480px,96vw)] rounded-3xl border border-[color:var(--color-gold)]/40 bg-[#0b241c] p-8 text-center rise">
            <p className="text-sm tracking-[0.25em] text-[color:var(--color-muted)]">LOCKED IN</p>
            <h2 className="font-display mt-2 text-4xl text-[color:var(--color-gold)]">
              Cut {SUIT_SYMBOL[game.trump]} {SUIT_NAME[game.trump]}
            </h2>
            <p className="mt-2 text-lg text-[color:var(--color-muted)]">
              {bidder?.name} at {game.bid}
            </p>
            <div className="mt-5 space-y-2">
              <p className="text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
                Partner conditions
              </p>
              {game.conditions.map((c) => (
                <div key={conditionLabel(c)} className="text-2xl font-semibold">
                  {conditionLabel(c)}
                </div>
              ))}
            </div>
            <button
              className="mt-6 w-full rounded-xl bg-[color:var(--color-gold)] py-3 font-semibold text-black"
              onClick={() => setShowCall(false)}
            >
              Got it
            </button>
            <p className="mt-2 text-xs text-[color:var(--color-muted)]">Closes in a few seconds</p>
          </div>
        </div>
      )}

      {game.phase !== 'playing' && game.phase !== 'complete' && (
        <div className="fixed inset-x-3 bottom-[5.5rem] z-40 max-h-[42vh] w-auto overflow-auto rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm md:inset-auto md:bottom-auto md:right-4 md:top-20 md:max-h-none md:w-[13.75rem] md:bg-black/50">
          {game.phase === 'bidding' && (
            <div className="space-y-2">
              <div className="mb-1 text-[color:var(--color-muted)]">Bidding</div>
              <div>
                <div className="font-medium">High {game.hasAnyBid ? game.bid : '—'}</div>
                <div className="text-xs text-[color:var(--color-muted)]">
                  {at(game.currentTurn).name}
                  {yourTurn ? ' (you)' : ''}
                </div>
              </div>
              <div className="max-h-20 overflow-auto text-xs leading-4 text-[color:var(--color-muted)]">
                {game.bidLog.map((b, i) => (
                  <div key={i}>
                    {at(b.seat).name} {b.kind === 'pass' ? 'pass' : b.amount}
                  </div>
                ))}
              </div>
              {yourTurn ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {raises.map((n) => (
                    <button
                      key={n}
                      className="rounded-lg bg-[color:var(--color-gold)] px-2 py-1.5 text-xs font-semibold text-black"
                      onClick={() => placeBid(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    className="col-span-2 rounded-lg border border-white/20 px-2 py-1.5 text-xs"
                    onClick={passBid}
                  >
                    Pass
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[color:var(--color-muted)]">Waiting…</p>
              )}
            </div>
          )}

          {game.phase === 'selecting' && bidder?.isHuman && (
            <SelectionPanel
              need={need}
              copies={(rank, suit) => copiesInDeck(game.activeDeck, rank, suit)}
              onConfirm={(cut, conditions) => confirmSelection(cut, conditions)}
            />
          )}
          {game.phase === 'selecting' && bidder && !bidder.isHuman && (
            <p className="text-xs text-[color:var(--color-muted)]">
              {bidder.name} is choosing trump…
            </p>
          )}
        </div>
      )}

      {game.phase === 'playing' && game.conditions.length > 0 && (
        <div className="pointer-events-none fixed inset-x-3 top-14 z-40 rounded-2xl border border-white/10 bg-black/70 px-3 py-2 text-xs md:inset-auto md:right-4 md:top-20 md:bg-black/50 md:px-4 md:py-3 md:text-sm">
          <div className="mb-1 text-[color:var(--color-muted)]">Partner conditions</div>
          {game.conditions.map((c) => (
            <div key={conditionLabel(c)} className="flex items-center gap-2">
              <span>{c.nth === 1 ? '1st' : '2nd'}</span>
              <span>
                {c.rank}
                {SUIT_SYMBOL[c.suit]}
              </span>
              <span>{SUIT_NAME[c.suit]}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

function defaultPartnerRows(need: number, copies: (rank: Rank, suit: Suit) => number): PartnerCondition[] {
  const rows: PartnerCondition[] = []
  for (const rank of RANK_PICK) {
    for (const suit of SUITS) {
      if (copies(rank, suit) < 1) continue
      rows.push({ nth: 1, rank, suit })
      if (rows.length >= need) return rows
    }
  }
  return rows
}

function SelectionPanel({
  need,
  copies,
  onConfirm,
}: {
  need: number
  copies: (rank: Rank, suit: Suit) => number
  onConfirm: (trump: Suit, conditions: PartnerCondition[]) => void
}) {
  const [trump, setTrump] = useState<Suit>('S')
  const [rows, setRows] = useState<PartnerCondition[]>(() => defaultPartnerRows(need, copies))
  const [error, setError] = useState('')
  const lock = () => {
    const keys = rows.slice(0, need).map((r) => `${r.nth}${r.rank}${r.suit}`)
    if (new Set(keys).size !== keys.length) {
      setError('Each partner condition must be different.')
      return
    }
    for (const row of rows.slice(0, need)) {
      if (row.nth === 2 && copies(row.rank, row.suit) < 2) {
        setError(`There is no 2nd ${row.rank}${SUIT_SYMBOL[row.suit]} in this deck.`)
        return
      }
    }
    setError('')
    onConfirm(trump, rows.slice(0, need))
  }
  return (
    <div>
      <p className="mb-2 text-[0.7rem] leading-4 text-[color:var(--color-muted)]">
        Cut and {need} partner{need > 1 ? 's' : ''}
      </p>
      <div className="mb-2 grid grid-cols-4 gap-1">
        {SUITS.map((s) => (
          <button
            key={s}
            onClick={() => setTrump(s)}
            className={`rounded-md px-1 py-1 text-xs ${
              trump === s ? 'bg-[color:var(--color-gold)] text-black' : 'border border-white/15'
            }`}
          >
            {SUIT_SYMBOL[s]}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-1">
            <select
              className="w-[3.2rem] rounded-md bg-zinc-900 px-1 py-1 text-[0.7rem]"
              value={row.nth}
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...row, nth: Number(e.target.value) as 1 | 2 }
                setRows(next)
              }}
            >
              <option value={1}>1st</option>
              <option value={2}>2nd</option>
            </select>
            <select
              className="min-w-0 flex-1 rounded-md bg-zinc-900 px-1 py-1 text-[0.7rem]"
              value={row.rank}
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...row, rank: e.target.value as Rank }
                setRows(next)
              }}
            >
              {RANK_PICK.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              className="w-10 rounded-md bg-zinc-900 px-1 py-1 text-[0.7rem]"
              value={row.suit}
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...row, suit: e.target.value as Suit }
                setRows(next)
              }}
            >
              {SUITS.map((s) => (
                <option key={s} value={s}>
                  {SUIT_SYMBOL[s]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-[0.7rem] text-red-400">{error}</p>}
      <button
        className="mt-2 w-full rounded-lg bg-[color:var(--color-gold)] px-2 py-1.5 text-xs font-semibold text-black"
        onClick={lock}
      >
        Lock
      </button>
    </div>
  )
}
