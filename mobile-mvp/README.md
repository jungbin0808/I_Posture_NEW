# 아이포스처 개인용 MVP 0.3.1

Android 7.0 이상용 테스트 APK입니다. 기존 앱과 별도 설치됩니다. 카메라 권한을 허용하고 전신이 보이도록 휴대폰을 고정하세요.

- 체형: 정면 → 우측면 → 후면 자동 전환, 사진 검토와 재촬영
- 정밀: 7개 부위, 52개 동작 선택 → 시작 자세 → 움직인 자세
- 모션: 관절 표시와 영상 녹화 → 1초 간격 팔꿈치·무릎 각도 분석
- 인바디: 수치 직접 입력, 결과지 사진 선택 첨부
- 기록: 기기 내부 IndexedDB에 저장, 조회·삭제·수치 JSON 내보내기

MediaPipe Pose 모델을 APK에 포함하여 관절 추론을 기기에서 수행합니다. 서버나 로그인은 사용하지 않습니다. 정밀·체형 각도 계산은 제공된 백엔드 소스에서 분리했습니다. 벡터 내적이 0인 경우 180도로 반환하던 원본 오류는 90도로 수정했습니다. 정상 범위 DB가 없어 정상/비정상 판정은 제공하지 않습니다. 모션은 팔꿈치·무릎 각도 시계열이며 기존 서비스 전체 분석의 복제는 아닙니다. 인바디 OCR은 없습니다.

앱 삭제 또는 앱 데이터 삭제 시 기록도 삭제됩니다. 측정은 2D 영상 기준이며 의료 진단용 정확도를 검증하지 않았습니다.

## 빌드

Node 22+, Java 17~21, Android SDK platform 35 및 build-tools 35.0.0이 필요합니다.

```sh
export ANDROID_HOME=/path/to/android-sdk
bash scripts/build-apk.sh
```

출력: `android/app/build/outputs/apk/debug/app-debug.apk`

Gradle 8.11.1 wrapper와 npm lockfile을 사용합니다. 모델은 npm 패키지에서 복사합니다. 개인 서명키는 저장소에 포함하지 않습니다. 재빌드의 debug 서명은 기기별로 달라질 수 있어 배포용 업데이트에는 별도 보관한 서명키가 필요합니다.

## 검증

```sh
npm ci
npm test
npm run build
CAMERA_FIXTURE=/absolute/path/person.y4m npm run test:camera
```

Playwright 설정은 `/usr/bin/chromium`을 사용합니다. Y4M 전신 영상으로 실제 모델 관절 출력, 동일 스트림에서 3방향 촬영 전환, 정밀 2장 촬영, 전면 미러 정렬, 모션 녹화·분석, 기록 유지·삭제를 확인합니다. 실제 Android 휴대폰에서 카메라·파일 선택·뒤로가기·설치 검증은 아직 수행하지 않았습니다.

`src/vendor`는 제공된 백엔드 계산 로직입니다. 모델 라이선스는 npm 패키지의 라이선스를 따릅니다. 이 폴더는 Android AAR SDK가 아닌 APK용 React/WebView 앱입니다.
