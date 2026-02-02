import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'

type RequestStatus = 'idle' | 'pending' | 'success' | 'error'

type RequestState = {
  [key: string]: {
    status: RequestStatus
    message?: string
    startedAt?: number
    finishedAt?: number
  }
}

type Action =
  | { type: 'START'; key: string }
  | { type: 'SUCCESS'; key: string; message?: string }
  | { type: 'ERROR'; key: string; message: string }
  | { type: 'RESET'; key?: string }

const reducer = (state: RequestState, action: Action): RequestState => {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        [action.key]: { status: 'pending', startedAt: Date.now() },
      }
    case 'SUCCESS':
      return {
        ...state,
        [action.key]: {
          status: 'success',
          message: action.message,
          startedAt: state[action.key]?.startedAt,
          finishedAt: Date.now(),
        },
      }
    case 'ERROR':
      return {
        ...state,
        [action.key]: {
          status: 'error',
          message: action.message,
          startedAt: state[action.key]?.startedAt,
          finishedAt: Date.now(),
        },
      }
    case 'RESET':
      if (!action.key) return {}
      const next = { ...state }
      delete next[action.key]
      return next
    default:
      return state
  }
}

type AIRequestContextValue = {
  state: RequestState
  start: (key: string) => void
  succeed: (key: string, message?: string) => void
  fail: (key: string, message: string) => void
  reset: (key?: string) => void
}

const AIRequestContext = createContext<AIRequestContextValue | null>(null)

export const AIRequestProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, {})

  const value = useMemo<AIRequestContextValue>(() => {
    const actions = {
      start: (key: string) => dispatch({ type: 'START', key }),
      succeed: (key: string, message?: string) => dispatch({ type: 'SUCCESS', key, message }),
      fail: (key: string, message: string) => dispatch({ type: 'ERROR', key, message }),
      reset: (key?: string) => dispatch({ type: 'RESET', key }),
    }
    return { state, ...actions }
  }, [state])

  return <AIRequestContext.Provider value={value}>{children}</AIRequestContext.Provider>
}

export const useAIRequest = () => {
  const ctx = useContext(AIRequestContext)
  if (!ctx) throw new Error('useAIRequest must be used within an AIRequestProvider')
  return ctx
}

