export const MSG = {
  GET_SETTING: 1, SET_SETTING: 2, GET_ALL_SETTINGS: 3, GET_OPTIONS: 9, NOTIFICATION: 7, BATTERY: 13,
  START_SESSION: 257, STOP_SESSION: 258, START_VF: 259, STOP_VF: 260,
  START_RECORD: 513, STOP_RECORD: 514, TAKE_PHOTO: 769,
  /** Ferma lo scatto continuo / timelapse foto (da verificare sulla camera vera). */
  STOP_PHOTO: 770,
  DELETE_FILE: 1281, LS: 1282, CD: 1283,
} as const;
