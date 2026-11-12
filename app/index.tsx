import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useCameraCtx, useCameraState } from '../src/state/CameraContext';
import { C, R } from '../src/ui/theme';
import { CAMERA_HOST } from '../src/core/gallery';
import { t } from '../src/core/i18n';
import { networkTip } from '../src/core/network';
import { loadCameraPassword, phoneManufacturer, saveCameraPassword } from '../src/net/device';

const steps = () => [
  { title: t('connect.step1.title'), text: t('connect.step1.text') },
  { title: t('connect.step2.title'), text: t('connect.step2.text') },
  { title: t('connect.step3.title'), text: t('connect.step3.text') },
];

export default function ConnessioneScreen() {
  const insets = useSafeAreaInsets();
  const { connectReal, connectDemo, disconnect } = useCameraCtx();
  const state = useCameraState();
  const [host, setHost] = useState(CAMERA_HOST);
  const [advanced, setAdvanced] = useState(false);
  const [password, setPassword] = useState('');
  // collegamento guidato in corso: Android mostra la sua finestra con le reti YDXJ_…
  const [preparing, setPreparing] = useState(false);
  const busy = preparing || state.status === 'connecting';

  useEffect(() => {
    loadCameraPassword().then(setPassword);
  }, []);

  const connect = async () => {
    setPreparing(true);
    try {
      await saveCameraPassword(password.trim());
      await connectReal(host.trim() || CAMERA_HOST, password.trim());
    } catch {
      /* l'errore lo mostra lo stato della connessione */
    } finally {
      setPreparing(false);
    }
  };

  useEffect(() => {
    if (state.status === 'connected') router.replace('/(tabs)/controllo');
  }, [state.status]);

  const statusText =
    busy
      ? t('connect.status.connecting')
      : state.status === 'error'
        ? state.error ?? t('connect.status.error')
        : t('connect.status.searching');
  const dot = state.status === 'error' ? C.rec : C.accent;

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={[s.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
      <View style={{ gap: 6 }}>
        <Text style={s.title}>ControllaMI</Text>
        <Text style={s.subtitle}>{t('connect.subtitle')}</Text>
      </View>

      <View style={s.card}>
        <CameraIcon />
        <View style={s.statusRow}>
          {busy ? <ActivityIndicator color={C.accent} size="small" /> : <View style={[s.dot, { backgroundColor: dot }]} />}
          <Text style={s.statusText} numberOfLines={3}>{statusText}</Text>
        </View>
        {state.status === 'error' && !busy ? <Text style={s.tip}>{t(networkTip(phoneManufacturer()))}</Text> : null}
        <Text style={s.cardHint}>{t('connect.hint')}</Text>
      </View>

      <View style={{ gap: 16 }}>
        {steps().map((st, i) => (
          <View key={st.title} style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.stepTitle}>{st.title}</Text>
              <Text style={s.stepText}>{st.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flexGrow: 1, minHeight: 16 }} />

      {advanced && (
        <View style={{ gap: 6 }}>
          <Text style={s.label}>{t('connect.hostLabel')}</Text>
          <TextInput
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            style={s.input}
            placeholderTextColor={C.faint}
            accessibilityLabel={t('connect.hostA11y')}
          />
          <Text style={s.label}>{t('connect.passwordLabel')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder="1234567890"
            style={s.input}
            placeholderTextColor={C.faint}
            accessibilityLabel={t('connect.passwordA11y')}
          />
        </View>
      )}

      <View style={{ gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={connect}
          style={({ pressed }) => [s.primary, (pressed || busy) && { opacity: 0.7 }]}
        >
          <Text style={s.primaryText}>{busy ? t('connect.buttonBusy') : t('connect.button')}</Text>
        </Pressable>
        {busy ? (
          <Pressable
            accessibilityRole="button"
            onPress={disconnect}
            style={({ pressed }) => [s.secondary, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.secondaryText}>{t('common.cancel')}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() => Linking.openSettings())}
            style={({ pressed }) => [s.secondary, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.secondaryText}>{t('connect.wifiSettings')}</Text>
          </Pressable>
        )}
        <View style={s.linksRow}>
          <Pressable accessibilityRole="button" onPress={() => connectDemo().catch(() => {})} hitSlop={8}>
            <Text style={s.link}>{t('connect.demo')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setAdvanced((a) => !a)} hitSlop={8}>
            <Text style={[s.link, { color: C.muted }]}>{advanced ? t('connect.hide') : t('connect.advanced')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function CameraIcon() {
  return (
    <Svg width={120} height={84} viewBox="0 0 120 84" fill="none" stroke={C.muted} strokeWidth={2}>
      <Rect x={6} y={10} width={108} height={68} rx={12} />
      <Circle cx={44} cy={44} r={22} />
      <Circle cx={44} cy={44} r={12} stroke={C.accent} />
      <Rect x={82} y={22} width={20} height={10} rx={3} />
      <Path d="M24 10V4h20v6" />
    </Svg>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 20, gap: 28 },
  title: { color: C.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: C.muted, fontSize: 15 },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 20, padding: 24, alignItems: 'center', gap: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: C.text, fontSize: 15, fontWeight: '500', flexShrink: 1, textAlign: 'center' },
  cardHint: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  tip: { color: C.warn, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: C.text, fontSize: 14, fontWeight: '700' },
  stepTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  stepText: { color: C.muted, fontSize: 13, lineHeight: 19 },
  label: { color: C.muted, fontSize: 13 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, color: C.text, paddingHorizontal: 14, fontSize: 16 },
  primary: { height: 56, borderRadius: R.button, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: C.onAccent, fontSize: 17, fontWeight: '600' },
  secondary: { height: 48, borderRadius: R.button, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: C.text, fontSize: 15, fontWeight: '500' },
  linksRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  link: { color: C.accent, fontSize: 14, paddingVertical: 6 },
});
