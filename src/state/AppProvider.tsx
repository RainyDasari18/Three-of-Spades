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
import type {
  BidAction,
  Card,
  CompletedTrick,
  GamePhase,
  GameRecord,
  PartnerCondition,
  Player,
  Room,
  RoomTab,
  Suit,
  Toast,
  TrickPlay,
  User,
  View,
} from '../types'
import {
  buildActiveDeck,
  cardExistsInDeck,
  cardPoints,
  conditionLabel,
  copiesInDeck,
  dealHands,
  handPointCount,
  legalCards,
  lowestLegal,
  partnerConditionCount,
  signature,
  SUITS,
  trickWinner,
} from '../lib/cards'
import { BOT_NAMES, seedRooms } from '../lib/dummyData'

interface LiveGame {
  roomId: string
  players: Player[]
  dealerSeat: number
  phase: GamePhase
  currentTurn: number
  bid: number
  bidderSeat: number | null
  bidLog: BidAction[]
  passesSinceRaise: number
  hasAnyBid: boolean
  trump: Suit | null
  conditions: PartnerCondition[]
  playCounts: Record<string, number>
  partnerSeats: number[]
  currentTrick: TrickPlay[]
  leadSuit: Suit | null
  trickLeader: number
  trickNumber: number
  completedTricks: CompletedTrick[]
  teamPoints: number
  success: boolean | null
  activeDeck: Card[]
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
  login: (email: string, password: string, name?: string) => void
  register: (name: string, email: string, password: string) => void
  logout: () => void
  createRoom: (name: string) => void
  joinRoom: (code: string) => void
  openRoom: (id: string) => void
  backToRooms: () => void
  setRoomTab: (tab: RoomTab) => void
  toggleReady: () => void
  fillBots: () => void
  startGame: () => void
  kick: (playerId: string) => void
  transferOwner: (playerId: string) => void
  archiveRoom: () => void
  placeBid: (amount: number) => void
  passBid: () => void
  confirmSelection: (trump: Suit, conditions: PartnerCondition[]) => void
  playCard: (cardId: string) => void
  finishToLobby: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

function codeFor(name: string) {
  const raw = name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5)
  return `${raw || 'ROOM'}${Math.floor(10 + Math.random() * 89)}`
}

