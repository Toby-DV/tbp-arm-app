import { StyleSheet, Text, View } from 'react-native';

import Screen from '../components/Screen';
import { colors, spacing } from '../theme';

export default function HomeScreen() {
  return (
    <Screen title="Home" subtitle="Overview of your device">
      <View style={styles.status}>
        <View style={styles.dot} />
        <Text style={styles.statusText}>Not connected</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
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
});
