import { useEffect } from 'react'
import { clearLocalKey } from '../utils/storage'

export const useClearLocalStorage = (keys: string[]) => {
  useEffect(
    () => () => {
      keys.forEach((key) => clearLocalKey(key))
    },
    [keys],
  )
}

