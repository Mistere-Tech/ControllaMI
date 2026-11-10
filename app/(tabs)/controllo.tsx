import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCameraCtx, useCameraState } from '../../src/state/CameraContext';
import { formatElapsed } from '../../src/core/CameraController';
import { RtspView, PlaybackState } from '../../modules/yi-native';
import { C } from '../../src/ui/theme';

function shortRes(v?: string) {
  if (!v) return '';
  const m = v.match(/x(\d+)\s+(\d+)P/i);
  return m ? `${m[1]}p ${m[2]}` : v;
}

export default function ControlloScreen() {
  const insets = useSafeAreaInsets();
  const { controller, demo, disconnect } = useCameraCtx();
  const st = useCameraState();
  const [, tick] = useState(0);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<PlaybackState | 'off'>('off');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!st.recording) return;
    const id = setInterval(() => tick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [st.recording]);

  // live view: si avvia quando la schermata è connessa, si spegne se cade
  useEffect(() => {
    if (st.status !== 'connected' || demo || !RtspView) {
      setLiveUrl(null);
      return;
    }
    let cancelled = false;
    controller
      .startLiveView()
      .then((url) => !cancelled && setLiveUrl(url))
      .catch(() => !cancelled && setLiveState('error'));
    return () => {
      cancelled = true;
    };
  }, [st.status, demo, controller]);

  const video = st.mode === 'video';
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Comando non riuscito', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const hint = st.status === 'reconnecting'
    ? 'Riconnessione in corso…'
    : video
      ? st.recording ? 'Registrazione in corso' : 'Pronta a registrare'
      : 'Pronta a scattare';

  const chips = video
    ? [shortRes(st.settings.video_resolution), st.settings.video_standard, st.settings.video_quality].filter(Boolean)
    : [st.settings.photo_size?.split(' ')[0], st.settings.capture_mode].filter(Boolean);

  const lastName = st.lastFile?.split('/').pop();

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <View style={s.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Disconnetti"
          onPress={() => Alert.alert('Disconnettere la camera?', undefined, [{ text: 'Annulla', style: 'cancel' }, { text: 'Disconnetti', style: 'destructive', onPress: disconnect }])}
          style={s.connRow}
          hitSlop={8}
        >
          <View style={[s.dot, { backgroundColor: st.status === 'connected' ? C.ok : C.accent }]} />
          <Text style={s.connText}>{demo ? 'Camera simulata' : 'YI connessa'}</Text>
        </Pressable>
        <View style={s.connRow}>
          <Ionicons name={st.charging ? 'battery-charging-outline' : 'battery-half-outline'} size={18} color={C.muted} />
          <Text style={s.muted}>{st.battery != null ? `${st.battery}%` : '–'}</Text>
        </View>
      </View>

      <View style={s.live}>
        {liveUrl && RtspView ? (
          <RtspView url={liveUrl} style={StyleSheet.absoluteFill} onPlaybackState={(e) => setLiveState(e.nativeEvent.state)} />
        ) : null}
        {(!liveUrl || liveState !== 'ready') && (
          <View style={s.livePlaceholder} pointerEvents="none">
            <Ionicons name="videocam-outline" size={40} color={C.faint} />
            <Text style={s.liveMsg}>
              {demo ? 'Live view non disponibile in demo' : liveState === 'error' ? 'Live view non disponibile' : 'Avvio live view…'}
            </Text>
          </View>
        )}
        <View style={s.liveBadge}><Text style={s.liveBadgeText}>LIVE</Text></View>
        {st.recording && (
          <View style={s.recBadge}><View style={s.recDot} /><Text style={s.liveBadgeText}>REC</Text></View>
        )}
      </View>

      <View style={s.timerBox}>
        <Text style={s.timer}>{formatElapsed(controller.elapsedSeconds())}</Text>
        <Text style={s.muted}>{hint}</Text>
      </View>

      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <View style={s.segment}>
          {(['video', 'photo'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: st.mode === m, disabled: st.recording }}
              onPress={() => controller.setMode(m)}
              style={[s.segBtn, st.mode === m && { backgroundColor: C.border }]}
            >
              <Text style={s.segText}>{m === 'video' ? 'Video' : 'Foto'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.shutterRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Apri galleria" onPress={() => router.navigate('/(tabs)/galleria')} style={s.sideBtn}>
          <Ionicons name="images-outline" size={22} color={C.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={video ? (st.recording ? 'Ferma registrazione' : 'Avvia registrazione') : 'Scatta foto'}
          disabled={st.status !== 'connected'}
          onPress={() => run(() => controller.shutter())}
          style={({ pressed }) => [s.shutter, (pressed || busy) && { opacity: 0.75 }]}
        >
          <View
            style={{
              width: st.recording ? 32 : 68,
              height: st.recording ? 32 : 68,
              borderRadius: st.recording ? 8 : 34,
              backgroundColor: video ? C.rec : C.text,
            }}
          />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Impostazioni" onPress={() => router.navigate('/(tabs)/impostazioni')} style={[s.sideBtn, { borderRadius: 26 }]}>
          <Ionicons name="options-outline" size={22} color={C.text} />
        </Pressable>
      </View>

      <View style={s.chips}>
        {chips.map((c) => (
          <View key={String(c)} style={s.chip}><Text style={s.chipText}>{c}</Text></View>
        ))}
      </View>

      {lastName ? <Text style={[s.muted, { textAlign: 'center', marginTop: 12 }]}>Ultimo file: {lastName}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connText: { color: C.text, fontSize: 14, fontWeight: '500' },
  muted: { color: C.muted, fontSize: 13 },
  live: { marginHorizontal: 16, aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: C.black, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  livePlaceholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8 },
  liveMsg: { color: C.muted, fontSize: 13 },
  liveBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(14,17,22,0.8)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  recBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(14,17,22,0.8)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.rec },
  liveBadgeText: { color: C.text, fontSize: 11, fontWeight: '600', letterSpacing: 0.6 },
  timerBox: { alignItems: 'center', gap: 4, paddingTop: 24, paddingBottom: 8 },
  timer: { color: C.text, fontSize: 40, fontWeight: '500', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  segment: { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { width: 110, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segText: { color: C.text, fontSize: 15, fontWeight: '600' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 32, paddingVertical: 20 },
  sideBtn: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: C.text, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  chipText: { color: C.text, fontSize: 13 },
});
