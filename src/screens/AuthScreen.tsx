import { useState } from 'react'
import { Spade } from 'lucide-react'
import { useApp } from '../state/AppProvider'

export function AuthScreen() {
  const { login, register, authError } = useApp()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('Rainy')
  const [email, setEmail] = useState('rainy@spades.dev')
  const [password, setPassword] = useState('password')
  const [busy, setBusy] = useState(false)

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center gap-16 px-6 py-12">
      <div className="hidden flex-1 md:block">
        <p className="text-sm tracking-[0.3em] text-gold-dim uppercase text-[color:var(--color-gold)]">
          Trick-taking · Hidden partners
        </p>
        <h1 className="font-display mt-3 text-7xl leading-[0.9] text-[color:var(--color-gold)]">
          Three of Spades
        </h1>
        <p className="mt-6 max-w-md text-lg text-[color:var(--color-muted)]">
          Bid, name hidden partners, cut with trump, and chase 500 points. Online with friends.
        </p>
        <div className="mt-10 flex gap-6 text-sm text-[color:var(--color-muted)]">
          <div>
            <div className="text-2xl text-[color:var(--color-gold)]">5–8</div>
            Players
          </div>
          <div>
            <div className="text-2xl text-[color:var(--color-gold)]">500</div>
            Point pool
          </div>
          <div>
            <div className="text-2xl text-[color:var(--color-gold)]">13</div>
            Tricks
          </div>
        </div>
      </div>

      <form
        className="w-full max-w-md rounded-3xl border border-white/10 bg-black/25 p-8 gold-ring backdrop-blur"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            if (!email.trim() || !password) return
            if (mode === 'register' && name.trim().length < 2) return
            if (mode === 'login') await login(email, password)
            else await register(name, email, password)
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="mb-6 flex items-center gap-3">
          <Spade className="h-7 w-7 text-[color:var(--color-gold)]" fill="currentColor" />
          <div>
            <div className="font-display text-2xl">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </div>
          </div>
        </div>

        {mode === 'register' && (
          <label className="mb-3 block text-sm">
            Username
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-[color:var(--color-gold)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label className="mb-3 block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-[color:var(--color-gold)]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mb-4 block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-[color:var(--color-gold)]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {authError && <p className="mb-3 text-sm text-[color:var(--color-danger)]">{authError}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[color:var(--color-gold)] py-3 font-semibold text-black hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>
        <button
          type="button"
          className="mt-4 w-full text-sm text-[color:var(--color-muted)] hover:text-white"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
