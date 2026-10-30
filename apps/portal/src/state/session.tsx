import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { api } from '../api'
import type { Session } from '../domain/types'

interface SessionContextValue {
  session: Session | null
  setSession: (s: Session | null) => void
  signOut: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => api.auth.currentSession())
  const signOut = useCallback(() => {
    api.auth.signOut()
    setSession(null)
  }, [])
  return <SessionContext.Provider value={{ session, setSession, signOut }}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
