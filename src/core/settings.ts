import { hasKey, t } from './i18n';

export type SettingGroup = 'Video' | 'Foto' | 'Timelapse' | 'Camera' | 'Info' | 'Altro';

export interface SettingInfo {
  key: string;
  label: string;
  group: SettingGroup;
  readOnly: boolean;
}

/** Impostazioni note: chiave del testo (setting.<nome>), gruppo, sola lettura. */
const KNOWN: Record<string, [string, SettingGroup, boolean?]> = {
  video_resolution: ['video_resolution', 'Video'],
  video_standard: ['video_standard', 'Video'],
  video_quality: ['video_quality', 'Video'],
  video_stamp: ['video_stamp', 'Video'],
  timelapse_video: ['timelapse_video', 'Timelapse'],
  rec_mode: ['rec_mode', 'Video'],
  record_mode: ['rec_mode', 'Video'],
  loop_rec: ['loop_rec', 'Video'],
  video_rotate: ['video_rotate', 'Video'],
  meter_mode: ['meter_mode', 'Video'],
  exposure_value: ['exposure', 'Video'],
  ev: ['exposure', 'Video'],
  ev_compensation: ['exposure', 'Video'],
  warp_enable: ['warp_enable', 'Video'],
  photo_size: ['photo_size', 'Foto'],
  photo_quality: ['photo_quality', 'Foto'],
  photo_stamp: ['photo_stamp', 'Foto'],
  capture_mode: ['capture_mode', 'Foto'],
  precise_cont_time: ['precise_cont_time', 'Timelapse'],
  burst_capture_number: ['burst_capture_number', 'Foto'],
  precise_selftime: ['precise_selftime', 'Foto'],
  auto_power_off: ['auto_power_off', 'Camera'],
  led_mode: ['led_mode', 'Camera'],
  buzzer_volume: ['buzzer_volume', 'Camera'],
  buzzer_ring: ['buzzer_ring', 'Camera'],
  start_wifi_while_booted: ['start_wifi_while_booted', 'Camera'],
  auto_low_light: ['auto_low_light', 'Camera'],
  camera_clock: ['camera_clock', 'Camera'],
  system_default_mode: ['system_default_mode', 'Camera'],
  serial_number: ['serial_number', 'Info', true],
  hw_version: ['hw_version', 'Info', true],
  sw_version: ['sw_version', 'Info', true],
  dev_functions: ['dev_functions', 'Info', true],
  app_status: ['app_status', 'Info', true],
  sd_card_status: ['sd_card_status', 'Info', true],
  sdcard_need_format: ['sdcard_need_format', 'Info', true],
  wifi_ssid: ['wifi_ssid', 'Info', true],
};

export function settingsToMap(list: Record<string, string>[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of list ?? []) {
    for (const [k, v] of Object.entries(entry)) map[k] = String(v);
  }
  return map;
}

export function describeSetting(key: string): SettingInfo {
  const known = KNOWN[key];
  if (known) {
    const textKey = `setting.${known[0]}`;
    return { key, label: hasKey(textKey) ? t(textKey) : key, group: known[1], readOnly: !!known[2] };
  }
  return { key, label: key.replace(/_/g, ' '), group: 'Altro', readOnly: false };
}

/** Nome del gruppo nella lingua dell'app (i gruppi restano identificati in italiano). */
export function groupLabel(g: SettingGroup): string {
  return t(`group.${g}`);
}

export const GROUP_ORDER: SettingGroup[] = ['Video', 'Foto', 'Timelapse', 'Camera', 'Info', 'Altro'];

/** Raggruppa le impostazioni per la schermata, nell'ordine dei gruppi. */
export function groupSettings(map: Record<string, string>) {
  const groups = new Map<SettingGroup, (SettingInfo & { value: string })[]>();
  for (const [k, v] of Object.entries(map)) {
    const info = describeSetting(k);
    if (!groups.has(info.group)) groups.set(info.group, []);
    groups.get(info.group)!.push({ ...info, value: v });
  }
  return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({ title: g, items: groups.get(g)! }));
}
