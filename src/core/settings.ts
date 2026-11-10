export type SettingGroup = 'Video' | 'Foto' | 'Timelapse' | 'Camera' | 'Info' | 'Altro';

export interface SettingInfo {
  key: string;
  label: string;
  group: SettingGroup;
  readOnly: boolean;
}

const KNOWN: Record<string, [string, SettingGroup, boolean?]> = {
  video_resolution: ['Risoluzione', 'Video'],
  video_standard: ['Standard', 'Video'],
  video_quality: ['Qualità', 'Video'],
  video_stamp: ['Timestamp sul video', 'Video'],
  timelapse_video: ['Intervallo timelapse video', 'Timelapse'],
  rec_mode: ['Modalità registrazione', 'Video'],
  record_mode: ['Modalità registrazione', 'Video'],
  loop_rec: ['Registrazione in loop', 'Video'],
  video_rotate: ['Capovolgi immagine', 'Video'],
  meter_mode: ['Misurazione esposizione', 'Video'],
  exposure_value: ['Esposizione (EV)', 'Video'],
  ev: ['Esposizione (EV)', 'Video'],
  ev_compensation: ['Esposizione (EV)', 'Video'],
  warp_enable: ['Correzione distorsione', 'Video'],
  photo_size: ['Dimensione', 'Foto'],
  photo_quality: ['Qualità', 'Foto'],
  photo_stamp: ['Timestamp sulla foto', 'Foto'],
  capture_mode: ['Modalità scatto', 'Foto'],
  precise_cont_time: ['Intervallo timelapse foto', 'Timelapse'],
  burst_capture_number: ['Raffica', 'Foto'],
  precise_selftime: ['Autoscatto', 'Foto'],
  auto_power_off: ['Spegnimento automatico', 'Camera'],
  led_mode: ['LED di stato', 'Camera'],
  buzzer_volume: ['Volume segnali', 'Camera'],
  buzzer_ring: ['Trova camera', 'Camera'],
  start_wifi_while_booted: ['Wi-Fi all’accensione', 'Camera'],
  auto_low_light: ['Luce scarsa automatica', 'Camera'],
  camera_clock: ['Data e ora', 'Camera'],
  system_default_mode: ['Modalità all’accensione', 'Camera'],
  serial_number: ['Numero di serie', 'Info', true],
  hw_version: ['Versione hardware', 'Info', true],
  sw_version: ['Versione firmware', 'Info', true],
  dev_functions: ['Funzioni', 'Info', true],
  app_status: ['Stato', 'Info', true],
  sd_card_status: ['Scheda SD', 'Info', true],
  sdcard_need_format: ['SD da formattare', 'Info', true],
  wifi_ssid: ['Nome Wi-Fi', 'Info', true],
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
  if (known) return { key, label: known[0], group: known[1], readOnly: !!known[2] };
  return { key, label: key.replace(/_/g, ' '), group: 'Altro', readOnly: false };
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
