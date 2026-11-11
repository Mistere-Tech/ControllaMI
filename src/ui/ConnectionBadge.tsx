import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { healthLabel, Health } from '../core/health';
import { t } from '../core/i18n';
import { useCameraState, useHealth } from '../state/CameraContext';
import { C } from './theme';

const COLOR: Record<Health, string> = { stable: C.ok, unstable: C.warn, lost: C.faint };

/** Pallino + scritta sullo stato della connessione con la camera, sempre visibile in alto. */
export function ConnectionBadge({ demo }: { demo?: boolean }) {
  const health = useHealth();
  const st = useCameraState();
  const last = st.heartbeats[st.heartbeats.length - 1];
  const label = demo
    ? t('health.simulated')
    : health === 'lost' && st.status === 'reconnecting'
      ? t('health.reconnecting')
      : healthLabel(health);

  return (
    <View
      style={s.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      {health === 'lost' ? (
        <Ionicons name="cloud-offline-outline" size={16} color={C.muted} />
      ) : (
        <View style={[s.dot, { backgroundColor: COLOR[health] }]} />
      )}
      <Text style={[s.text, health === 'lost' && { color: C.muted }]} numberOfLines={1}>{label}</Text>
      {!demo && health !== 'lost' && typeof last === 'number' ? <Text style={s.ms}>{last} ms</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: C.text, fontSize: 14, fontWeight: '500', flexShrink: 1 },
  ms: { color: C.faint, fontSize: 12, fontVariant: ['tabular-nums'] },
});
