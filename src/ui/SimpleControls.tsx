import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCameraCtx, useCameraState, useModes } from '../state/CameraContext';
import { INTERVAL_CHOICES, SimpleMode } from '../core/modes';
import { meterLabel } from '../core/presets';
import { t } from '../core/i18n';
import { C } from './theme';

type Run = (fn: () => Promise<void>) => void;

function intervalLabel(sec: number) {
  return sec >= 60 ? `${sec / 60} min` : `${sec} s`;
}

/** Comandi della modalità Semplice: Video, Foto, Timelapse (+ intervallo) ed esposizione. */
export function SimpleControls({ run, disabled }: { run: Run; disabled: boolean }) {
  const { modes } = useCameraCtx();
  const ms = useModes();
  const st = useCameraState();
  const mode = ms.simpleMode;
  const timelapse = mode === 'timelapse_video' || mode === 'timelapse_photo';
  const top: 'video' | 'photo' | 'timelapse' = timelapse ? 'timelapse' : mode;
  const showExposure = mode === 'video' || mode === 'timelapse_video';

  const select = (m: SimpleMode) => run(() => modes.selectSimple(m));

  return (
    <View style={{ gap: 12, alignItems: 'center' }}>
      <View style={s.segment}>
        {(
          [
            ['video', t('mode.video')],
            ['photo', t('mode.photo')],
            ['timelapse', t('mode.timelapse')],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: top === k, disabled }}
            disabled={disabled}
            onPress={() => select(k === 'timelapse' ? (timelapse ? mode : 'timelapse_video') : k)}
            style={[s.segBtn, top === k && { backgroundColor: C.border }, disabled && top !== k && { opacity: 0.5 }]}
          >
            <Text style={s.segText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {timelapse && (
        <>
          <View style={s.subSegment}>
            {(
              [
                ['timelapse_video', t('mode.video')],
                ['timelapse_photo', t('mode.photo')],
              ] as const
            ).map(([k, label]) => (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={k === 'timelapse_video' ? t('simple.timelapseVideo') : t('simple.timelapsePhoto')}
                accessibilityState={{ selected: mode === k, disabled }}
                disabled={disabled}
                onPress={() => select(k)}
                style={[s.subBtn, mode === k && { backgroundColor: C.border }]}
              >
                <Text style={s.subText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            <Text style={s.rowLabel}>{t('simple.every')}</Text>
            {INTERVAL_CHOICES.map((sec) => {
              const sel = ms.intervals[mode] === sec;
              return (
                <Pressable
                  key={sec}
                  accessibilityRole="button"
                  accessibilityLabel={t('simple.intervalA11y', { value: intervalLabel(sec) })}
                  accessibilityState={{ selected: sel, disabled }}
                  disabled={disabled}
                  onPress={() => run(() => modes.setInterval(mode, sec))}
                  style={[s.chip, sel && s.chipSel]}
                >
                  <Text style={[s.chipText, sel && s.chipTextSel]}>{intervalLabel(sec)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {showExposure && <ExposureRow run={run} disabled={disabled} settingsKey={JSON.stringify(st.settings)} />}
    </View>
  );
}

function ExposureRow({ run, disabled, settingsKey }: { run: Run; disabled: boolean; settingsKey: string }) {
  const { modes } = useCameraCtx();
  const [ctl, setCtl] = useState<{ key: string; options: string[]; value: string | undefined } | null>(null);

  useEffect(() => {
    let alive = true;
    modes.exposureControl().then((c) => alive && setCtl(c)).catch(() => alive && setCtl(null));
    return () => {
      alive = false;
    };
  }, [modes, settingsKey]);

  if (!ctl) return null;
  const set = (v: string) => run(() => modes.setExposure(v));

  if (ctl.key === 'meter_mode') {
    return (
      <View style={s.chips}>
        <Text style={s.rowLabel}>{t('simple.exposure')}</Text>
        {ctl.options.map((o) => {
          const sel = ctl.value === o;
          return (
            <Pressable
              key={o}
              accessibilityRole="button"
              accessibilityLabel={t('simple.meterA11y', { value: meterLabel(o) })}
              accessibilityState={{ selected: sel, disabled }}
              disabled={disabled}
              onPress={() => set(o)}
              style={[s.chip, sel && s.chipSel]}
            >
              <Text style={[s.chipText, sel && s.chipTextSel]}>{meterLabel(o)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // compensazione EV: più scuro / più chiaro, un passo alla volta
  const i = Math.max(0, ctl.options.indexOf(ctl.value ?? ''));
  const prev = ctl.options[i - 1];
  const next = ctl.options[i + 1];
  return (
    <View style={s.chips}>
      <Text style={s.rowLabel}>{t('simple.exposure')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('simple.darker')}
        disabled={disabled || !prev}
        onPress={() => prev && set(prev)}
        style={[s.stepBtn, (!prev || disabled) && { opacity: 0.4 }]}
      >
        <Ionicons name="remove" size={20} color={C.text} />
      </Pressable>
      <Text style={s.evValue} accessibilityLabel={t('simple.exposureA11y', { value: ctl.value ?? '' })}>{ctl.value ?? '–'} EV</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('simple.brighter')}
        disabled={disabled || !next}
        onPress={() => next && set(next)}
        style={[s.stepBtn, (!next || disabled) && { opacity: 0.4 }]}
      >
        <Ionicons name="add" size={20} color={C.text} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { width: 104, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segText: { color: C.text, fontSize: 15, fontWeight: '600' },
  subSegment: { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 3, gap: 3 },
  subBtn: { width: 84, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  subText: { color: C.text, fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  rowLabel: { color: C.muted, fontSize: 13, marginRight: 2 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  chipSel: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.text, fontSize: 13 },
  chipTextSel: { color: C.onAccent, fontWeight: '600' },
  stepBtn: { width: 40, height: 36, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  evValue: { color: C.text, fontSize: 15, fontWeight: '600', minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
