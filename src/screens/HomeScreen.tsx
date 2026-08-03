import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import Screen from '../components/Screen';
import { colors, spacing } from '../theme';

import { DeviceSummary, transport } from '../transport';
import { useTelemetry, useConnectionStatus } from '../transport/hooks';

type Status = 'disconnected' | 'searching' | 'connected';

// Stand-in for a real scan result. Replaced by the transport layer later.
const MOCK_DEVICE = {
  name: 'Prosthetic Arm',
  detail: 'Battery 82% · Firmware 0.1.0',
};

const SEARCH_MS = 1800;

export default function HomeScreen() {
  // const [status, setStatus] = useState<Status>('disconnected');
  const status = useConnectionStatus();
  const [devices, setDevices] = useState<DeviceSummary[]>([])

  return (
    <Screen title="Home" subtitle="Overview of your device">
      <View style={styles.body}>
        <View style={styles.statusRow}>
          {status === 'scanning' ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <View
              style={[
                styles.dot,
                status === 'connected' && { backgroundColor: colors.success },
              ]}
            />
          )}
          <Text style={styles.statusText}>
            {status === 'connected'
              ? 'Connected'
              : status === 'scanning'
                ? 'Searching…'
                : 'Not connected'}
          </Text>
        </View>

          <Pressable
            style={({ pressed }) => [
              styles.primary,
              status === 'scanning' && styles.primaryDisabled,
              pressed && styles.pressed,
            ]}
            onPress={async () => setDevices(await transport.scan())}
            disabled={status === 'scanning'}
          >
            <Text style={styles.primaryLabel}>Add a device</Text>
          </Pressable>

        <ScrollView
          style={{ alignSelf: 'stretch' }}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {devices.map((d) => (
            <Pressable
              key={d.id}
              style={({ pressed }) => [styles.deviceCard, pressed && styles.pressed]}
              onPress={() => transport.connect(d.id)}
            >
              <Text>{d.name}</Text>
              <Text>{d.id}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: spacing.lg,
    gap: spacing.lg,
    alignItems: 'flex-start',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.muted,
  },
  statusText: {
    fontSize: 16,
    color: colors.muted,
  },

  device: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  deviceDetail: {
    fontSize: 14,
    color: colors.muted,
  },

  deviceCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.tile,
  },

  primary: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: colors.accent,
  },
  primaryDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  secondary: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    marginTop: spacing.sm / 2,
  },
  secondaryLabel: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },

  pressed: {
    opacity: 0.75,
  },
});
