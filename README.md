# Three of Spades

React client for the **Three of Spades** game. It talks to the ASP.NET API over REST + SignalR.

## Run

Start Postgres + the API first (see `three-of-spades-backend`), then:

```bash
npm install
npm run dev
```

UI: [http://localhost:5173](http://localhost:5173)  
API default: `VITE_API_URL=http://localhost:5203`

## Play

1. Register with a **username** (shown at the table) or sign in.
2. Create a room or join with a code.
3. Owner: **Fill table with dummy players** (or wait for friends), everyone **Ready**, then **Start**.
4. Bid / pass, pick trump and partners if you win, play 13 tricks.
5. History and room stats update on the server after each hand.

Google/GitHub sign-in is not used. Register or sign in with email, password, and a username.
