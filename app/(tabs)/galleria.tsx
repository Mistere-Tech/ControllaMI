import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ConnectionBadge } from '../../src/ui/ConnectionBadge';
import { SdBanner } from '../../src/ui/SdBanner';
import { useProblems } from '../../src/state/ProblemContext';
import { useCameraCtx, useCameraState } from '../../src/state/CameraContext';
import { CamFile, formatSize } from '../../src/core/gallery';
import { downloadToGallery } from '../../src/net/download';
import { C } from '../../src/ui/theme';
import { t } from '../../src/core/i18n';

type Filter = 'tutti' | 'video' | 'foto';
const FILTER_LABEL = { tutti: 'gallery.filter.all', video: 'gallery.filter.video', foto: 'gallery.filter.photo' } as const;

export default function GalleriaScreen() {
  const insets = useSafeAreaInsets();
  const { controller, demo } = useCameraCtx();
  const st = useCameraState();
  const { report, notify } = useProblems();
  const [filter, setFilter] = useState<Filter>('tutti');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ name: string; fraction: number; index: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await controller.loadFiles();
    } catch (e) {
      report(e, { retry: () => load() });
    } finally {
      setLoading(false);
    }
  }, [controller]);

  useEffect(() => {
    if (st.status === 'connected' && st.sd !== 'missing') load();
  }, [st.status, st.sd, load]);

  // ricarica quando la camera finisce un video o una foto
  useEffect(() => {
    if (st.lastFile && st.status === 'connected') controller.loadFiles().catch(() => {});
  }, [st.lastFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const files = useMemo(
    () => st.files.filter((f) => filter === 'tutti' || (filter === 'video' ? f.kind === 'video' : f.kind === 'photo')),
    [st.files, filter],
  );

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const exitSelection = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const download = async () => {
    const list = st.files.filter((f) => selected.has(f.name));
    if (demo) {
      notify({ title: t('gallery.demoTitle'), message: t('gallery.demoMessage'), code: null, action: null, severity: 'warning' });
      return;
    }
    try {
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        setProgress({ name: f.name, fraction: 0, index: i + 1, total: list.length });
        await downloadToGallery(f, (fraction) => setProgress({ name: f.name, fraction, index: i + 1, total: list.length }));
      }
      notify({
        title: t('gallery.savedTitle'),
        message: list.length === 1 ? t('gallery.savedOne') : t('gallery.savedMany', { n: list.length }),
        code: null,
        action: null,
        severity: 'info',
      });
      exitSelection();
    } catch (e) {
      report(e, { retry: () => download() });
    } finally {
      setProgress(null);
    }
  };

  const remove = () => {
    const names = [...selected];
    Alert.alert(
      names.length === 1 ? t('gallery.deleteOne') : t('gallery.deleteMany', { n: names.length }),
      t('gallery.cannotUndo'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('gallery.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await controller.deleteFiles(names);
              exitSelection();
            } catch (e) {
              report(e);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: CamFile }) => {
    const sel = selected.has(item.name);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatSize(item.size)}`}
        accessibilityState={{ selected: sel }}
        onPress={() => (selecting ? toggle(item.name) : Alert.alert(item.name, `${formatSize(item.size)} · ${item.date}`))}
        onLongPress={() => {
          setSelecting(true);
          toggle(item.name);
        }}
        style={[s.tile, sel && { borderColor: C.accent, borderWidth: 2 }]}
      >
        {item.kind === 'photo' && !demo ? (
          <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Ionicons name={item.kind === 'video' ? 'videocam-outline' : 'image-outline'} size={24} color={C.faint} />
        )}
        <Text style={s.tileMeta}>{item.kind === 'video' ? formatSize(item.size) : ''}</Text>
        {sel && (
          <View style={s.check}>
            <Ionicons name="checkmark" size={14} color={C.onAccent} />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 16 }]}>
      <View style={s.header}>
        <Text style={s.title}>{t('tabs.gallery')}</Text>
        <Pressable accessibilityRole="button" onPress={() => (selecting ? exitSelection() : setSelecting(true))} hitSlop={8}>
          <Text style={s.headerBtn}>{selecting ? t('common.cancel') : t('gallery.select')}</Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}><ConnectionBadge demo={demo} /></View>
      <SdBanner />

      <View style={s.filters}>
        {(['tutti', 'video', 'foto'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={[s.filter, filter === f && { backgroundColor: C.text }]}
          >
            <Text style={[s.filterText, filter === f && { color: C.bg }]}>{t(FILTER_LABEL[f])}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={files}
        keyExtractor={(f) => f.name}
        numColumns={3}
        renderItem={renderItem}
        columnWrapperStyle={{ gap: 6 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accent} colors={[C.accent]} />}
        ListEmptyComponent={!loading ? <Text style={s.empty}>{t('gallery.empty')}</Text> : undefined}
      />

      {progress && (
        <View style={s.progressCard}>
          <View style={s.progressRow}>
            <Text style={s.progressName} numberOfLines={1}>
              {t('gallery.downloading', { name: progress.name })}{progress.total > 1 ? ` (${progress.index}/${progress.total})` : ''}
            </Text>
            <Text style={s.muted}>{Math.round(progress.fraction * 100)}%</Text>
          </View>
          <View style={s.bar}><View style={[s.barFill, { width: `${Math.round(progress.fraction * 100)}%` }]} /></View>
        </View>
      )}

      {selecting && (
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={selected.size === 0 || !!progress}
            onPress={download}
            style={[s.actPrimary, (selected.size === 0 || !!progress) && { opacity: 0.5 }]}
          >
            <Text style={s.actPrimaryText}>{t('gallery.download')}{selected.size ? ` (${selected.size})` : ''}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={selected.size === 0 || !!progress}
            onPress={remove}
            style={[s.actDanger, (selected.size === 0 || !!progress) && { opacity: 0.5 }]}
          >
            <Text style={s.actDangerText}>{t('gallery.delete')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  title: { color: C.text, fontSize: 28, fontWeight: '700' },
  headerBtn: { color: C.accent, fontSize: 15, fontWeight: '500' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  filter: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  filterText: { color: C.text, fontSize: 14, fontWeight: '500' },
  tile: { flex: 1 / 3, height: 112, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tileMeta: { position: 'absolute', bottom: 6, right: 8, color: C.text, fontSize: 11, fontWeight: '600' },
  check: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40, fontSize: 14 },
  muted: { color: C.muted, fontSize: 13 },
  progressCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, gap: 10 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progressName: { color: C.text, fontSize: 14, fontWeight: '500', flexShrink: 1 },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.border },
  barFill: { height: 6, borderRadius: 3, backgroundColor: C.accent },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  actPrimary: { flex: 1, height: 48, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  actPrimaryText: { color: C.onAccent, fontSize: 15, fontWeight: '600' },
  actDanger: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#3A2226', alignItems: 'center', justifyContent: 'center' },
  actDangerText: { color: C.rec, fontSize: 15, fontWeight: '600' },
});
