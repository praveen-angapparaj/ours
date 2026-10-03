import { useContext } from 'react'
import { WatchContext } from './WatchProvider'

export function useWatch() {
  const context = useContext(WatchContext)
  if (!context) throw new Error('useWatch must be used inside WatchProvider')
  return context
}
