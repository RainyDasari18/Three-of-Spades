import { useMemo, useState, type CSSProperties } from 'react'
import { Crown, Spade } from 'lucide-react'
import type { PartnerCondition, Rank, Suit } from '../types'
import {
  SUIT_NAME,
  SUIT_SYMBOL,
  SUITS,
  conditionLabel,
  copiesInDeck,
  legalCards,
  partnerConditionCount,
} from '../lib/cards'
import { PlayingCard } from '../components/PlayingCard'
import { useApp } from '../state/AppProvider'

const RANK_PICK: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

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

  const order = useMemo(() => {
    if (!game) return []
    return game.players.map((_, i) => (humanSeat + i) % game.players.length)
  }, [game, humanSeat])

  if (!game) return null

  const human = game.players[humanSeat]
  const bidder = game.bidderSeat != null ? game.players[game.bidderSeat] : null
  const yourTurn = game.currentTurn === humanSeat
  const legal =
    game.phase === 'playing' && yourTurn ? legalCards(human.hand, game.leadSuit) : []
  const legalIds = new Set(legal.map((c) => c.id))
  const need = partnerConditionCount(game.players.length)
  const raises = game.hasAnyBid
    ? [game.bid + 10, game.bid + 20, game.bid + 40].filter((n) => n <= 500)
    : [100, 120, 140, 180, 220]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <Spade className="h-5 w-5 text-[color:var(--color-gold)]" fill="currentColor" />
          <span className="font-display text-xl">Three of Spades</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-muted)]">
          <span>Dealer {game.players[game.dealerSeat].name}</span>
          {game.hasAnyBid && <span>Bid {game.bid}</span>}
          {bidder && <span>Bidder {bidder.name}</span>}
          {game.trump && <span>Cut {SUIT_SYMBOL[game.trump]}</span>}
          <span>
            Trick {Math.min(game.trickNumber, 13)}/13
          </span>
          <button className="underline" onClick={backToRooms}>
            Leave (blocked if active)
          </button>
        </div>
      </header>

      <div className="relative mx-auto h-[70vh] w-[min(1100px,96vw)]">
        <div className="felt-table absolute inset-0 rounded-[46%_/_42%] border border-[color:var(--color-gold)]/25" />

        <div className="absolute left-1/2 top-[42%] z-10 w-[min(420px,80%)] -translate-x-1/2 -translate-y-1/2">
          <div className="mb-3 text-center text-xs tracking-widest text-[color:var(--color-gold)]">
            {game.phase === 'bidding' && 'BIDDING'}
            {game.phase === 'selecting' && 'TRUMP & PARTNERS'}
            {game.phase === 'playing' && 'FOLLOW SUIT · HIDDEN POINTS'}
            {game.phase === 'complete' && 'HAND COMPLETE'}
          </div>
          <div className="flex min-h-[7rem] items-center justify-center gap-2">
            {game.currentTrick.length === 0 && game.phase === 'playing' && (
              <p className="text-sm text-[color:var(--color-muted)]">Waiting for lead</p>
            )}
            {game.currentTrick.map((p) => (
              <div key={p.card.id} className="text-center">
                <PlayingCard card={p.card} size="sm" />
                <div className="mt-1 text-[0.65rem] text-[color:var(--color-muted)]">
                  {game.players[p.seat].name}
                </div>
              </div>
            ))}
          </div>
          {game.partnerSeats.length > 0 && (
            <div className="mt-2 text-center text-xs text-[color:var(--color-gold)]">
              Revealed:{' '}
              {game.partnerSeats.map((s) => game.players[s].name).join(', ')}
              {game.partnerSeats.includes(game.bidderSeat ?? -1) ? ' · self-partner possible' : ''}
            </div>
          )}
        </div>

        {order.map((seat, i) => {
          const p = game.players[seat]
          const style = seatStyle(i, game.players.length)
          const turn = game.currentTurn === seat && game.phase !== 'complete'
          return (
            <div key={p.id} className="absolute z-20 text-center" style={style}>
              <div
                className={`mx-auto mb-1 w-max rounded-full px-3 py-1 text-xs ${
                  turn ? 'bg-[color:var(--color-gold)] text-black' : 'bg-black/50'
                }`}
              >
                {p.seat === game.dealerSeat && (
                  <Crown className="mr-1 inline h-3 w-3" />
                )}
                {p.name}
                {game.bidderSeat === seat ? ' · Bid' : ''}
                {game.partnerSeats.includes(seat) ? ' · Partner' : ''}
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

      <div className="hand-fan relative z-30 px-4 pb-6">
        {human.hand.map((card) => {
          const ok = game.phase === 'playing' && yourTurn && legalIds.has(card.id)
          const dimmed = game.phase === 'playing' && yourTurn && !ok
          return (
            <PlayingCard
              key={card.id}
              card={card}
              size="lg"
              playable={ok}
              dimmed={dimmed}
              onClick={ok ? () => playCard(card.id) : undefined}
            />
          )
        })}
      </div>

      {game.phase !== 'playing' && game.phase !== 'complete' && (
        <div className="mx-auto mb-6 w-[min(720px,94vw)] rounded-3xl border border-white/10 bg-black/40 p-5 rise">
          {game.phase === 'bidding' && (
            <div>
              <div className="mb-3 flex justify-between text-sm">
                <span>Current high {game.hasAnyBid ? game.bid : '—'}</span>
                <span>
                  Turn: {game.players[game.currentTurn].name}
                  {yourTurn ? ' (you)' : ''}
                </span>
              </div>
              <div className="mb-4 max-h-28 overflow-auto text-xs text-[color:var(--color-muted)]">
                {game.bidLog.map((b, i) => (
                  <div key={i}>
                    {game.players[b.seat].name} {b.kind === 'pass' ? 'passed' : `bid ${b.amount}`}
                  </div>
                ))}
              </div>
              {yourTurn ? (
                <div className="flex flex-wrap gap-2">
                  {raises.map((n) => (
                    <button
                      key={n}
                      className="rounded-full bg-[color:var(--color-gold)] px-4 py-2 text-sm font-semibold text-black"
                      onClick={() => placeBid(n)}
                    >
                      {game.hasAnyBid ? `Raise ${n}` : `Bid ${n}`}
                    </button>
                  ))}
                  <button
                    className="rounded-full border border-white/20 px-4 py-2 text-sm"
                    onClick={passBid}
                  >
                    Pass
                  </button>
                  <span className="self-center text-xs text-[color:var(--color-muted)]">
                    Min 100 · max 500 · you may re-enter after passing
                  </span>
                </div>
              ) : (
                <p className="text-sm text-[color:var(--color-muted)]">Dummy players are bidding…</p>
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
            <p className="text-sm text-[color:var(--color-muted)]">
              {bidder.name} is choosing trump and {need} partner condition{need > 1 ? 's' : ''}…
            </p>
          )}
        </div>
      )}

      {game.phase === 'complete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(520px,96vw)] rounded-3xl border border-[color:var(--color-gold)]/40 bg-[#0b241c] p-8 rise">
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
                      {p.name}
                      {p.seat === game.bidderSeat ? ' (bidder)' : ''}
                      {game.partnerSeats.includes(p.seat) ? ' (partner)' : ''}
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

      {game.phase === 'playing' && game.conditions.length > 0 && (
        <div className="pointer-events-none fixed bottom-28 left-4 z-40 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs">
          <div className="mb-1 text-[color:var(--color-muted)]">Partner conditions</div>
          {game.conditions.map((c) => (
            <div key={conditionLabel(c)}>{conditionLabel(c)}</div>
          ))}
        </div>
      )}

    </div>
  )
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
  const [rows, setRows] = useState<PartnerCondition[]>(() =>
    Array.from({ length: need }, () => ({ nth: 1 as const, rank: 'A' as Rank, suit: 'S' as Suit })),
  )
  return (
    <div>
      <p className="mb-3 text-sm">You won the bid. Choose a cut suit and {need} partner condition{need > 1 ? 's' : ''}.</p>
      <div className="mb-4 flex gap-2">
        {SUITS.map((s) => (
          <button
            key={s}
            onClick={() => setTrump(s)}
            className={`rounded-full px-4 py-2 ${
              trump === s ? 'bg-[color:var(--color-gold)] text-black' : 'border border-white/15'
            }`}
          >
            {SUIT_SYMBOL[s]} {SUIT_NAME[s]}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <select
              className="rounded-lg bg-zinc-900 px-2 py-2"
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
              className="rounded-lg bg-zinc-900 px-2 py-2"
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
              className="rounded-lg bg-zinc-900 px-2 py-2"
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
            <span className="self-center text-xs text-[color:var(--color-muted)]">
              {copies(row.rank, row.suit)} in deck
            </span>
          </div>
        ))}
      </div>
      <button
        className="mt-4 rounded-xl bg-[color:var(--color-gold)] px-5 py-2 font-semibold text-black"
        onClick={() => onConfirm(trump, rows.slice(0, need))}
      >
        Lock trump & partners
      </button>
    </div>
  )
}
