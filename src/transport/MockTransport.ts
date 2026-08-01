import type {
  ConnectionStatus,
  DeviceInfo,
  DeviceSummary,
  DeviceTransport,
  SettingValues,
  Unsubscribe,
} from './types';

/** Knobs for exercising states that are painful to reproduce on real hardware. */
export type MockOptions = {
  /** How long a scan takes before resolving. */
  scanDelayMs: number;
  /** Round-trip delay applied to connects, reads and writes. */
  latencyMs: number;
  /** Arm asleep and not advertising — scans find nothing. */
  deviceAsleep: boolean;
  /** The next writeSetting call rejects, then this clears itself. */
  failNextWrite: boolean;
};

const DEFAULT_OPTIONS: MockOptions = {
  scanDelayMs: 1800,
  latencyMs: 120,
  deviceAsleep: false,
  failNextWrite: false,
};

const MOCK_DEVICE: DeviceInfo = {
  id: 'mock-arm-01',
  name: 'Prosthetic Arm',
  batteryPercent: 82,
  firmwareVersion: '0.1.0',
};

/** Values this fake arm ships with. Ids match those in ArmSettingsScreen. */
const FLASH_VALUES: SettingValues = {
  openSpeed: 70,
  gripForce: 55,
  wristSpeed: 90,
  sleepTimeout: 15,
  sensitivity: 75,
  haptics: 10,
};

const TELEMETRY_HZ = 20;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class MockTransport implements DeviceTransport {
  private options: MockOptions = { ...DEFAULT_OPTIONS };

  private status: ConnectionStatus = 'disconnected';
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  /** What the arm is running now. */
  private live: SettingValues = { ...FLASH_VALUES };
  /** What is committed to its flash. */
  private flash: SettingValues = { ...FLASH_VALUES };

  private telemetryListeners = new Set<(value: number) => void>();
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private telemetryValue = 30;

  /** Point a dev panel at this to force the states above. */
  setOptions(next: Partial<MockOptions>) {
    this.options = { ...this.options, ...next };
  }

  // --- discovery and connection ---

  async scan(timeoutMs?: number): Promise<DeviceSummary[]> {
    this.setStatus('scanning');
    await wait(timeoutMs ?? this.options.scanDelayMs);

    // Nothing found is a normal outcome, so the status returns to
    // disconnected rather than reporting an error.
    if (this.options.deviceAsleep) {
      this.setStatus('disconnected');
      return [];
    }

    this.setStatus('disconnected');
    return [{ id: MOCK_DEVICE.id, name: MOCK_DEVICE.name }];
  }

  async connect(deviceId: string): Promise<DeviceInfo> {
    if (deviceId !== MOCK_DEVICE.id) {
      throw new Error(`No such device: ${deviceId}`);
    }

    this.setStatus('connecting');
    await wait(this.options.latencyMs);
    this.setStatus('connected');
    return { ...MOCK_DEVICE };
  }

  async disconnect(): Promise<void> {
    this.stopTelemetry();
    this.setStatus('disconnected');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // --- settings ---

  async readSettings(): Promise<SettingValues> {
    this.requireConnected();
    await wait(this.options.latencyMs);
    return { ...this.live };
  }

  async writeSetting(id: string, value: number): Promise<void> {
    this.requireConnected();

    if (this.options.failNextWrite) {
      this.options.failNextWrite = false;
      throw new Error('Write rejected by device');
    }

    if (!(id in this.live)) {
      throw new Error(`Unknown setting: ${id}`);
    }

    await wait(this.options.latencyMs);
    this.live[id] = value;
  }

  async saveSettings(): Promise<void> {
    this.requireConnected();
    await wait(this.options.latencyMs);
    this.flash = { ...this.live };
  }

  async revertSettings(): Promise<SettingValues> {
    this.requireConnected();
    await wait(this.options.latencyMs);
    this.live = { ...this.flash };
    return { ...this.live };
  }

  // --- live sensor data ---

  subscribeTelemetry(listener: (value: number) => void): Unsubscribe {
    this.telemetryListeners.add(listener);
    this.startTelemetry();

    return () => {
      this.telemetryListeners.delete(listener);
      if (this.telemetryListeners.size === 0) this.stopTelemetry();
    };
  }

  // --- internals ---

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private requireConnected() {
    if (this.status !== 'connected') {
      throw new Error('Not connected');
    }
  }

  private startTelemetry() {
    if (this.telemetryTimer || this.status !== 'connected') return;

    this.telemetryTimer = setInterval(() => {
      // Random walk standing in for a muscle signal envelope.
      const drift = (Math.random() - 0.5) * 18;
      this.telemetryValue = Math.max(0, Math.min(100, this.telemetryValue + drift));
      const value = Math.round(this.telemetryValue);
      this.telemetryListeners.forEach((listener) => listener(value));
    }, 1000 / TELEMETRY_HZ);
  }

  private stopTelemetry() {
    if (!this.telemetryTimer) return;
    clearInterval(this.telemetryTimer);
    this.telemetryTimer = null;
  }
}
