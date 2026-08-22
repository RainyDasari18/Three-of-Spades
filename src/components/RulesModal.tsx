import { useState, type ReactNode } from 'react'
import { BookOpen, X } from 'lucide-react'

export function RulesButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
      >
        <BookOpen className="h-4 w-4" /> Rules
      </button>
      {open && <RulesModal onClose={() => setOpen(false)} />}
    </>
  )
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-[min(720px,96vw)] overflow-auto rounded-3xl border border-[color:var(--color-gold)]/40 bg-[#0b241c] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.25em] text-[color:var(--color-gold)] uppercase">
              Rules v1.0
            </p>
            <h2 className="font-display text-4xl text-[color:var(--color-gold)]">How to play</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 hover:bg-white/10"
            aria-label="Close rules"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-[color:var(--color-ink)]">
          <Section title="The table">
            <p>
              Three of Spades is a 5–8 player trick-taking game. Each hand deals 13 cards. Two
              decks are mixed, then extra 0-point cards are stripped so the pack is exactly{' '}
              <strong>players × 13</strong>. The 3 of spades is never stripped. The 3♠ is worth{' '}
              <strong>30</strong> points. Tens, jacks, queens, kings, and aces are 10. Fives are 5.
              Other cards are 0. The team that takes the bid is chasing a <strong>500-point</strong>{' '}
              pool, but only their own trick points count toward making the bid.
            </p>
          </Section>

          <Section title="Start a room">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Create a room or join with the room code.</li>
              <li>Need 5–8 players. The owner can fill empty seats with dummy players.</li>
              <li>Everyone clicks Ready. The owner starts. No spectators, no late joins.</li>
              <li>You cannot leave while a hand is active. Stay on the tab if you can.</li>
            </ol>
          </Section>

          <Section title="Bidding">
            <p>
              Bidding starts to the dealer’s left. Bids are <strong>100–500</strong> and must beat
              the current high bid. You may pass and come back in later. After a raise, the high
              bidder wins when everyone else has passed (<em>n − 1</em> passes). If everyone passes
              with no bid, the player to the dealer’s right is forced to 100.
            </p>
          </Section>

          <Section title="Trump and partners">
            <p>
              The winner of the bid chooses a cut (trump) suit and names hidden partner conditions:
              1 condition with 5 players, 2 with 6, 3 with 7, 4 with 8. Each condition is “1st” or
              “2nd” copy of a rank and suit (for example 1st Ace of Hearts). When that copy is
              played, that player is revealed as a partner. You may name a card you hold (self-partner).
              Partners stay hidden until those cards hit the table.
            </p>
          </Section>

          <Section title="Play">
            <p>
              The bidder leads the first trick. Follow the lead suit if you can. If you cannot
              follow, you may play trump or any other suit. Trump beats non-trump. If two identical
              cards are played, the <strong>later</strong> copy wins the trick. Trick points stay
              hidden until all 13 tricks are done. Click a highlighted card on your turn to play it.
            </p>
          </Section>

          <Section title="Scoring">
            <p>After 13 tricks, add the bidder’s team points (bidder + revealed partners).</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Bid made:</strong> bidder scores +2 × bid. Each distinct partner scores
                +bid. Everyone else scores 0.
              </li>
              <li>
                <strong>Bid failed:</strong> bidder scores −bid. Partners score 0. Everyone else
                scores +bid.
              </li>
            </ul>
            <p className="mt-2">
              Room history and stats update when the hand is over. Return to the room to start the
              next deal.
            </p>
          </Section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-[color:var(--color-gold)] py-3 font-semibold text-black"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 font-medium text-[color:var(--color-gold)]">{title}</h3>
      {children}
    </section>
  )
}
