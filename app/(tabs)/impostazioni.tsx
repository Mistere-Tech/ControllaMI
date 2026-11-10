import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCameraCtx, useCameraState } from '../../src/state/CameraContext';
import { describeSetting, groupSettings } from '../../src/core/settings';
import { C } from '../../src/ui/theme';

interface Sheet {
  key: string;
  label: string;
  value: string;
  options: string[] | null; // null = sto caricando
}

export default function ImpostazioniScreen() {
  const insets = useSafeAreaInsets();
  const { controller } = useCameraCtx();
  const st = useCameraState();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const groups = useMemo(() => groupSettings(st.settings), [st.settings]);

  const open = async (key: string, value: string) => {
    const info = describeSetting(key);
    if (info.readOnly) return;
    setSheet({ key, label: info.label, value, options: null });
    try {
      const o = await controller.getOptions(key);
      if (!o.settable || o.options.length === 0) {
        setSheet(null);
        Alert.alert(info.label, 'Questa impostazione non si può cambiare dall’app.');
        return;
      }
      setSheet({ key, label: info.label, value, options: o.options });
    } catch (e) {
      setSheet(null);
      Alert.alert('Errore', (e as Error).message);
    }
  };

  const choose = async (opt: string) => {
    if (!sheet) return;
    const key = sheet.key;
    setSheet(null);
    try {
      await controller.changeSetting(key, opt);
    } catch (e) {
      Alert.alert(
        'Impostazione non cambiata',
        st.recording ? 'Ferma la registrazione e riprova.' : (e as Error).message,
      );
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await controller.refreshSettings();
    } catch {
      /* lo stato mostra già la connessione */
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Impostazioni</Text>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.accent} colors={[C.accent]} />}
      >
        {groups.length === 0 && <Text style={s.empty}>Nessuna impostazione letta dalla camera. Trascina giù per riprovare.</Text>}
        {groups.map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <Text style={s.groupTitle}>{g.title.toUpperCase()}</Text>
            <View style={s.card}>
              {g.items.map((it, i) => (
                <Pressable
                  key={it.key}
                  accessibilityRole="button"
                  disabled={it.readOnly}
                  onPress={() => open(it.key, it.value)}
                  style={({ pressed }) => [s.row, i > 0 && s.rowBorder, pressed && { backgroundColor: C.border }]}
                >
                  <Text style={s.rowLabel} numberOfLines={1}>{it.label}</Text>
                  <View style={s.rowRight}>
                    <Text style={s.rowValue} numberOfLines={1}>{it.value}</Text>
                    {!it.readOnly && <Ionicons name="chevron-forward" size={16} color={C.faint} />}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={s.backdrop} onPress={() => setSheet(null)} accessibilityLabel="Chiudi" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.sheetTitle}>{sheet?.label}</Text>
          {sheet?.options == null ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView style={{ maxHeight: 420 }}>
              {sheet.options.map((o) => (
                <Pressable
                  key={o}
                  accessibilityRole="button"
                  accessibilityState={{ selected: o === sheet.value }}
                  onPress={() => choose(o)}
                  style={({ pressed }) => [s.optRow, pressed && { backgroundColor: C.border }]}
                >
                  <Text style={s.optText}>{o}</Text>
                  {o === sheet.value && <Ionicons name="checkmark" size={20} color={C.accent} />}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  title: { color: C.text, fontSize: 28, fontWeight: '700', paddingHorizontal: 20, paddingBottom: 12 },
  empty: { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 40 },
  groupTitle: { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 4 },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  rowLabel: { color: C.text, fontSize: 15, flexShrink: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, maxWidth: '55%' },
  rowValue: { color: C.muted, fontSize: 14, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingHorizontal: 8 },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: '700', paddingHorizontal: 12, paddingBottom: 12 },
  optRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 12 },
  optText: { color: C.text, fontSize: 16 },
});
