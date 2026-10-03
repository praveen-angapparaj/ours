import { Component, type ErrorInfo, type ReactNode } from 'react'

type WatchPlayerErrorBoundaryProps = { children: ReactNode; fallback: ReactNode }
type WatchPlayerErrorBoundaryState = { failed: boolean }

export class WatchPlayerErrorBoundary extends Component<WatchPlayerErrorBoundaryProps, WatchPlayerErrorBoundaryState> {
  state: WatchPlayerErrorBoundaryState = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Shared YouTube player failed to render.', error, info)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
