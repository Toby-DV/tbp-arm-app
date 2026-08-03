export type {
  ConnectionStatus,
  DeviceInfo,
  DeviceSummary,
  DeviceTransport,
  SettingValues,
  Unsubscribe,
} from './types';

export { MockTransport, type MockOptions } from './MockTransport';

// Single place the app picks an implementation. Swapped for BleTransport later.
import { MockTransport } from './MockTransport';
export const transport = new MockTransport();
