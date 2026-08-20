export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5203'

const TOKEN_KEY = 'tos.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  if (!res.ok) {
    const message =
      (typeof data.error === 'string' && data.error) ||
      (typeof data.title === 'string' && data.title) ||
      res.statusText
    throw new ApiError(res.status, message)
  }
  return data as T
}

export interface AuthPayload {
  token: string
  userId: string
  email: string
  userName: string
  needsUserName: boolean
}

export interface ApiMember {
  id: string
  userName: string
  isOwner: boolean
  online: boolean
  ready: boolean
  isBot: boolean
}

export interface ApiHistory {
  id: string
  playedAt: string
  playerCount: number
  bidder: string
  bid: number
  trump: string
  success: boolean
  teamPoints: number
  yourScore: number
}

export interface ApiRoom {
  id: string
  name: string
  code: string
  archived: boolean
  ownerId: string
  activeGameId: string | null
  members: ApiMember[]
  history: ApiHistory[]
  stats: {
    gamesPlayed: number
    bestBidder: string
    worstBidder: string
    bestBuddy: string
    worstBuddy: string
    leaderboard: { name: string; score: number }[]
  }
}

export interface ApiCard {
  id: string
  rank: string
  suit: string
  deck: number
}

export interface ApiSnapshot {
  gameId: string
  roomId: string
  phase: string
  dealerSeat: number
  currentTurn: number
  bid: number
  bidderSeat: number | null
  hasAnyBid: boolean
  trump: string | null
  conditions: { nth: number; rank: string; suit: string }[]
  partnerSeats: number[]
  bidLog: { seat: number; kind: string; amount?: number | null }[]
  currentTrick: { seat: number; card: ApiCard; userName: string }[]
  leadSuit: string | null
  trickNumber: number
  teamPoints: number
  success: boolean | null
  players: {
    userId: string
    userName: string
    seat: number
    isBot: boolean
    handCount: number
    pointsWon: number | null
    scoreDelta: number
    isBidder: boolean
    isPartner: boolean
  }[]
  yourHand: ApiCard[]
  playable: ApiCard[]
  cancelReason: string | null
  ruleVersion: string
}
