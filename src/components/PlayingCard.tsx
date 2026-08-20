import type { Card } from '../types'
import { RANK_VALUE, SUIT_SYMBOL, cardPoints, isRed } from '../lib/cards'

interface Props {
  card?: Card
  back?: boolean
  selected?: boolean
  playable?: boolean
  dimmed?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  title?: string
}

const sizes = {
  sm: 'w-10 h-[3.6rem] text-[0.65rem]',
  md: 'w-[4.4rem] h-[6.2rem] text-sm',
  lg: 'w-[5.2rem] h-[7.4rem] text-base',
}

export function PlayingCard({
  card,
  back,
  selected,
  playable,
  dimmed,
  size = 'md',
  onClick,
  title,
}: Props) {
  const classBase = sizes[size]
  if (back || !card) {
    if (onClick) {
      return (
        <button type="button" title={title} onClick={onClick} className={`${classBase} card-back rounded-lg`} />
      )
    }
    return <div title={title} className={`${classBase} card-back rounded-lg`} />
  }

  const red = isRed(card.suit)
  const pts = cardPoints(card)
  const aceHigh = RANK_VALUE[card.rank] >= 11
  const threeSpades = card.rank === '3' && card.suit === 'S'
  const className = [
    classBase,
    'card-face relative px-1.5 py-1 text-left',
    red ? 'text-red-600' : 'text-neutral-900',
    threeSpades ? 'ring-2 ring-amber-400' : '',
    selected ? 'ring-2 ring-emerald-400 -translate-y-3' : '',
    playable ? 'cursor-pointer' : '',
    dimmed ? 'opacity-35 grayscale' : '',
  ].join(' ')

  const inner = (
    <>
      <div className="font-semibold leading-none">
        {card.rank}
        <span className="ml-0.5">{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center ${aceHigh ? 'text-3xl' : 'text-2xl'}`}>
        {SUIT_SYMBOL[card.suit]}
      </div>
      {pts > 0 && (
        <div className="absolute bottom-1 right-1 rounded bg-black/10 px-1 text-[0.6rem] font-semibold text-neutral-700">
          {pts}
        </div>
      )}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title ?? `${card.rank}${SUIT_SYMBOL[card.suit]}`} className={className}>
        {inner}
      </button>
    )
  }
  return (
    <div title={title ?? `${card.rank}${SUIT_SYMBOL[card.suit]}`} className={className}>
      {inner}
    </div>
  )
}
