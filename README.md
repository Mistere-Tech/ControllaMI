<p align="center">
  <img src="assets/icon.png" alt="ControllaMI" width="128">
</p>

<h1 align="center">ControllaMI</h1>

<p align="center">
  <b>Control your first-generation Xiaomi YI Action Camera from a modern Android phone.</b><br>
  Free and open source, by <a href="https://github.com/Mistere-Tech">Mistere Tech</a>
</p>

<p align="center">
  <a href="https://github.com/Mistere-Tech/ControllaMI/releases/latest"><img src="https://img.shields.io/github/v/release/Mistere-Tech/ControllaMI?style=flat-square&label=download%20APK&color=FF8A3D" alt="Download APK"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/free-no%20ads%20·%20no%20tracking-2ea44f?style=flat-square" alt="Free, no ads, no tracking">
  <img src="https://img.shields.io/badge/Android-64%20bit-3DDC84?style=flat-square&logo=android&logoColor=white" alt="Android 64 bit">
  <img src="https://img.shields.io/badge/camera-YI%20YDXJ01XY%20(2015)-1A4752?style=flat-square" alt="YI Action Camera YDXJ01XY">
</p>

<p align="center"><b>English</b> · <a href="README.it.md">Italiano</a></p>

ControllaMI is a **free, open-source Android app for the Xiaomi YI Action Camera, first generation** (the original YI released in 2015, model YDXJ01XY).

The official YI app is no longer updated and often does not work on recent phones. ControllaMI replaces it with a modern 64-bit app that talks to the camera directly over its Wi-Fi.

## Download

👉 **[Download the latest version (APK)](https://github.com/Mistere-Tech/ControllaMI/releases/latest)**

1. Open the link on your phone and download `ControllaMI-vX.Y.Z-arm64.apk`.
2. Open it: Android asks you to allow "install unknown apps" for your browser. Confirm.
3. Turn on the camera's Wi-Fi, connect the phone to its network (`YDXJ_…`) and open ControllaMI.

**Updates:** at startup the app checks for a new version and, if there is one, asks you to install it before going on (for security, only the latest version is used). Tap "Download and install" and confirm with "Install".

Requirements: a 64-bit Android phone (arm64, which is almost every phone from recent years). The app is not on the Play Store.

## What it does

- **Simple mode**: 1080p 60 fps video at the highest bitrate, photos at the highest quality, video or photo timelapse with the interval you choose, exposure adjustment. The app sets up the camera for you.
- **Pro mode**: every camera setting, by hand. Your Pro settings are kept when you switch between modes.
- Live view from the camera, which recovers by itself if it stops
- Connection indicator (stable, unstable or lost) with automatic reconnection
- Gallery: list of files, download to the phone's gallery, delete
- Clear messages when a command fails (for example, no SD card)
- **Italian and English**, following the phone's language
- Demo mode with a simulated camera, to try the app without a camera

## Compatible cameras

| Camera | Supported |
|---|---|
| Xiaomi YI Action Camera, first generation (YDXJ01XY) | ✅ the camera this app is made for |
| YI 4K, YI 4K+, YI Lite, YI Discovery and later | ❌ not supported |

## Project status

🧪 **First public version (0.1.x).** Tested on a first-generation YI: live view, photo, video, timelapse, settings and gallery download work. The protocol is covered by automated tests, but the app has not been tried with every firmware version yet. If something does not work with your camera, please open an [issue](https://github.com/Mistere-Tech/ControllaMI/issues) with your phone model, Android version and camera firmware.

Known issue on Android 10 and later: when you connect to the camera's Wi-Fi, Android may ask "This network has no internet access. Stay connected?". Answer **yes**.

## Contributing

The code is open and contributions are welcome: bug reports, tests with your own camera, pull requests.

### Local development

```bash
npm install
npx expo install --fix
npm test              # protocol and logic tests
npm run mock          # fake YI on port 7878
npx expo run:android  # build and install on a phone connected via USB
```

To try the app against the mock: phone and PC on the same network; in the app tap **Advanced** and enter the PC's IP address.

Built with React Native 0.88 + Expo SDK 58 (New Architecture, development build, not Expo Go) and a small native module in Kotlin.

### How an APK is made

The GitHub Action [`android.yml`](.github/workflows/android.yml) builds the app on every push to `main` (the APK is available as an artifact of the run). When a `v*` tag is pushed, for example:

```bash
git tag v0.1.0
git push origin v0.1.0
```

the same Action publishes a **Release** with the APK attached, which is what people download.

APKs are signed with the project's release key, kept in GitHub Secrets: that is what lets updates install over the existing app. Builds from forks and pull requests, which cannot read the Secrets, are signed with Expo's debug key.

### Layout

```
app/                  screens (expo-router): connection + Control / Gallery / Settings tabs
src/core/             YI protocol, plain TypeScript, tested
  jsonStream.ts       parser for the back-to-back JSON objects arriving over TCP
  YiClient.ts         session/token, command queue, timeouts, notifications, expired token
  CameraController.ts app state, reconnection, REC/photo, settings, files
  fakeCamera.ts       simulated camera (tests, mock server, demo)
src/net/              TCP (react-native-tcp-socket) and gallery download
modules/yi-native/    native Expo module in Kotlin: Wi-Fi binding and RTSP player
mock/mockServer.ts    fake camera over TCP
tests/                node:test tests (npm test)
```

### Camera protocol

The camera runs a TCP server on `192.168.42.1:7878` that speaks JSON. Files are downloaded over HTTP from `http://192.168.42.1/DCIM/<folder>/` (`100MEDIA`, `101MEDIA`, …) and the live view is at `rtsp://192.168.42.1/live`.

| msg_id | What it does |
|---|---|
| 257 / 258 | open / close the session (token) |
| 3 / 9 / 2 | all settings / allowed options / change a setting |
| 13 | battery |
| 513 / 514 | start / stop recording |
| 769 | photo |
| 259 | start the live view stream |
| 1283 / 1282 / 1281 | cd / list / delete files |
| 7 | camera notifications (REC started/stopped, photo taken…) |

These codes come from community documentation and may vary with the firmware.

## License

[MIT](LICENSE): you are free to use, modify and redistribute the code.

ControllaMI is an independent project, not affiliated with Xiaomi or YI Technology. Xiaomi and YI are trademarks of their respective owners.
