import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Screen from '../components/Screen';
import { colors, spacing } from '../theme';

type Status = 'disconnected' | 'searching' | 'connected';

// Stand-in for a real scan result. Replaced by the transport layer later.
const MOCK_DEVICE = {
  name: 'Prosthetic Arm',
  detail: 'Battery 82% · Firmware 0.1.0',
};

const SEARCH_MS = 1800;

export default function HomeScreen() {
  const [status, setStatus] = useState<Status>('disconnected');

  // Mock scan: waits, then succeeds. Swapped for transport.scan() once BLE
  // exists, at which point this also needs a timeout path for the arm being
  // asleep and not advertising.
  useEffect(() => {
    if (status !== 'searching') return;
    const timer = setTimeout(() => setStatus('connected'), SEARCH_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <Screen title="Home" subtitle="Overview of your device">
      <View style={styles.body}>
        <View style={styles.statusRow}>
          {status === 'searching' ? (
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
              : status === 'searching'
                ? 'Searching…'
                : 'Not connected'}
          </Text>
        </View>

        {status === 'connected' ? (
          <View style={styles.device}>
            <Text style={styles.deviceName}>{MOCK_DEVICE.name}</Text>
            <Text style={styles.deviceDetail}>{MOCK_DEVICE.detail}</Text>

            <Pressable
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              onPress={() => setStatus('disconnected')}
              accessibilityRole="button"
              accessibilityLabel={`Disconnect from ${MOCK_DEVICE.name}`}
            >
              <Text style={styles.secondaryLabel}>Disconnect</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.primary,
              status === 'searching' && styles.primaryDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() => setStatus('searching')}
            disabled={status === 'searching'}
            accessibilityRole="button"
            accessibilityLabel="Add a device"
          >
            <Text style={styles.primaryLabel}>Add a device</Text>
          </Pressable>
        )}
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
