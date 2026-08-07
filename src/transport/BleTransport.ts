import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import type {
  ConnectionStatus,
  DeviceInfo,
  DeviceSummary,
  DeviceTransport,
  SettingValues,
  Unsubscribe,
} from './types';

const NOT_IMPLEMENTED = 'BleTransport: not implemented yet';

// UUIDs and wire format below must match arduino-code/gatt-server/src/main.cpp
const SETTINGS_SERVICE_UUID = 'c9f0f001-1fb5-459e-8fcc-c5c9c331914b';
const SYNC_CHAR_UUID = 'c9f0f002-1fb5-459e-8fcc-c5c9c331914b';
const CONTROL_CHAR_UUID = 'c9f0f003-1fb5-459e-8fcc-c5c9c331914b';

const DEFAULT_SCAN_TIMEOUT_MS = 5000;
const SYNC_TIMEOUT_MS = 3000;

// Index = SettingId enum value on the firmware.
const SETTING_IDS = ['openSpeed', 'gripForce', 'wristSpeed', 'sleepTimeout', 'sensitivity', 'haptics'] as const;

enum ControlCommand {
  RequestSync = 0x00,
  Write = 0x01,
  Save = 0x02,
  Revert = 0x03,
}

// react-native-ble-plx characteristic values are base64 strings; encode/decode
// by hand rather than pull in a Buffer polyfill for a handful of bytes.
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: number[]): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [b0, b1, b2] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    result += b1 === undefined ? '=' : BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    result += b2 === undefined ? '=' : BASE64_CHARS[b2 & 0x3f];
  }
  return result;
}

