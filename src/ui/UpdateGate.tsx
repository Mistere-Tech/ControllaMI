import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { notesFor, UpdateResult } from '../core/updates';
import { getLang, t } from '../core/i18n';
import { formatSize } from '../core/gallery';
import { checkAppUpdate, downloadAndInstall, installedVersion } from '../net/updater';
import { C } from './theme';

/**
 * Controlla gli aggiornamenti all'avvio e quando l'app torna in primo piano.
 * Se esiste una versione più nuova copre tutta l'app finché non si aggiorna.
 */
export function UpdateGate({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<UpdateResult | null>(null);

  const check = useCallback(() => {
    checkAppUpdate().then(setResult).catch(() => {});
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [check]);

  return (
    <>
      {children}
      {result?.status === 'required' && result.latest ? <UpdateRequired result={result} /> : null}
    </>
  );
}

function UpdateRequired({ result }: { result: UpdateResult }) {
  const insets = useSafeAreaInsets();
  const latest = result.latest!;
  const notes = notesFor(latest.notes, getLang());
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = async () => {
    setError(null);
    setProgress(0);
    try {
      await downloadAndInstall(latest, setProgress);
    } catch (e) {
      setError((e as Error).message || t('update.failed'));
    } finally {
      setProgress(null);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, s.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
      <View style={s.icon}>
        <Ionicons name="cloud-download-outline" size={36} color={C.accent} />
      </View>
      <Text style={s.title}>{t('update.title')}</Text>
      <Text style={s.subtitle}>
        {t('update.subtitle', { latest: latest.version, current: installedVersion() })}
      </Text>

      {notes ? (
        <ScrollView style={s.notes} contentContainerStyle={{ padding: 14 }}>
          <Text style={s.notesTitle}>{t('update.notes')}</Text>
          <Text style={s.notesText}>{notes}</Text>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}

      {progress !== null ? (
        <View style={s.progressBox} accessibilityLabel={t('update.downloadA11y', { pct: Math.round(progress * 100) })}>
          <View style={s.track}>
            <View style={[s.bar, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={s.progressText}>{t('update.downloading', { pct: Math.round(progress * 100) })}</Text>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={update} style={({ pressed }) => [s.button, pressed && { opacity: 0.85 }]}>
          <Text style={s.buttonText}>{t('update.button')}{latest.apkSize ? ` · ${formatSize(latest.apkSize)}` : ''}</Text>
        </Pressable>
      )}
      <Text style={s.hint}>
        {t('update.hint')}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: C.bg, paddingHorizontal: 24, gap: 14, zIndex: 1000, elevation: 1000 },
  icon: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontSize: 26, fontWeight: '700' },
  subtitle: { color: C.muted, fontSize: 15, lineHeight: 21 },
  notes: { flex: 1, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border },
  notesTitle: { color: C.text, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  notesText: { color: C.muted, fontSize: 14, lineHeight: 20 },
  error: { color: C.warn, fontSize: 14 },
  button: { height: 56, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: C.onAccent, fontSize: 16, fontWeight: '700' },
  progressBox: { gap: 8 },
  track: { height: 8, borderRadius: 4, backgroundColor: C.surface, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.accent },
  progressText: { color: C.muted, fontSize: 14 },
  hint: { color: C.faint, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
