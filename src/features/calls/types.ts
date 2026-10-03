export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'cancelled' | 'missed' | 'ended';
export type CallType = 'audio' | 'video';

export interface Call {
  id: string;
  couple_id: string;
  caller_id: string;
  callee_id: string;
  room_name: string;
  call_type: CallType;
  status: CallStatus;
  created_at: string;
  ring_expires_at: string;
  answered_at: string | null;
  ended_at: string | null;
}

export type CallRuntimeState =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'outgoing-ringing', call: Call }
  | { status: 'incoming-ringing', call: Call }
  | { status: 'accepting', call: Call }
  | { status: 'connecting', call: Call, token?: string, serverUrl?: string, attempt: number }
  | { status: 'connected', call: Call, token: string, serverUrl: string };

export type LiveCallRuntimeState = Extract<CallRuntimeState, { status: 'connecting' | 'connected' }>;

export function isLiveCallState(state: CallRuntimeState): state is LiveCallRuntimeState {
  return state.status === 'connecting' || state.status === 'connected';
}