function clonePlayers(members: Player[]): Player[] {
  return members.map((m, seat) => ({
    ...m,
    seat,
    hand: [],
    pointsWon: 0,
    scoreDelta: 0,
  }))
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<View>('auth')
  const [rooms, setRooms] = useState<Room[]>(seedRooms)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [roomTab, setRoomTab] = useState<RoomTab>('lobby')
  const [game, setGame] = useState<LiveGame | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [authError, setAuthError] = useState('')
  const toastId = useRef(1)
  const gameRef = useRef<LiveGame | null>(null)
  gameRef.current = game

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null

  const pushToast = useCallback((text: string, tone: Toast['tone'] = 'gold') => {
    const id = toastId.current++
    setToasts((t) => [...t, { id, text, tone }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 3200)
  }, [])

  const login = (email: string, password: string, name?: string) => {
    if (!email.trim() || !password.trim()) {
      setAuthError('Enter email and password.')
      return
    }
    setAuthError('')
    setUser({
      id: 'you',
      name: name?.trim() || email.split('@')[0] || 'You',
      email: email.trim(),
    })
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        members: r.members.map((m) =>
          m.id === 'you' ? { ...m, name: name?.trim() || m.name } : m,
        ),
      })),
    )
    setView('rooms')
  }

  const register = (name: string, email: string, password: string) => {
    if (!name.trim()) {
      setAuthError('Name is required.')
      return
    }
    login(email, password, name)
  }

  const logout = () => {
    setUser(null)
    setView('auth')
    setActiveRoomId(null)
    setGame(null)
  }

  const createRoom = (name: string) => {
    if (!user) return
    const room: Room = {
      id: `room-${Date.now()}`,
      name: name.trim() || 'New room',
      code: codeFor(name),
      archived: false,
      ownerId: 'you',
      members: [
        {
          id: 'you',
          name: user.name,
          seat: 0,
          isHuman: true,
          isOwner: true,
          online: true,
          ready: false,
          hand: [],
          pointsWon: 0,
          scoreDelta: 0,
        },
      ],
      history: [],
      stats: {
        gamesPlayed: 0,
        bestBidder: '—',
        worstBidder: '—',
        bestBuddy: '—',
        worstBuddy: '—',
        leaderboard: [{ name: user.name, score: 0 }],
      },
    }
    setRooms((r) => [room, ...r])
    setActiveRoomId(room.id)
    setRoomTab('lobby')
    setView('room')
  }

  const joinRoom = (code: string) => {
    const room = rooms.find(
      (r) => r.code.toLowerCase() === code.trim().toLowerCase() && !r.archived,
    )
    if (!room) {
      pushToast('No room found for that code.', 'danger')
      return
    }
    setActiveRoomId(room.id)
    setRoomTab('lobby')
    setView('room')
  }

  const openRoom = (id: string) => {
    setActiveRoomId(id)
    setRoomTab('lobby')
    setView('room')
  }

  const backToRooms = () => {
    if (game && game.phase !== 'complete') {
      pushToast('You cannot leave while a game is active.', 'danger')
      return
    }
    setActiveRoomId(null)
    setGame(null)
    setView('rooms')
  }

  const patchRoom = (id: string, fn: (r: Room) => Room) => {
    setRooms((all) => all.map((r) => (r.id === id ? fn(r) : r)))
  }

  const toggleReady = () => {
    if (!activeRoom) return
    patchRoom(activeRoom.id, (r) => ({
      ...r,
      members: r.members.map((m) =>
        m.id === 'you' ? { ...m, ready: !m.ready } : m,
      ),
    }))
  }

  const fillBots = () => {
    if (!activeRoom || !user) return
    patchRoom(activeRoom.id, (r) => {
      const members = [...r.members]
      let i = 0
      while (members.length < 6 && i < BOT_NAMES.length) {
        const name = BOT_NAMES[i++]
        if (members.some((m) => m.name === name)) continue
        members.push({
          id: `bot-${name.toLowerCase()}`,
          name,
          seat: members.length,
          isHuman: false,
          isOwner: false,
          online: true,
          ready: true,
          hand: [],
          pointsWon: 0,
          scoreDelta: 0,
        })
      }
      return { ...r, members }
    })
    pushToast('Table filled with dummy players.')
  }

  const kick = (playerId: string) => {
    if (!activeRoom || activeRoom.ownerId !== 'you' || playerId === 'you') return
    patchRoom(activeRoom.id, (r) => ({
      ...r,
      members: r.members.filter((m) => m.id !== playerId),
    }))
  }

  const transferOwner = (playerId: string) => {
    if (!activeRoom || activeRoom.ownerId !== 'you') return
    patchRoom(activeRoom.id, (r) => ({
      ...r,
      ownerId: playerId,
      members: r.members.map((m) => ({
        ...m,
        isOwner: m.id === playerId,
      })),
    }))
    pushToast('Ownership transferred.', 'info')
  }

  const archiveRoom = () => {
    if (!activeRoom || activeRoom.ownerId !== 'you') return
    patchRoom(activeRoom.id, (r) => ({ ...r, archived: true }))
    setActiveRoomId(null)
    setView('rooms')
    pushToast('Room archived. History is preserved.', 'info')
  }

  const startGame = () => {
    if (!activeRoom) return
    const n = activeRoom.members.length
    if (activeRoom.ownerId !== 'you') {
      pushToast('Only the room owner can start a game.', 'danger')
      return
    }
    if (n < 5 || n > 8) {
      pushToast('Need 5–8 online players to start.', 'danger')
      return
    }
    if (activeRoom.members.some((m) => !m.online || !m.ready)) {
      pushToast('Every player must be online and ready.', 'danger')
      return
    }
    const players = clonePlayers(activeRoom.members).map((p) =>
      p.id === 'you' && user ? { ...p, name: user.name } : p,
    )
    const ownerSeat = players.findIndex((p) => p.id === activeRoom.ownerId)
    const dealerSeat = ownerSeat >= 0 ? ownerSeat : 0
    const { hands } = dealHands(n)
    players.forEach((p, i) => {
      p.hand = hands[i]
    })
    const first = (dealerSeat + 1) % n
    const live: LiveGame = {
      roomId: activeRoom.id,
      players,
      dealerSeat,
      phase: 'bidding',
      currentTurn: first,
      bid: 0,
      bidderSeat: null,
      bidLog: [],
      passesSinceRaise: 0,
      hasAnyBid: false,
      trump: null,
      conditions: [],
      playCounts: {},
      partnerSeats: [],
      currentTrick: [],
      leadSuit: null,
      trickLeader: 0,
      trickNumber: 1,
      completedTricks: [],
      teamPoints: 0,
      success: null,
      activeDeck: buildActiveDeck(n),
    }
    setGame(live)
    setView('game')
    pushToast('Cards dealt. Bidding is open.')
  }

  const applyBid = useCallback(
    (seat: number, kind: 'bid' | 'pass', amount?: number) => {
      setGame((g) => {
        if (!g || g.phase !== 'bidding' || g.currentTurn !== seat) return g
        const n = g.players.length
        const nextTurn = (seat + 1) % n
        const log: BidAction[] = [
          ...g.bidLog,
          kind === 'pass' ? { seat, kind: 'pass' } : { seat, kind: 'bid', amount },
        ]

        if (kind === 'pass') {
          const passes = g.passesSinceRaise + 1
          if (!g.hasAnyBid && passes >= n) {
            const forced = (g.dealerSeat + 1) % n
            return {
              ...g,
              bid: 100,
              bidderSeat: forced,
              hasAnyBid: true,
              currentTurn: forced,
              phase: 'selecting',
              bidLog: log,
              passesSinceRaise: 0,
            }
          }
          // High bidder wins as soon as every other player passes — they do not
          // need to confirm or pass again.
          if (g.hasAnyBid && passes >= n - 1) {
            const winnerSeat = g.bidderSeat ?? seat
            const winner = g.players[winnerSeat]
            window.setTimeout(() => {
              pushToast(`${winner.name} has the bid at ${g.bid}.`)
            }, 40)
            return {
              ...g,
              phase: 'selecting',
              currentTurn: winnerSeat,
              bidLog: log,
            }
          }
          return {
            ...g,
            currentTurn: nextTurn,
            passesSinceRaise: passes,
            bidLog: log,
          }
        }

        const value = amount ?? 0
        if (value < 100 || value > 500 || value <= g.bid) return g
        return {
          ...g,
          bid: value,
          bidderSeat: seat,
          hasAnyBid: true,
          passesSinceRaise: 0,
          currentTurn: nextTurn,
          bidLog: log,
        }
      })
    },
    [pushToast],
  )

  const placeBid = (amount: number) => {
    if (!game || !game.players[game.currentTurn]?.isHuman) return
    applyBid(game.currentTurn, 'bid', amount)
  }

  const passBid = () => {
    if (!game || !game.players[game.currentTurn]?.isHuman) return
    applyBid(game.currentTurn, 'pass')
  }

  const beginPlay = useCallback((g: LiveGame, trump: Suit, conditions: PartnerCondition[]): LiveGame => {
    const leader = g.bidderSeat ?? 0
    return {
      ...g,
      trump,
      conditions,
      phase: 'playing',
      currentTurn: leader,
      trickLeader: leader,
      currentTrick: [],
      leadSuit: null,
      trickNumber: 1,
    }
  }, [])

  const confirmSelection = (trump: Suit, conditions: PartnerCondition[]) => {
    const g = gameRef.current
    if (!g || g.phase !== 'selecting') return
    const need = partnerConditionCount(g.players.length)
    if (conditions.length !== need) {
      pushToast(`Select ${need} partner condition${need > 1 ? 's' : ''}.`, 'danger')
      return
    }
    const keys = conditions.map((c) => `${c.nth}${c.rank}${c.suit}`)
    if (new Set(keys).size !== keys.length) {
      pushToast('Duplicate partner conditions are not allowed.', 'danger')
      return
    }
    for (const c of conditions) {
      if (!cardExistsInDeck(g.activeDeck, c.rank, c.suit)) {
        pushToast('That card is not in the active deck.', 'danger')
        return
      }
      if (c.nth === 2 && copiesInDeck(g.activeDeck, c.rank, c.suit) < 2) {
        pushToast('There is no 2nd copy of that card.', 'danger')
        return
      }
    }
    setGame(beginPlay(g, trump, conditions))
    pushToast(`Trump is ${trump}. Partners stay hidden until the cards are played.`)
  }

  const pickBotSelection = useCallback((g: LiveGame) => {
    const bidder = g.players[g.bidderSeat ?? 0]
    const counts: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 }
    bidder.hand.forEach((c) => {
      counts[c.suit] += 1
    })
    const trump = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as Suit) || 'S'
    const need = partnerConditionCount(g.players.length)
    const options: PartnerCondition[] = []
    for (const rank of ['A', 'K', 'Q', 'J', '10'] as const) {
      for (const suit of SUITS) {
        if (!cardExistsInDeck(g.activeDeck, rank, suit)) continue
        options.push({ nth: 1, rank, suit })
        if (copiesInDeck(g.activeDeck, rank, suit) >= 2) {
          options.push({ nth: 2, rank, suit })
        }
      }
    }
    const conditions = options.slice(0, need)
    setGame(beginPlay(g, trump, conditions))
    pushToast(`${bidder.name} set trump and partner conditions.`)
  }, [beginPlay, pushToast])

  const scoreGame = useCallback((g: LiveGame): LiveGame => {
    const partners = [...new Set(g.partnerSeats)]
    const bidder = g.bidderSeat ?? 0
    const teamSeats = new Set([bidder, ...partners])
    const teamPoints = g.players.reduce(
      (sum, p) => (teamSeats.has(p.seat) ? sum + p.pointsWon : sum),
      0,
    )
    const success = teamPoints >= g.bid
    const players = g.players.map((p) => {
      let scoreDelta = 0
      const isBidder = p.seat === bidder
      const isPartner = partners.includes(p.seat) && !isBidder
      if (success) {
        if (isBidder) scoreDelta = 2 * g.bid
        else if (isPartner) scoreDelta = g.bid
      } else if (isBidder) scoreDelta = -g.bid
      else if (!isPartner) scoreDelta = g.bid
      return { ...p, scoreDelta }
    })
    return { ...g, players, teamPoints, success, phase: 'complete' }
  }, [])

  const applyPlay = useCallback(
    (seat: number, card: Card) => {
      setGame((g) => {
        if (!g || g.phase !== 'playing' || g.currentTurn !== seat) return g
        const player = g.players[seat]
        if (!player.hand.some((c) => c.id === card.id)) return g
        const legal = legalCards(player.hand, g.leadSuit)
        if (!legal.some((c) => c.id === card.id)) return g

        const leadSuit = g.currentTrick.length === 0 ? card.suit : g.leadSuit
        const currentTrick = [...g.currentTrick, { seat, card }]
        const playCounts = { ...g.playCounts }
        const sig = signature(card.rank, card.suit)
        playCounts[sig] = (playCounts[sig] ?? 0) + 1
        const nth = playCounts[sig] as 1 | 2
        let partnerSeats = g.partnerSeats
        const hit = g.conditions.find(
          (c) => c.rank === card.rank && c.suit === card.suit && c.nth === nth,
        )
        if (hit && !partnerSeats.includes(seat)) {
          partnerSeats = [...partnerSeats, seat]
          window.setTimeout(() => {
            pushToast(
              `${g.players[seat].name} is a partner (${conditionLabel(hit)})`,
            )
          }, 40)
        }

        const players = g.players.map((p) =>
          p.seat === seat ? { ...p, hand: p.hand.filter((c) => c.id !== card.id) } : p,
        )

        if (currentTrick.length < g.players.length) {
          return {
            ...g,
            players,
            currentTrick,
            leadSuit,
            playCounts,
            partnerSeats,
            currentTurn: (seat + 1) % g.players.length,
          }
        }

        const winner = trickWinner(currentTrick, g.trump as Suit, leadSuit as Suit)
        const points = currentTrick.reduce((s, p) => s + cardPoints(p.card), 0)
        const completed: CompletedTrick = {
          winnerSeat: winner,
          plays: currentTrick,
          points,
        }
        const withPoints = players.map((p) =>
          p.seat === winner ? { ...p, pointsWon: p.pointsWon + points } : p,
        )
        const trickNumber = g.trickNumber + 1
        const next: LiveGame = {
          ...g,
          players: withPoints,
          currentTrick: [],
          leadSuit: null,
          playCounts,
          partnerSeats,
          completedTricks: [...g.completedTricks, completed],
          trickLeader: winner,
          currentTurn: winner,
          trickNumber,
        }
        if (trickNumber > 13) return scoreGame(next)
        return next
      })
    },
    [pushToast, scoreGame],
  )

  const playCard = (cardId: string) => {
    const g = gameRef.current
    if (!g || g.phase !== 'playing') return
    const actor = g.players[g.currentTurn]
    if (!actor?.isHuman) return
    const card = actor.hand.find((c) => c.id === cardId)
    if (!card) return
    applyPlay(actor.seat, card)
  }

  const finishToLobby = () => {
    const g = gameRef.current
    if (!g || g.phase !== 'complete') return
    const bidder = g.players[g.bidderSeat ?? 0]
    const you = g.players.find((p) => p.isHuman)
    const record: GameRecord = {
      id: `g-${Date.now()}`,
      playedAt: new Date().toISOString(),
      playerCount: g.players.length,
      bidder: bidder.name,
      bid: g.bid,
      trump: g.trump ?? 'S',
      success: Boolean(g.success),
      teamPoints: g.teamPoints,
      yourScore: you?.scoreDelta ?? 0,
    }
    patchRoom(g.roomId, (r) => {
      const board = [...r.stats.leaderboard]
      g.players.forEach((p) => {
        const row = board.find((b) => b.name === p.name)
        if (row) row.score += p.scoreDelta
        else board.push({ name: p.name, score: p.scoreDelta })
      })
      board.sort((a, b) => b.score - a.score)
      const bidSuccess = g.players.filter((p) => p.seat === g.bidderSeat)
      return {
        ...r,
        members: r.members.map((m) => ({ ...m, ready: m.id !== 'you' })),
        history: [record, ...r.history],
        stats: {
          ...r.stats,
          gamesPlayed: r.stats.gamesPlayed + 1,
          bestBidder: bidSuccess[0] && g.success ? bidder.name : r.stats.bestBidder,
          worstBidder: !g.success ? bidder.name : r.stats.worstBidder,
          leaderboard: board,
        },
      }
    })
    setGame(null)
    setView('room')
    setRoomTab('history')
  }

  useEffect(() => {
    if (!game) return
    if (game.phase === 'bidding') {
      const actor = game.players[game.currentTurn]
      if (!actor || actor.isHuman) return
      const t = window.setTimeout(() => {
        const strength = handPointCount(actor.hand)
        const current = game.bid
        let raise = 0
        if (!game.hasAnyBid) {
          raise = strength >= 55 ? 100 : 0
        } else if (strength >= 100 && current <= 160) raise = Math.min(500, current + 20)
        else if (strength >= 75 && current < 140 && Math.random() > 0.45) {
          raise = current + 10
        }
        if (raise && raise > current && raise <= 500) applyBid(actor.seat, 'bid', raise)
        else applyBid(actor.seat, 'pass')
      }, 700)
      return () => window.clearTimeout(t)
    }
    if (game.phase === 'selecting') {
      const actor = game.players[game.bidderSeat ?? 0]
      if (!actor || actor.isHuman) return
      const t = window.setTimeout(() => pickBotSelection(game), 900)
      return () => window.clearTimeout(t)
    }
    if (game.phase === 'playing') {
      const actor = game.players[game.currentTurn]
      if (!actor || actor.isHuman) return
      const t = window.setTimeout(() => {
        const card = lowestLegal(actor.hand, game.leadSuit)
        applyPlay(actor.seat, card)
      }, 480)
      return () => window.clearTimeout(t)
    }
  }, [game, applyBid, applyPlay, pickBotSelection])

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
    [
      user,
      view,
      rooms,
      activeRoom,
      roomTab,
      game,
      toasts,
      authError,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
