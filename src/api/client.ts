export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5203'

const TOKEN_KEY = 'tos.token'
const SESSION_KEY = 'tos.sessionKey'
const LOCATION_KEY = 'tos.location'
const CHANNEL = 'tos-tab-auth'
const TAB_INSTANCE = crypto.randomUUID()

let memoryToken: string | null = null

try {
  localStorage.removeItem(TOKEN_KEY)
} catch {
  /* ignore */
}

try {
  memoryToken = sessionStorage.getItem(TOKEN_KEY)
} catch {
  /* ignore */
}

export function peekStoredToken() {
  try {
    return memoryToken ?? sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function getSessionKey() {
  let key = sessionStorage.getItem(SESSION_KEY)
  if (!key) {
    key = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, key)
  }
  return key
}

/** If this tab was duplicated, sessionStorage (and the JWT) is copied. Drop that copy. */
export function isolateTabSession(): Promise<void> {
  try {
    memoryToken = sessionStorage.getItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  return new Promise((resolve) => {
    const sessionKey = getSessionKey()
    let duplicated = false
    try {
      const bc = new BroadcastChannel(CHANNEL)
      const onMessage = (ev: MessageEvent) => {
        const data = ev.data as { type?: string; sessionKey?: string; instanceId?: string }
        if (data?.sessionKey !== sessionKey || data.instanceId === TAB_INSTANCE) return
        if (data.type === 'pong') duplicated = true
        if (data.type === 'ping') {
          bc.postMessage({ type: 'pong', sessionKey, instanceId: TAB_INSTANCE })
        }
      }
      bc.addEventListener('message', onMessage)
      bc.postMessage({ type: 'ping', sessionKey, instanceId: TAB_INSTANCE })
      window.setTimeout(() => {
        bc.removeEventListener('message', onMessage)
        bc.close()
        if (duplicated) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(LOCATION_KEY)
          sessionStorage.setItem(SESSION_KEY, crypto.randomUUID())
          memoryToken = null
        } else {
          try {
            memoryToken = sessionStorage.getItem(TOKEN_KEY)
          } catch {
            /* ignore */
          }
        }
        resolve()
      }, 50)
    } catch {
      try {
        memoryToken = sessionStorage.getItem(TOKEN_KEY)
      } catch {
        /* ignore */
      }
      resolve()
    }
  })
}

export function getToken() {
  return memoryToken ?? sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  memoryToken = token
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(LOCATION_KEY)
  }
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function getStoredLocation(): { roomId: string } | null {
  try {
    const raw = sessionStorage.getItem(LOCATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { roomId?: string }
    if (!parsed?.roomId) return null
    return { roomId: parsed.roomId }
  } catch {
    return null
  }
}

export function setStoredLocation(roomId: string | null) {
  try {
    if (roomId) sessionStorage.setItem(LOCATION_KEY, JSON.stringify({ roomId }))
    else sessionStorage.removeItem(LOCATION_KEY)
  } catch {
    /* ignore */
  }
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
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: Record<string, unknown> = {}
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>
    } catch {
      if (!res.ok) throw new ApiError(res.status, text || res.statusText)
      throw new ApiError(res.status || 500, 'Unexpected response from server.')
    }
  }
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
  turnEndsAt?: string | null
}
