import type { GameRecord, Player, Room, RoomStats } from '../types'

function member(
  id: string,
  name: string,
  seat: number,
  isOwner = false,
): Player {
  return {
    id,
    name,
    seat,
    isHuman: id === 'you',
    isOwner,
    online: true,
    ready: id !== 'you',
    hand: [],
    pointsWon: 0,
    scoreDelta: 0,
  }
}

export const BOT_NAMES = [
  'Aisha',
  'Vikram',
  'Meera',
  'Arjun',
  'Priya',
  'Kabir',
  'Noor',
]

const fridayHistory: GameRecord[] = [
  {
    id: 'g-101',
    playedAt: '2026-08-14T21:10:00',
    playerCount: 6,
    bidder: 'Aisha',
    bid: 160,
    trump: 'S',
    success: true,
    teamPoints: 210,
    yourScore: 0,
  },
  {
    id: 'g-102',
    playedAt: '2026-08-16T20:40:00',
    playerCount: 6,
    bidder: 'You',
    bid: 140,
    trump: 'H',
    success: false,
    teamPoints: 95,
    yourScore: -140,
  },
  {
    id: 'g-103',
    playedAt: '2026-08-18T19:05:00',
    playerCount: 5,
    bidder: 'Vikram',
    bid: 180,
    trump: 'C',
    success: true,
    teamPoints: 240,
    yourScore: 180,
  },
]

const fridayStats: RoomStats = {
  gamesPlayed: 12,
  bestBidder: 'Aisha',
  worstBidder: 'Arjun',
  bestBuddy: 'You',
  worstBuddy: 'Priya',
  leaderboard: [
    { name: 'Aisha', score: 1240 },
    { name: 'You', score: 980 },
    { name: 'Vikram', score: 860 },
    { name: 'Meera', score: 640 },
    { name: 'Arjun', score: 120 },
    { name: 'Priya', score: 40 },
  ],
}

export function seedRooms(): Room[] {
  return [
    {
      id: 'room-friday',
      name: 'Friday Night',
      code: 'SPADE3',
      archived: false,
      ownerId: 'you',
      members: [
        member('you', 'You', 0, true),
        member('aisha', 'Aisha', 1),
        member('vikram', 'Vikram', 2),
        member('meera', 'Meera', 3),
        member('arjun', 'Arjun', 4),
        member('priya', 'Priya', 5),
      ],
      history: fridayHistory,
      stats: fridayStats,
    },
    {
      id: 'room-weekend',
      name: 'Weekend Cut',
      code: 'CUT500',
      archived: false,
      ownerId: 'kabir',
      members: [
        member('kabir', 'Kabir', 0, true),
        member('noor', 'Noor', 1),
        member('aisha', 'Aisha', 2),
        member('you', 'You', 3),
        member('meera', 'Meera', 4),
      ],
      history: [
        {
          id: 'g-201',
          playedAt: '2026-08-10T18:00:00',
          playerCount: 5,
          bidder: 'Kabir',
          bid: 200,
          trump: 'D',
          success: true,
          teamPoints: 265,
          yourScore: 0,
        },
      ],
      stats: {
        gamesPlayed: 4,
        bestBidder: 'Kabir',
        worstBidder: 'Noor',
        bestBuddy: 'Meera',
        worstBuddy: 'Aisha',
        leaderboard: [
          { name: 'Kabir', score: 800 },
          { name: 'Meera', score: 400 },
          { name: 'You', score: 200 },
          { name: 'Aisha', score: 0 },
          { name: 'Noor', score: -200 },
        ],
      },
    },
  ]
}
