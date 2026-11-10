// Config plugin Expo: firma la build release con la chiave di ControllaMI.
// La chiave arriva dalla CI (GitHub Secrets) tramite variabili d'ambiente; se manca
// (build in locale o fork) si usa la chiave di debug, come prima.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = 'CONTROLLAMI_KEYSTORE';

const RELEASE_CONFIG = `signingConfigs {
        release {
            if (System.getenv("CONTROLLAMI_KEYSTORE")) {
                storeFile file(System.getenv("CONTROLLAMI_KEYSTORE"))
                storePassword System.getenv("CONTROLLAMI_KEYSTORE_PASSWORD")
                keyAlias System.getenv("CONTROLLAMI_KEY_ALIAS")
                keyPassword System.getenv("CONTROLLAMI_KEY_PASSWORD")
            }
        }`;

/** Trasforma il testo di android/app/build.gradle (funzione pura, testata). */
function addReleaseSigning(gradle) {
  if (gradle.includes(MARK)) return gradle;
  if (!/signingConfigs\s*\{/.test(gradle)) {
    throw new Error('withReleaseSigning: blocco signingConfigs non trovato in build.gradle');
  }
  let out = gradle.replace(/signingConfigs\s*\{/, RELEASE_CONFIG);
  const bt = out.search(/buildTypes\s*\{/);
  const rel = out.slice(bt).search(/release\s*\{/);
  if (bt < 0 || rel < 0) throw new Error('withReleaseSigning: buildTypes.release non trovato in build.gradle');
  const start = bt + rel;
  const tail = out.slice(start).replace(
    'signingConfig signingConfigs.debug',
    'signingConfig System.getenv("CONTROLLAMI_KEYSTORE") ? signingConfigs.release : signingConfigs.debug',
  );
  out = out.slice(0, start) + tail;
  return out;
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
