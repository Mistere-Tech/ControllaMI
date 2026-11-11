import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCameraState } from '../state/CameraContext';
import { C } from './theme';
import { t } from '../core/i18n';

/** Striscia fissa quando la SD manca o va formattata: spiega perché REC, foto e galleria sono spenti. */
export function SdBanner() {
  const { sd, status } = useCameraState();
  if (status !== 'connected' || (sd !== 'missing' && sd !== 'needs_format')) return null;
  const missing = sd === 'missing';
  return (
    <View style={s.row} accessibilityRole="alert">
      <Ionicons name="save-outline" size={18} color={C.warn} />
      <Text style={s.text}>
        {missing
          ? t('sd.bannerMissing')
          : t('sd.bannerFormat')}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.warn,
    backgroundColor: C.surface,
  },
  text: { flex: 1, color: C.text, fontSize: 13, lineHeight: 18 },
});
