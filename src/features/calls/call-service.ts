import { supabase } from '../../lib/supabase';
import type { Call, CallStatus, CallType } from './types';

function asCall(data: unknown): Call {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== 'object' || !('id' in value)) {
    throw new Error('call_response_invalid');
  }
  return value as Call;
}

export async function createCall(callType: CallType = 'audio'): Promise<Call> {
  const { data, error } = await supabase.rpc('create_call', { requested_call_type: callType });
  if (error) {
    throw new Error(error.message);
  }
  return asCall(data);
}

export async function updateCallStatus(callId: string, status: CallStatus): Promise<Call> {
  const { data, error } = await supabase.rpc('update_call_status', { target_call_id: callId, new_status: status });
  if (error) {
    throw new Error(error.message);
  }
  return asCall(data);
}

export async function getLiveKitToken(callId: string): Promise<{ token: string; serverUrl: string }> {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: { callId },
  });
  if (error) {
    throw new Error(error.message);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data;
}

export async function getActiveCall(): Promise<Call | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
    .in('status', ['ringing', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (error) {
    throw new Error(error.message);
  }
  return data as Call | null;
}

export async function expireStaleCalls(): Promise<void> {
  const { error } = await supabase.rpc('expire_stale_calls');
  if (error) {
    throw new Error(error.message);
  }
}
