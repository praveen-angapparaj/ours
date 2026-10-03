import { Component, type ErrorInfo, type ReactNode } from 'react'

type CallRoomErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
}

type CallRoomErrorBoundaryState = {
  failed: boolean
}

// A browser- or device-specific LiveKit rendering failure must never turn an
// active call into a blank page. Retry creates a fresh Room through its key.
export class CallRoomErrorBoundary extends Component<CallRoomErrorBoundaryProps, CallRoomErrorBoundaryState> {
  state: CallRoomErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): CallRoomErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Call room render failed', error, info)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
