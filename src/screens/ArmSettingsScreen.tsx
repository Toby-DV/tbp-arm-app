import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useSyncExternalStore } from 'react';
import type { ComponentProps } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Setting = {
  id: string;
  name: string;
  icon: IconName;
  unit: string;
  min: number;
  max: number;
  step: number;
};

const SETTINGS: Setting[] = [
  { id: 'openSpeed', name: 'Open Speed', icon: 'hand-back-right-outline', unit: '%', min: 0, max: 100, step: 5 },
  { id: 'gripForce', name: 'Grip Force', icon: 'boxing-glove', unit: '%', min: 0, max: 100, step: 5 },
  { id: 'wristSpeed', name: 'Wrist Speed', icon: 'rotate-3d-variant', unit: '%', min: 0, max: 100, step: 5 },
  { id: 'sleepTimeout', name: 'Sleep Timeout', icon: 'sleep', unit: 'min', min: 0, max: 60, step: 5 },
  { id: 'sensitivity', name: 'Sensitivity', icon: 'pulse', unit: '%', min: 0, max: 100, step: 5 },
  { id: 'haptics', name: 'Haptics', icon: 'vibrate', unit: '%', min: 0, max: 100, step: 10 },
];

// Values currently on the device. Replaced by a real read once BLE lands.
const DEVICE_VALUES: Record<string, number> = {
  openSpeed: 70,
  gripForce: 55,
  wristSpeed: 90,
  sleepTimeout: 15,
  sensitivity: 75,
  haptics: 10,
};

const TILE = 58;
const BAR_WIDTH = 34;
const BAR_MIN_HEIGHT = 3;

export default function ArmSettingsScreen() {
  // `draft` is what the arm is currently running; `saved` is what's persisted
  // to its flash. Once BLE lands, each button press writes draft to the arm's
  // working memory so it responds immediately, and Save is what commits to
  // flash
  const [saved, setSaved] = useState(DEVICE_VALUES);
  const [draft, setDraft] = useState(DEVICE_VALUES);
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [barAreaHeight, setBarAreaHeight] = useState(0);

  const selected = SETTINGS[selectedIndex];
  const value = draft[selected.id];

  const pendingCount = SETTINGS.filter((s) => draft[s.id] !== saved[s.id]).length;

  const adjust = (delta: number) => {
    setDraft((prev) => ({
      ...prev,
      [selected.id]: Math.min(selected.max, Math.max(selected.min, prev[selected.id] + delta)),
    }));
  };

  // Measured rather than percentage-based, so bar heights resolve to exact
  // pixels regardless of how the flex container settles.
  const onChartLayout = (e: LayoutChangeEvent) => {
    setBarAreaHeight(Math.max(0, e.nativeEvent.layout.height - TILE));
  };
  

  const barHeight = (s: Setting) => {
    if (!barAreaHeight) return 0;
    const fraction = (draft[s.id] - s.min) / (s.max - s.min);
    return Math.max(BAR_MIN_HEIGHT, Math.round(fraction * (barAreaHeight - spacing.md)));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top 60% — bar graph sitting directly above the setting selector, so
          each bar reads as the height of the setting beneath it. */}
      <View style={styles.chartRegion} onLayout={onChartLayout}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.columns}
        >
          {SETTINGS.map((s, i) => {
            const active = i === selectedIndex;
            const pending = draft[s.id] !== saved[s.id];

            return (
              <Pressable
                key={s.id}
                style={styles.column}
                onPress={() => setSelectedIndex(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  `${s.name}, ${draft[s.id]}${s.unit}` + (pending ? ', unsaved' : '')
                }
              >
                <View style={[styles.barSlot, { height: barAreaHeight }]}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight(s),
                        backgroundColor: active ? colors.barActive : colors.barIdle,
                      },
                    ]}
                  />
                </View>

                <View style={[styles.tile, active && styles.tileActive]}>
                  <MaterialCommunityIcons
                    name={s.icon}
                    size={24}
                    color={active ? '#FFFFFF' : colors.muted}
                  />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Bottom 40% — the setting being changed, its value, and the commit. */}
      <View style={styles.controlRegion}>
        <Text style={styles.settingName}>{selected.name}</Text>

        <View style={styles.valueRow}>
          <Pressable
            style={({ pressed }) => [
              styles.circle,
              value === selected.min && styles.circleDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() => adjust(-selected.step)}
            disabled={value === selected.min}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${selected.name} by ${selected.step}`}
          >
            <Text style={styles.circleLabel}>−</Text>
          </Pressable>

          <View style={styles.valueWrap}>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.unit}>{selected.unit}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.circle,
              value === selected.max && styles.circleDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() => adjust(selected.step)}
            disabled={value === selected.max}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${selected.name} by ${selected.step}`}
          >
            <Text style={styles.circleLabel}>+</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.save,
            pendingCount === 0 && styles.saveDisabled,
            pressed && styles.pressed,
          ]}
          onPress={() => setSaved(draft)}
          disabled={pendingCount === 0}
          accessibilityRole="button"
          accessibilityLabel={
            pendingCount === 0
              ? 'Save, no unsaved changes'
              : `Save ${pendingCount} changed setting${pendingCount === 1 ? '' : 's'}`
          }
        >
          <Text style={[styles.saveLabel, pendingCount === 0 && styles.saveLabelDisabled]}>
            Save
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // 60 / 40 split of the space above the tab bar.
  chartRegion: {
    flex: 6,
    justifyContent: 'flex-end',
  },
  controlRegion: {
    flex: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    // Grow to at least the screen width so the selector bar spans it. Columns
    // share that space, and once there are enough settings to overflow they
    // hold TILE width and the row scrolls instead.
    flexGrow: 1,
  },
  column: {
    flex: 1,
    minWidth: TILE,
  },

  barSlot: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tile: {
    height: TILE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tile,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  tileActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  settingName: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 340,
  },
  circle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  circleDisabled: {
    backgroundColor: colors.disabled,
  },
  circleLabel: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '500',
  },

  valueWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '300',
    color: colors.text,
    // Stops the layout shifting as digits change width.
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 24,
    fontWeight: '400',
    color: colors.muted,
    marginBottom: 12,
    marginLeft: 2,
  },

  save: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 24,
    backgroundColor: colors.accent,
  },
  saveDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveLabelDisabled: {
    color: colors.muted,
  },

  pressed: {
    opacity: 0.75,
  },
});
