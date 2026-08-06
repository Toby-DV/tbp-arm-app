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

// Must match SERVICE_UUID in arduino-code/gatt-server/src/main.cpp
const SETTINGS_SERVICE_UUID = 'c9f0f001-1fb5-459e-8fcc-c5c9c331914b';

const DEFAULT_SCAN_TIMEOUT_MS = 5000;

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

  async readSettings(): Promise<SettingValues> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async writeSetting(id: string, value: number): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async saveSettings(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async revertSettings(): Promise<SettingValues> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // --- live sensor data ---

  subscribeTelemetry(listener: (value: number) => void): Unsubscribe {
    throw new Error(NOT_IMPLEMENTED);
  }

  // --- internals ---

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
