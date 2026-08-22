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
  isolateTabSession,
  peekStoredToken,
  getStoredLocation,
  setStoredLocation,
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
  turnEndsAt: string | null
}

interface AppContextValue {
  user: User | null
  booting: boolean
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
  leaveRoom: () => Promise<void>
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
      isBot: m.isBot,
      online: m.online,
      ready: m.ready,
      hand: [],
      pointsWon: 0,
      scoreDelta: 0,
    })),
    history: (dto.history ?? []).map(
      (g): GameRecord => ({
        id: g.id,
        playedAt: g.playedAt,
        playerCount: g.playerCount,
        bidder: g.bidder,
        bid: g.bid,
        trump: g.trump as Suit,
        success: g.success,
        teamPoints: g.teamPoints,
        yourScore: g.yourScore ?? 0,
      }),
    ),
    stats: {
      gamesPlayed: dto.stats?.gamesPlayed ?? 0,
      bestBidder: dto.stats?.bestBidder ?? '—',
      worstBidder: dto.stats?.worstBidder ?? '—',
      bestBuddy: dto.stats?.bestBuddy ?? '—',
      worstBuddy: dto.stats?.worstBuddy ?? '—',
      leaderboard: dto.stats?.leaderboard ?? [],
    },
  }
}

function mapGame(snap: ApiSnapshot, userId: string): LiveGame {
  const phase = String(snap.phase ?? '').toLowerCase() as GamePhase
  const yourHand = (snap.yourHand ?? []).map(card)
  const currentTurn = Number(snap.currentTurn)
  const dealerSeat = Number(snap.dealerSeat)
  const bidderSeat = snap.bidderSeat == null ? null : Number(snap.bidderSeat)
  return {
    roomId: snap.roomId,
    dealerSeat,
    phase: phase === 'cancelled' ? 'cancelled' : phase,
    currentTurn,
    bid: Number(snap.bid) || 0,
    bidderSeat,
    bidLog: (snap.bidLog ?? []).map((b) => ({
      seat: Number(b.seat),
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
    partnerSeats: (snap.partnerSeats ?? []).map(Number),
    currentTrick: (snap.currentTrick ?? []).map((t) => ({ seat: Number(t.seat), card: card(t.card) })),
    leadSuit: (snap.leadSuit as Suit | null) ?? null,
    trickNumber: Number(snap.trickNumber) || 1,
    teamPoints: snap.teamPoints,
    success: snap.success,
    activeDeck: buildActiveDeck(snap.players.length),
    playable: (snap.playable ?? []).map(card),
    cancelReason: snap.cancelReason,
    turnEndsAt: snap.turnEndsAt ?? null,
    players: [...(snap.players ?? [])]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => {
      const mine = p.userId.toLowerCase() === userId.toLowerCase()
      return {
        id: p.userId,
        name: p.userName,
        seat: Number(p.seat),
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
  const [booting, setBooting] = useState(() => Boolean(peekStoredToken()))
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

  useEffect(() => {
    if (booting) return
    if (activeRoomId && (view === 'room' || view === 'game')) setStoredLocation(activeRoomId)
    else setStoredLocation(null)
  }, [booting, activeRoomId, view])

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

  const ignoreFinishedHand = useRef(false)

  const applySnapshot = useCallback(
    (snap: ApiSnapshot) => {
      const me = userRef.current
      if (!me) return
      const phase = String(snap.phase ?? '').toLowerCase()
      if (phase === 'cancelled') {
        ignoreFinishedHand.current = true
        setGame(null)
        setView('room')
        pushToast(snap.cancelReason || 'Game cancelled.', 'danger')
        return
      }
      if (ignoreFinishedHand.current) {
        if (phase === 'complete') return
        ignoreFinishedHand.current = false
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
    async (_token: string) => {
      await hubRef.current?.stop().catch(() => undefined)
      const conn = new HubConnectionBuilder()
        .withUrl(`${API_URL}/hubs/game`, { accessTokenFactory: () => getToken() ?? '' })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build()
      conn.on('gameUpdated', (snap: ApiSnapshot) => applySnapshot(snap))
      conn.on('notice', (text: string) => pushToast(text))
      conn.on('kickedFromRoom', (roomId: string) => {
        pushToast('You were removed from the room.', 'danger')
        if (roomIdRef.current === roomId) {
          setGame(null)
          setActiveRoomId(null)
          setView('rooms')
        }
        setRooms((prev) => prev.filter((r) => r.id !== roomId))
      })
      conn.on('roomUpdated', (dto: ApiRoom) => {
        const me = userRef.current
        if (!me) return
        const mapped = mapRoom(dto, me.id)
        if (mapped.archived && roomIdRef.current === mapped.id) {
          setGame(null)
          setActiveRoomId(null)
          setView('rooms')
          pushToast('Room was archived.', 'info')
        }
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
      try {
        await connectHub(auth.token)
      } catch {
        /* rooms still load over HTTP */
      }
      await refreshRooms()
      const loc = getStoredLocation()
      if (loc?.roomId) {
        try {
          const dto = await refreshRoom(loc.roomId)
          setActiveRoomId(loc.roomId)
          setRoomTab('lobby')
          setView('room')
          if (dto.activeGameId) {
            try {
              const snap = await api<ApiSnapshot>(`/api/rooms/${loc.roomId}/game`)
              const phase = String(snap.phase ?? '').toLowerCase()
              if (phase !== 'complete' && phase !== 'cancelled') applySnapshot(snap)
            } catch {
              /* hand already finished */
            }
          }
        } catch {
          setStoredLocation(null)
          setView('rooms')
        }
      } else {
        setView('rooms')
      }
      setBooting(false)
    },
    [applySnapshot, connectHub, refreshRoom, refreshRooms],
  )

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      await isolateTabSession()
      if (cancelled) return
      try {
        const token = getToken()
        if (!token) {
          setBooting(false)
          return
        }
        const me = await api<AuthPayload>('/api/auth/me')
        if (cancelled) return
        await enterSession({ ...me, token: me.token || token })
      } catch {
        if (cancelled) return
        setToken(null)
        setUser(null)
        setView('auth')
        setBooting(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [enterSession])

  useEffect(() => {
    if (view !== 'room' && view !== 'game') return
    if (!activeRoomId) return
    const tick = window.setInterval(() => {
      if (view === 'room') void refreshRoom(activeRoomId)
      void hubRef.current?.invoke('Heartbeat', activeRoomId).catch(() => undefined)
    }, 2500)
    void hubRef.current?.invoke('JoinRoom', activeRoomId).catch(() => undefined)
    return () => window.clearInterval(tick)
  }, [view, activeRoomId, refreshRoom])

  useEffect(() => {
    if (view !== 'game' || !activeRoomId) return
    let cancelled = false
    const poll = async () => {
      try {
        const snap = await api<ApiSnapshot>(`/api/rooms/${activeRoomId}/game`)
        if (!cancelled) applySnapshot(snap)
      } catch {
        /* table may not be ready */
      }
    }
    const tick = window.setInterval(() => void poll(), 800)
    void poll()
    return () => {
      cancelled = true
      window.clearInterval(tick)
    }
  }, [view, activeRoomId, applySnapshot])

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
    const trimmed = code.trim()
    if (!trimmed) {
      pushToast('Enter a room code.', 'danger')
      return
    }
    try {
      const dto = await api<ApiRoom>('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ code: trimmed }),
      })
      const me = userRef.current
      if (!me) return
      const mapped = mapRoom(dto, me.id)
      setRooms((r) => [mapped, ...r.filter((x) => x.id !== mapped.id)])
      setActiveRoomId(mapped.id)
      setRoomTab('lobby')
      setView('room')
      if (dto.activeGameId) {
        try {
          const snap = await api<ApiSnapshot>(`/api/rooms/${dto.id}/game`)
          const phase = String(snap.phase ?? '').toLowerCase()
          if (phase !== 'complete' && phase !== 'cancelled') applySnapshot(snap)
        } catch {
          /* hand already finished */
        }
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
        try {
          const snap = await api<ApiSnapshot>(`/api/rooms/${id}/game`)
          const phase = String(snap.phase ?? '').toLowerCase()
          if (phase !== 'complete' && phase !== 'cancelled') applySnapshot(snap)
        } catch {
          /* hand already finished */
        }
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
      await hubRef.current?.invoke('JoinRoom', activeRoomId).catch(() => undefined)
      ignoreFinishedHand.current = false
      const snap = await api<ApiSnapshot>(`/api/rooms/${activeRoomId}/start`, { method: 'POST' })
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

  const leaveRoom = async () => {
    if (!activeRoomId) return
    if (game && game.phase !== 'complete' && game.phase !== 'cancelled') {
      pushToast('You cannot leave while a game is active.', 'danger')
      return
    }
    try {
      await api(`/api/rooms/${activeRoomId}/leave`, { method: 'POST' })
      setActiveRoomId(null)
      setGame(null)
      setView('rooms')
      await refreshRooms()
      pushToast('You left the room.', 'info')
    } catch (e) {
      fail(e)
    }
  }

  const invokeGame = async (method: string, ...args: unknown[]) => {
    const roomId = game?.roomId ?? activeRoomId
    if (!roomId) return
    try {
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
    ignoreFinishedHand.current = true
    setGame(null)
    if (id) setActiveRoomId(id)
    setRoomTab('history')
    setView('room')
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
      booting,
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
      leaveRoom,
      placeBid,
      passBid,
      confirmSelection,
      playCard,
      finishToLobby,
    }),
    [user, booting, view, rooms, activeRoom, roomTab, game, toasts, authError],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
