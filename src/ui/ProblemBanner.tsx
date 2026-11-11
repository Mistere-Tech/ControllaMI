import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProblems } from '../state/ProblemContext';
import { C } from './theme';
import { t } from '../core/i18n';

/** Avviso in alto per i comandi non riusciti: sostituisce i popup di sistema. */
export function ProblemBanner() {
  const { shown, dismiss } = useProblems();
  const insets = useSafeAreaInsets();
  if (!shown) return null;
  const { problem, retry } = shown;
  const color = problem.severity === 'info' ? C.ok : problem.severity === 'warning' ? C.warn : C.accent;
  const icon =
    problem.severity === 'info'
      ? 'checkmark-circle-outline'
      : problem.action === 'insert_sd'
        ? 'save-outline'
        : problem.severity === 'warning'
          ? 'alert-circle-outline'
          : 'close-circle-outline';

  return (
    <View style={[s.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <View style={[s.card, { borderColor: color }]} accessibilityRole="alert" accessibilityLiveRegion={problem.severity === 'info' ? 'polite' : 'assertive'}>
        <Ionicons name={icon} size={22} color={color} style={{ marginTop: 1 }} />
        <View style={s.body}>
          <Text style={s.title}>{problem.title}</Text>
          <Text style={s.message}>{problem.message}</Text>
          {problem.code ? <Text style={s.code}>{t('problem.code', { code: problem.code })}</Text> : null}
          {retry ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                dismiss();
                retry();
              }}
              style={({ pressed }) => [s.retry, pressed && { opacity: 0.8 }]}
            >
              <Text style={s.retryText}>{t('common.retry')}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('problem.dismiss')} onPress={dismiss} hitSlop={12}>
          <Ionicons name="close" size={20} color={C.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 100, elevation: 100 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: C.surface,
  },
  body: { flex: 1, gap: 4 },
  title: { color: C.text, fontSize: 15, fontWeight: '600' },
  message: { color: C.muted, fontSize: 14, lineHeight: 19 },
  code: { color: C.faint, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },
  retry: { alignSelf: 'flex-start', marginTop: 8, height: 36, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.accent, justifyContent: 'center' },
  retryText: { color: C.onAccent, fontSize: 14, fontWeight: '600' },
});
