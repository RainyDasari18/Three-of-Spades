# Three of Spades

Browser UI for the **Three of Spades** trick-taking game (rules v1.0). This is a React client with **dummy data** — no backend, JWT, or SignalR yet.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Dummy walkthrough

1. Sign in (any email/password works). Register is the same, dummy-only.
2. Open **Friday Night** (`SPADE3`) — you are the owner, six players are already seated.
3. Click **Ready**, then **Start game**.
4. Bid or pass. Dummy seats bid automatically. Range 100–500; pass and re-enter is allowed.
5. If you win the bid, pick a trump (cut) suit and the required partner conditions (1–4 by table size).
6. Play 13 tricks. You must follow suit. Partners reveal when their named card is played.
7. End-game scoring follows the spec. History and room stats update when you return to the room.

Create a new room and use **Fill table with dummy players** if you want a fresh table. Join **Weekend Cut** with code `CUT500` to see a room you do not own.

## What this UI covers

- Login / register
- Persistent rooms, create, join by code, members, owner kick/transfer/archive
- Ready + start gates (5–8, all online and ready)
- Deal, bidding, trump, hidden partners, self-partner, trick play, scoring
- History, leaderboard, best/worst bidder and buddy
- Leave blocked while a hand is active