function base64ToBytes(base64: string): Uint8Array {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of base64) {
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

// Mirrors SettingPacket in main.cpp: uint8 id + int16 value, little-endian.
function encodeSettingPacket(id: number, value: number): number[] {
  return [id, value & 0xff, (value >> 8) & 0xff];
}

function decodeSettingPacket(bytes: Uint8Array): { id: number; value: number } {
  const id = bytes[0];
  let value = bytes[1] | (bytes[2] << 8);
  if (value & 0x8000) value -= 0x10000; // sign-extend int16
  return { id, value };
}

export class BleTransport implements DeviceTransport {
  private manager = new BleManager();
  private connectedDevice: Device | null = null;

  private status: ConnectionStatus = 'disconnected';
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  // --- discovery and connection ---

  async scan(timeoutMs = DEFAULT_SCAN_TIMEOUT_MS): Promise<DeviceSummary[]> {
    await this.ensurePermissions();

    const found = new Map<string, DeviceSummary>();
    this.setStatus('scanning');

    return new Promise((resolve, reject) => {
      this.manager.startDeviceScan([SETTINGS_SERVICE_UUID], null, (error, device) => {
        if (error) {
          this.manager.stopDeviceScan();
          this.setStatus('disconnected');
          reject(error);
          return;
        }
        if (device) {
          found.set(device.id, { id: device.id, name: device.name ?? device.id });
        }
      });

      setTimeout(() => {
        this.manager.stopDeviceScan();
        this.setStatus('disconnected');
        resolve(Array.from(found.values()));
      }, timeoutMs);
    });
  }

  async connect(deviceId: string): Promise<DeviceInfo> {
    await this.ensurePermissions();
    this.setStatus('connecting');

    let device: Device;
    try {
      device = await this.manager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
    } catch (error) {
      this.setStatus('disconnected');
      throw error;
    }

    // Fires on a clean disconnect() below, and also on an unexpected drop
    device.onDisconnected(() => {
      this.connectedDevice = null;
      this.setStatus('disconnected');
    });

    this.connectedDevice = device;
    this.setStatus('connected');
    return this.toDeviceInfo(device);
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      await this.manager.cancelDeviceConnection(this.connectedDevice.id);
    }
    this.connectedDevice = null;
    this.setStatus('disconnected');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getConnectedDevice(): DeviceInfo | null {
    return this.connectedDevice ? this.toDeviceInfo(this.connectedDevice) : null;
  }

  subscribeStatusChange(listener: (status: ConnectionStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // --- settings ---

  // CMD_REQUEST_SYNC doesn't touch live values, just asks the firmware to
  // notify the current ones back.
  async readSettings(): Promise<SettingValues> {
    return this.requestSync(ControlCommand.RequestSync);
  }

  async writeSetting(id: string, value: number): Promise<void> {
    const device = this.requireConnected();
    const settingId = (SETTING_IDS as readonly string[]).indexOf(id);
    if (settingId === -1) {
      throw new Error(`Unknown setting: ${id}`);
    }

    await device.writeCharacteristicWithResponseForService(
      SETTINGS_SERVICE_UUID,
      CONTROL_CHAR_UUID,
      bytesToBase64([ControlCommand.Write, ...encodeSettingPacket(settingId, value)]),
    );
  }

  async saveSettings(): Promise<void> {
    const device = this.requireConnected();
    await device.writeCharacteristicWithResponseForService(
      SETTINGS_SERVICE_UUID,
      CONTROL_CHAR_UUID,
      bytesToBase64([ControlCommand.Save]),
    );
  }

  // CMD_REVERT makes the firmware overwrite live with flash, then it pushes a
  // sync burst on its own — same notify wait as readSettings.
  async revertSettings(): Promise<SettingValues> {
    return this.requestSync(ControlCommand.Revert);
  }

  // --- live sensor data ---

  subscribeTelemetry(listener: (value: number) => void): Unsubscribe {
    throw new Error(NOT_IMPLEMENTED);
  }

  // --- internals ---

  // Writes a no-payload control command and collects the resulting
  // SETTING_COUNT notify packets on the sync characteristic into one object.
  // Used by both readSettings (CMD_REQUEST_SYNC) and revertSettings
  // (CMD_REVERT), which both end in the firmware pushing a sync burst.
  private requestSync(command: ControlCommand.RequestSync | ControlCommand.Revert): Promise<SettingValues> {
    const device = this.requireConnected();

    return new Promise((resolve, reject) => {
      const values: SettingValues = {};

      const timeout = setTimeout(() => {
        subscription.remove();
        reject(new Error('Timed out waiting for settings sync'));
      }, SYNC_TIMEOUT_MS);

      const subscription = device.monitorCharacteristicForService(
        SETTINGS_SERVICE_UUID,
        SYNC_CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            clearTimeout(timeout);
            subscription.remove();
            reject(error);
            return;
          }
          if (!characteristic?.value) return;

          const { id, value } = decodeSettingPacket(base64ToBytes(characteristic.value));
          const key = SETTING_IDS[id];
          if (!key) return;
          values[key] = value;

          if (Object.keys(values).length === SETTING_IDS.length) {
            clearTimeout(timeout);
            subscription.remove();
            resolve(values);
          }
        },
      );

      device
        .writeCharacteristicWithResponseForService(SETTINGS_SERVICE_UUID, CONTROL_CHAR_UUID, bytesToBase64([command]))
        .catch((error) => {
          clearTimeout(timeout);
          subscription.remove();
          reject(error);
        });
    });
  }

  private requireConnected(): Device {
    if (!this.connectedDevice) {
      throw new Error('Not connected');
    }
    return this.connectedDevice;
  }

  // BLUETOOTH_SCAN/CONNECT (API 31+) and ACCESS_FINE_LOCATION (For Android)
  private async ensurePermissions(): Promise<void> {
    if (Platform.OS !== 'android') return;

    const permissions =
      Platform.Version >= 31
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

    const results = await PermissionsAndroid.requestMultiple(permissions);
    const denied = permissions.filter((p) => results[p] !== PermissionsAndroid.RESULTS.GRANTED);
    if (denied.length > 0) {
      throw new Error(`Bluetooth permission denied: ${denied.join(', ')}`);
    }
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  // TODO: batteryPercent/firmwareVersion aren't exposed by any characteristic
  // under SETTINGS_SERVICE_UUID yet — fill these in once the firmware defines them.
  private toDeviceInfo(device: Device): DeviceInfo {
    return {
      id: device.id,
      name: device.name ?? device.id,
      batteryPercent: 0,
      firmwareVersion: 'unknown',
    };
  }
}
