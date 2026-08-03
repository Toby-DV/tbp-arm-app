/**
 * React bindings for the transport's two push-based APIs. Everything else on
 * DeviceTransport returns a promise and should be called directly from an
 * event handler — only subscriptions need bridging, because they carry an
 * unsubscribe obligation that a component body cannot honour.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

import { transport } from './index';
import type { ConnectionStatus } from './types';

const subscribeStatus = (cb: () => void) => transport.subscribeStatusChange(cb);
const getStatus = () => transport.getStatus();

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, getStatus);
}

// Latest muscle signal, 0-100. Streams only while mounted and connected; pass
// enabled=false to pause without unmounting.
export function useTelemetry(enabled = true): number {
  const status = useConnectionStatus();
  const [value, setValue] = useState(0);

  // This re-runs on every transition to resubscribe after a reconnect.
  useEffect(() => {
    if (!enabled || status !== 'connected') return;
    return transport.subscribeTelemetry(setValue);
  }, [enabled, status]);

  return value;
}
