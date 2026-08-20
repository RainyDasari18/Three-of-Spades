import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import {
  API_URL,
  api,
  getToken,
  setToken,
  type ApiRoom,
  type ApiSnapshot,
  type AuthPayload,
} from '../api/client'
import type {
  Card,
  GamePhase,
  GameRecord,
  PartnerCondition,
  Player,
  Room,
  RoomTab,
  Suit,
  Toast,
  User,
  View,
} from '../types'
import { buildActiveDeck } from '../lib/cards'

export interface LiveGame {
  roomId: string
  players: Player[]
  dealerSeat: number
  phase: GamePhase
  currentTurn: number
  bid: number
  bidderSeat: number | null
  bidLog: { seat: number; kind: 'bid' | 'pass'; amount?: number }[]
  hasAnyBid: boolean
  trump: Suit | null
  conditions: PartnerCondition[]
  partnerSeats: number[]
  currentTrick: { seat: number; card: Card }[]
  leadSuit: Suit | null
  trickNumber: number
  teamPoints: number
  success: boolean | null
  activeDeck: Card[]
  playable: Card[]
  cancelReason: string | null
}

interface AppContextValue {
  user: User | null
  view: View
  rooms: Room[]
  activeRoom: Room | null
  roomTab: RoomTab
  game: LiveGame | null
  toasts: Toast[]
  authError: string
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  createRoom: (name: string) => Promise<void>
  joinRoom: (code: string) => Promise<void>
  openRoom: (id: string) => Promise<void>
  backToRooms: () => Promise<void>
  setRoomTab: (tab: RoomTab) => void
  toggleReady: () => Promise<void>
  fillBots: () => Promise<void>
  startGame: () => Promise<void>
  kick: (playerId: string) => Promise<void>
  transferOwner: (playerId: string) => Promise<void>
  archiveRoom: () => Promise<void>
  placeBid: (amount: number) => Promise<void>
  passBid: () => Promise<void>
  confirmSelection: (trump: Suit, conditions: PartnerCondition[]) => Promise<void>
  playCard: (cardId: string) => Promise<void>
  finishToLobby: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

function card(c: { id: string; rank: string; suit: string; deck: number }): Card {
  return { id: c.id, rank: c.rank as Card['rank'], suit: c.suit as Card['suit'], deck: c.deck as 0 | 1 }
}

function mapRoom(dto: ApiRoom, userId: string): Room {
  return {
    id: dto.id,
    name: dto.name,
    code: dto.code,
    archived: dto.archived,
    ownerId: dto.ownerId,
    members: dto.members.map((m, i) => ({
      id: m.id,
      name: m.userName,
      seat: i,
      isHuman: m.id.toLowerCase() === userId.toLowerCase(),
      isOwner: m.isOwner,
      online: m.online,
      ready: m.ready,
      hand: [],
      pointsWon: 0,
      scoreDelta: 0,
    })),
    history: dto.history.map(
      (g): GameRecord => ({
        id: g.id,
        playedAt: g.playedAt,
        playerCount: g.playerCount,
        bidder: g.bidder,
        bid: g.bid,
        trump: g.trump as Suit,
        success: g.success,
        teamPoints: g.teamPoints,
        yourScore: g.yourScore,
      }),
    ),
    stats: dto.stats,
  }
}

function mapGame(snap: ApiSnapshot, userId: string): LiveGame {
  const phase = snap.phase as GamePhase
  const yourHand = (snap.yourHand ?? []).map(card)
  return {
    roomId: snap.roomId,
    dealerSeat: snap.dealerSeat,
    phase: phase === 'cancelled' ? 'cancelled' : phase,
    currentTurn: snap.currentTurn,
    bid: snap.bid,
    bidderSeat: snap.bidderSeat,
    bidLog: (snap.bidLog ?? []).map((b) => ({
      seat: b.seat,
      kind: b.kind === 'pass' ? 'pass' : 'bid',
      amount: b.amount ?? undefined,
    })),
    hasAnyBid: snap.hasAnyBid,
    trump: (snap.trump as Suit | null) ?? null,
    conditions: (snap.conditions ?? []).map((c) => ({
      nth: c.nth as 1 | 2,
      rank: c.rank as PartnerCondition['rank'],
      suit: c.suit as Suit,
    })),
    partnerSeats: snap.partnerSeats ?? [],
    currentTrick: (snap.currentTrick ?? []).map((t) => ({ seat: t.seat, card: card(t.card) })),
    leadSuit: (snap.leadSuit as Suit | null) ?? null,
    trickNumber: snap.trickNumber,
    teamPoints: snap.teamPoints,
    success: snap.success,
    activeDeck: buildActiveDeck(snap.players.length),
    playable: (snap.playable ?? []).map(card),
    cancelReason: snap.cancelReason,
    players: snap.players.map((p) => {
      const mine = p.userId.toLowerCase() === userId.toLowerCase()
      return {
        id: p.userId,
        name: p.userName,
        seat: p.seat,
        isHuman: mine,
        isOwner: false,
        online: true,
        ready: true,
        hand: mine ? yourHand : Array.from({ length: p.handCount }, (_, i) => ({
          id: `back-${p.seat}-${i}`,
          rank: '2' as const,
          suit: 'C' as const,
          deck: 0 as const,
        })),
        pointsWon: p.pointsWon ?? 0,
        scoreDelta: p.scoreDelta,
      }
    }),
  }
}

function userFromAuth(a: AuthPayload): User {
  return { id: a.userId, name: a.userName, email: a.email }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<View>('auth')
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [roomTab, setRoomTab] = useState<RoomTab>('lobby')
  const [game, setGame] = useState<LiveGame | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [authError, setAuthError] = useState('')
  const toastId = useRef(1)
  const hubRef = useRef<HubConnection | null>(null)
  const userRef = useRef<User | null>(null)
  const roomIdRef = useRef<string | null>(null)
  userRef.current = user
  roomIdRef.current = activeRoomId

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null

  const pushToast = useCallback((text: string, tone: Toast['tone'] = 'gold') => {
    const id = toastId.current++
    setToasts((t) => [...t, { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const fail = (e: unknown) => {
    const message = e instanceof Error ? e.message : 'Request failed'
    setAuthError(message)
    pushToast(message, 'danger')
  }

  const applySnapshot = useCallback(
    (snap: ApiSnapshot) => {
      const me = userRef.current
      if (!me) return
      if (snap.phase === 'cancelled') {
        setGame(null)
        setView('room')
        pushToast(snap.cancelReason || 'Game cancelled.', 'danger')
        return
      }
      setGame(mapGame(snap, me.id))
      setView('game')
    },
    [pushToast],
  )

  const refreshRooms = useCallback(async () => {
    const list = await api<ApiRoom[]>('/api/rooms')
    const me = userRef.current
    if (!me) return
    setRooms(list.map((r) => mapRoom(r, me.id)))
  }, [])

  const refreshRoom = useCallback(async (id: string) => {
    const dto = await api<ApiRoom>(`/api/rooms/${id}`)
    const me = userRef.current
    if (!me) return dto
    const mapped = mapRoom(dto, me.id)
    setRooms((prev) => {
      const rest = prev.filter((r) => r.id !== id)
      return [mapped, ...rest]
    })
    return dto
  }, [])

  const connectHub = useCallback(
    async (token: string) => {
      await hubRef.current?.stop().catch(() => undefined)
      const conn = new HubConnectionBuilder()
        .withUrl(`${API_URL}/hubs/game`, { accessTokenFactory: () => token })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build()
      conn.on('gameUpdated', (snap: ApiSnapshot) => applySnapshot(snap))
      conn.on('notice', (text: string) => pushToast(text))
      conn.on('roomUpdated', (dto: ApiRoom) => {
        const me = userRef.current
        if (!me) return
        const mapped = mapRoom(dto, me.id)
        setRooms((prev) => {
          const rest = prev.filter((r) => r.id !== mapped.id)
          return [mapped, ...rest]
        })
      })
      await conn.start()
      hubRef.current = conn
    },
    [applySnapshot, pushToast],
  )

  const enterSession = useCallback(
    async (auth: AuthPayload) => {
      setToken(auth.token)
      setUser(userFromAuth(auth))
      setAuthError('')
      await connectHub(auth.token)
      await refreshRooms()
      setView('rooms')
    },
    [connectHub, refreshRooms],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthToken = params.get('token')
    const boot = async () => {
      try {
        if (oauthToken) {
          setToken(oauthToken)
          window.history.replaceState({}, '', '/')
        }
        const token = getToken()
        if (!token) return
        const me = await api<AuthPayload>('/api/auth/me')
        await enterSession({ ...me, token: me.token || token })
      } catch {
        setToken(null)
      }
    }
    void boot()
    return () => {
      void hubRef.current?.stop()
    }
  }, [enterSession])

  useEffect(() => {
    if (view !== 'room' || !activeRoomId) return
    const tick = window.setInterval(() => {
      void refreshRoom(activeRoomId)
      void hubRef.current?.invoke('Heartbeat', activeRoomId).catch(() => undefined)
    }, 2500)
    void hubRef.current?.invoke('JoinRoom', activeRoomId).catch(() => undefined)
    return () => window.clearInterval(tick)
  }, [view, activeRoomId, refreshRoom])

  const login = async (email: string, password: string) => {
    try {
      const auth = await api<AuthPayload>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      await enterSession(auth)
    } catch (e) {
      fail(e)
    }
  }

  const register = async (name: string, email: string, password: string) => {
    try {
      const auth = await api<AuthPayload>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, userName: name }),
      })
      await enterSession(auth)
    } catch (e) {
      fail(e)
    }
  }

  const logout = () => {
    void hubRef.current?.stop()
    hubRef.current = null
    setToken(null)
    setUser(null)
    setRooms([])
    setActiveRoomId(null)
    setGame(null)
    setView('auth')
  }

  const createRoom = async (name: string) => {
    try {
      const dto = await api<ApiRoom>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      const me = userRef.current
      if (!me) return
      const mapped = mapRoom(dto, me.id)
      setRooms((r) => [mapped, ...r.filter((x) => x.id !== mapped.id)])
      setActiveRoomId(mapped.id)
      setRoomTab('lobby')
      setView('room')
    } catch (e) {
      fail(e)
    }
  }

  const joinRoom = async (code: string) => {
    try {
      const dto = await api<ApiRoom>('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      const me = userRef.current
      if (!me) return
      const mapped = mapRoom(dto, me.id)
      setRooms((r) => [mapped, ...r.filter((x) => x.id !== mapped.id)])
      setActiveRoomId(mapped.id)
      setRoomTab('lobby')
      setView('room')
      if (dto.activeGameId) {
        const snap = await api<ApiSnapshot>(`/api/rooms/${dto.id}/game`)
        applySnapshot(snap)
      }
    } catch (e) {
      fail(e)
    }
  }

  const openRoom = async (id: string) => {
    try {
      const dto = await refreshRoom(id)
      setActiveRoomId(id)
      setRoomTab('lobby')
      setView('room')
      if (dto.activeGameId) {
        const snap = await api<ApiSnapshot>(`/api/rooms/${id}/game`)
        applySnapshot(snap)
      }
    } catch (e) {
      fail(e)
    }
  }

  const backToRooms = async () => {
    if (game && game.phase !== 'complete' && game.phase !== 'cancelled') {
      pushToast('You cannot leave while a game is active.', 'danger')
      return
    }
    setGame(null)
    setActiveRoomId(null)
    setView('rooms')
    try {
      await refreshRooms()
    } catch (e) {
      fail(e)
    }
  }

  const toggleReady = async () => {
    if (!activeRoomId) return
    try {
      const dto = await api<ApiRoom>(`/api/rooms/${activeRoomId}/ready`, { method: 'POST' })
      const me = userRef.current
      if (!me) return
      setRooms((prev) => [mapRoom(dto, me.id), ...prev.filter((r) => r.id !== dto.id)])
    } catch (e) {
      fail(e)
    }
  }

  const fillBots = async () => {
    if (!activeRoomId) return
    try {
      const dto = await api<ApiRoom>(`/api/rooms/${activeRoomId}/bots`, { method: 'POST' })
      const me = userRef.current
      if (!me) return
      setRooms((prev) => [mapRoom(dto, me.id), ...prev.filter((r) => r.id !== dto.id)])
      pushToast('Table filled with dummy players.')
    } catch (e) {
      fail(e)
    }
  }

  const startGame = async () => {
    if (!activeRoomId) return
    try {
      const snap = await api<ApiSnapshot>(`/api/rooms/${activeRoomId}/start`, { method: 'POST' })
      await hubRef.current?.invoke('JoinRoom', activeRoomId)
      applySnapshot(snap)
      pushToast('Cards dealt. Bidding is open.')
    } catch (e) {
      fail(e)
    }
  }

  const kick = async (playerId: string) => {
    if (!activeRoomId) return
    try {
      const dto = await api<ApiRoom>(`/api/rooms/${activeRoomId}/kick`, {
        method: 'POST',
        body: JSON.stringify({ userId: playerId }),
      })
      const me = userRef.current
      if (!me) return
      setRooms((prev) => [mapRoom(dto, me.id), ...prev.filter((r) => r.id !== dto.id)])
    } catch (e) {
      fail(e)
    }
  }

  const transferOwner = async (playerId: string) => {
    if (!activeRoomId) return
    try {
      const dto = await api<ApiRoom>(`/api/rooms/${activeRoomId}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ userId: playerId }),
      })
      const me = userRef.current
      if (!me) return
      setRooms((prev) => [mapRoom(dto, me.id), ...prev.filter((r) => r.id !== dto.id)])
      pushToast('Ownership transferred.', 'info')
    } catch (e) {
      fail(e)
    }
  }

  const archiveRoom = async () => {
    if (!activeRoomId) return
    try {
      await api(`/api/rooms/${activeRoomId}/archive`, { method: 'POST' })
      setActiveRoomId(null)
      setView('rooms')
      await refreshRooms()
      pushToast('Room archived. History is preserved.', 'info')
    } catch (e) {
      fail(e)
    }
  }

  const invokeGame = async (method: string, ...args: unknown[]) => {
    const roomId = game?.roomId ?? activeRoomId
    if (!roomId) return
    try {
      if (hubRef.current?.state === 'Connected') {
        await hubRef.current.invoke(method, roomId, ...args)
        return
      }
      if (method === 'PlaceBid') {
        applySnapshot(await api<ApiSnapshot>(`/api/rooms/${roomId}/game/bid`, { method: 'POST', body: JSON.stringify({ amount: args[0] }) }))
      } else if (method === 'PassBid') {
        applySnapshot(await api<ApiSnapshot>(`/api/rooms/${roomId}/game/pass`, { method: 'POST' }))
      } else if (method === 'Select') {
        applySnapshot(await api<ApiSnapshot>(`/api/rooms/${roomId}/game/select`, { method: 'POST', body: JSON.stringify({ trump: args[0], conditions: args[1] }) }))
      } else if (method === 'PlayCard') {
        applySnapshot(await api<ApiSnapshot>(`/api/rooms/${roomId}/game/play`, { method: 'POST', body: JSON.stringify({ cardId: args[0] }) }))
      }
    } catch (e) {
      fail(e)
    }
  }

  const placeBid = (amount: number) => invokeGame('PlaceBid', amount)
  const passBid = () => invokeGame('PassBid')
  const confirmSelection = (trump: Suit, conditions: PartnerCondition[]) =>
    invokeGame('Select', trump, conditions)
  const playCard = (cardId: string) => invokeGame('PlayCard', cardId)

  const finishToLobby = async () => {
    const id = game?.roomId ?? activeRoomId
    setGame(null)
    setView('room')
    setRoomTab('history')
    if (id) {
      try {
        await refreshRoom(id)
      } catch (e) {
        fail(e)
      }
    }
  }

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      view,
      rooms,
      activeRoom,
      roomTab,
      game,
      toasts,
      authError,
      login,
      register,
      logout,
      createRoom,
      joinRoom,
      openRoom,
      backToRooms,
      setRoomTab,
      toggleReady,
      fillBots,
      startGame,
      kick,
      transferOwner,
      archiveRoom,
      placeBid,
      passBid,
      confirmSelection,
      playCard,
      finishToLobby,
    }),
    [user, view, rooms, activeRoom, roomTab, game, toasts, authError],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
