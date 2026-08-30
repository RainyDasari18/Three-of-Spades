import type { Card, PartnerCondition, Rank, Suit } from '../types'

export const SUITS: Suit[] = ['S', 'H', 'D', 'C']
export const RANKS: Rank[] = [
  'A',
  'K',
  'Q',
  'J',
  '10',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
]

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
}

export const SUIT_NAME: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
}

export const RANK_VALUE: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  '10': 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
}

export function isRed(suit: Suit) {
  return suit === 'H' || suit === 'D'
}

export function cardPoints(card: Card): number {
  if (card.rank === '3' && card.suit === 'S') return 30
  if (card.rank === '5') return 5
  if (['10', 'J', 'Q', 'K', 'A'].includes(card.rank)) return 10
  return 0
}

export function signature(rank: Rank, suit: Suit) {
  return `${rank}${suit}`
}

export function cardLabel(card: Card) {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`
}

export function conditionLabel(c: PartnerCondition) {
  return `${c.nth === 1 ? '1st' : '2nd'} ${c.rank}${SUIT_SYMBOL[c.suit]}`
}

export function partnerConditionCount(playerCount: number) {
  if (playerCount <= 5) return 1
  if (playerCount === 6) return 2
  if (playerCount === 7) return 2
  return 3
}

function twoDecks(): Card[] {
  const cards: Card[] = []
  for (const deck of [0, 1] as const) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `${deck}-${rank}${suit}`,
          deck,
          rank,
          suit,
        })
      }
    }
  }
  return cards
}

export function buildActiveDeck(playerCount: number): Card[] {
  const needed = playerCount * 13
  let cards = twoDecks()
  const removeOrder: Rank[] = ['2', '3', '4', '6', '7', '8', '9']
  const suitOrder: Suit[] = ['C', 'D', 'H', 'S']

  for (const rank of removeOrder) {
    if (cards.length <= needed) break
    const victims = cards.filter((c) => {
      if (c.rank !== rank) return false
      if (rank === '3' && c.suit === 'S') return false
      return true
    })
    victims.sort((a, b) => {
      const s = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit)
      if (s !== 0) return s
      return a.deck - b.deck
    })
    const toDrop = Math.min(victims.length, cards.length - needed)
    const dropIds = new Set(victims.slice(0, toDrop).map((c) => c.id))
    cards = cards.filter((c) => !dropIds.has(c.id))
  }
  return cards
}

export function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function dealHands(playerCount: number): { deck: Card[]; hands: Card[][] } {
  const deck = shuffle(buildActiveDeck(playerCount))
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  deck.forEach((card, i) => {
    hands[i % playerCount].push(card)
  })
  hands.forEach((hand) => {
    hand.sort(
      (a, b) =>
        SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) ||
        RANK_VALUE[b.rank] - RANK_VALUE[a.rank],
    )
  })
  return { deck, hands }
}

export function cardExistsInDeck(deck: Card[], rank: Rank, suit: Suit) {
  return deck.some((c) => c.rank === rank && c.suit === suit)
}

export function copiesInDeck(deck: Card[], rank: Rank, suit: Suit) {
  return deck.filter((c) => c.rank === rank && c.suit === suit).length
}

export function legalCards(hand: Card[], leadSuit: Suit | null): Card[] {
  if (!leadSuit) return hand
  const follow = hand.filter((c) => c.suit === leadSuit)
  return follow.length ? follow : hand
}

export function lowestLegal(hand: Card[], leadSuit: Suit | null): Card {
  const legal = legalCards(hand, leadSuit)
  const suitOrder: Suit[] = ['C', 'D', 'H', 'S']
  return [...legal].sort(
    (a, b) =>
      RANK_VALUE[a.rank] - RANK_VALUE[b.rank] ||
      suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit),
  )[0]
}

export function trickWinner(
  plays: { seat: number; card: Card }[],
  trump: Suit,
  leadSuit: Suit,
): number {
  const trumps = plays.filter((p) => p.card.suit === trump)
  const pool = trumps.length ? trumps : plays.filter((p) => p.card.suit === leadSuit)
  let best = pool[0]
  for (const play of pool) {
    const rv = RANK_VALUE[play.card.rank]
    const bv = RANK_VALUE[best.card.rank]
    if (rv > bv) best = play
    else if (
      rv === bv &&
      play.card.suit === best.card.suit &&
      play.seat !== best.seat
    ) {
      best = play
    }
  }
  return best.seat
}

export function handPointCount(hand: Card[]) {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0)
}
