#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?Set ANDROID_HOME to an Android SDK with platform 35 and build-tools 35.0.0}"
npm ci
npm test
npm run build
rm -rf android/app/src/main/assets/www
mkdir -p android/app/src/main/assets/www
cp -R dist/. android/app/src/main/assets/www/
cd android
./gradlew :app:assembleDebug :app:lintDebug --no-daemon
printf '\nAPK: %s\n' "$PWD/app/build/outputs/apk/debug/app-debug.apk"
