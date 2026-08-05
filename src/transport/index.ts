export type {
  ConnectionStatus,
  DeviceInfo,
  DeviceSummary,
  DeviceTransport,
  SettingValues,
  Unsubscribe,
} from './types';

export { MockTransport, type MockOptions } from './MockTransport';
export { BleTransport } from './BleTransport';

import { BleTransport } from './BleTransport';
// Single place the app picks an implementation.
export const transport = new BleTransport();