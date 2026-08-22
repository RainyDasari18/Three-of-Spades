export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank =
  | 'A'
  | 'K'
  | 'Q'
  | 'J'
  | '10'
  | '9'
  | '8'
  | '7'
  | '6'
  | '5'
  | '4'
  | '3'
  | '2'

export type View = 'auth' | 'rooms' | 'room' | 'game'
export type AuthMode = 'login' | 'register'
export type GamePhase = 'bidding' | 'selecting' | 'playing' | 'complete' | 'cancelled'
export type RoomTab = 'lobby' | 'history' | 'stats'

export interface Card {
  id: string
  rank: Rank
  suit: Suit
  deck: 0 | 1
}

export interface PartnerCondition {
  nth: 1 | 2
  rank: Rank
  suit: Suit
}

export interface Player {
  id: string
  name: string
  seat: number
  isHuman: boolean
  isOwner: boolean
  isBot?: boolean
  online: boolean
  ready: boolean
  hand: Card[]
  pointsWon: number
  scoreDelta: number
}

export interface BidAction {
  seat: number
  kind: 'bid' | 'pass'
  amount?: number
}

export interface TrickPlay {
  seat: number
  card: Card
}

export interface CompletedTrick {
  winnerSeat: number
  plays: TrickPlay[]
  points: number
}

export interface GameRecord {
  id: string
  playedAt: string
  playerCount: number
  bidder: string
  bid: number
  trump: Suit
  success: boolean
  teamPoints: number
  yourScore: number
}

export interface RoomStats {
  gamesPlayed: number
  bestBidder: string
  worstBidder: string
  bestBuddy: string
  worstBuddy: string
  leaderboard: { name: string; score: number }[]
}

export interface Room {
  id: string
  name: string
  code: string
  archived: boolean
  ownerId: string
  members: Player[]
  history: GameRecord[]
  stats: RoomStats
}

export interface User {
  id: string
  name: string
  email: string
}

export interface Toast {
  id: number
  text: string
  tone: 'gold' | 'info' | 'danger'
}
