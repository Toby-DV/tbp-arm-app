/**
 * The app talks to the arm only through this interface. Two implementations
 * exist: MockTransport (no hardware) and eventually BleTransport. Screens must
 * never import a concrete one directly, so the UI can be built and demoed with
 * no device present.
 */

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected';

/** A device seen during a scan, before connecting. */
export type DeviceSummary = {
  id: string;
  name: string;
};

/** Everything readable once connected. */
export type DeviceInfo = {
  id: string;
  name: string;
  batteryPercent: number;
  firmwareVersion: string;
};

/** Setting id → current value, e.g. { gripForce: 55 }. */
export type SettingValues = Record<string, number>;

export type Unsubscribe = () => void;

export interface DeviceTransport {
  // --- discovery and connection ---

  /**
   * Looks for arms in range. Resolves with an empty array when nothing is
   * found — that is the normal case, not an error, because the arm keeps its
   * radio off until someone presses its button.
   */
  scan(timeoutMs?: number): Promise<DeviceSummary[]>;

  connect(deviceId: string): Promise<DeviceInfo>;
  disconnect(): Promise<void>;

  getStatus(): ConnectionStatus;

  /** The connected device, or null. Connection is app-wide, so screens read it
   * from here rather than holding their own copy. */
  getConnectedDevice(): DeviceInfo | null;

  subscribeStatusChange(listener: (status: ConnectionStatus) => void): Unsubscribe;

  // --- settings ---

  /** Current values the arm is running. */
  readSettings(): Promise<SettingValues>;

  /**
   * Applies a value to the arm's working memory. Takes effect immediately so
   * the wearer can feel the change while tuning.
   */
  writeSetting(id: string, value: number): Promise<void>;

  /**
   * Commits the arm's current values to its flash so they survive a power
   * cycle. Deliberately separate from writeSetting because flash has a finite
   * number of erase cycles — this is what the Save button calls.
   */
  saveSettings(): Promise<void>;

  /** Discards unsaved changes, restoring whatever is in flash. */
  revertSettings(): Promise<SettingValues>;

  // --- live sensor data ---

  /**
   * Muscle signal strength, 0–100, for the calibration display. The arm only
   * streams while something is listening, so unsubscribe when leaving the
   * screen.
   */
  subscribeTelemetry(listener: (value: number) => void): Unsubscribe;
}
