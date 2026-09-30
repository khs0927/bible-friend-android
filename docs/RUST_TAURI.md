# Rust 기반 Android — 저장소 분석과 개발 프레임워크

## 1. 저장소 현황 (2026-09-30 기준)

| 저장소 | 스택 | 상태 | 역할 |
|---|---|---|---|
| `bible-friend-web` | Vite + React 19 + wouter + tRPC / Express + Drizzle(MySQL), Vercel 배포, Manus OAuth | **수정 중.** 최근 커밋에서 화면을 `대화 홈(/)` + `성경 지도(/map)` 두 개로 단순화 | **UI·기능 기준(source of truth)** |
| `bible-friend-android` | Expo SDK 57 + Supabase(RLS, Edge Functions) 모노레포 | v0.1 기능 완비(보호자 동의·아이 프로필·대화·TTS·성장·기도) | 모바일 백엔드·아동 보호 설계 |
| `bible-verse-web` | Kotlin + Ktor SSR, VoiceStudio TTS 연동 | 독립 소규모 사이트 | 구절 콘텐츠/TTS 참고용 |

**문제:** 웹과 Expo 앱이 UI를 각자 따로 구현하고 있어, 웹을 고칠 때마다 Android에 다시 옮겨야 합니다.
또 성장 엔진(`growthDomain.ts`)과 안전 규칙(`safety.ts`)이 두 저장소에 TypeScript로 중복되어 있습니다.

## 2. 선택: Tauri 2 (Rust) + 웹 클라이언트 재사용

```
bible-friend-web/client  ──(vite build / dev server)──►  WebView
                                                           │ invoke()
rust/apps/bible-friend (Tauri 2 셸, Android/iOS/데스크톱) ──┤
rust/crates/bf-core    (성장 엔진·안전 검사·암송 구절)  ◄──┘
```

- **UI는 웹 그대로.** 웹을 수정하면 `sync-web` 한 번으로 Android에 반영됩니다(개발 중에는 웹 dev 서버를 직접 띄움).
- **로직·네이티브는 Rust.** `bf-core`는 WebView 없이 순수 Rust로 테스트되고, 이후 Rust 서버(Axum 등)나
  Edge Function 대체에도 그대로 쓸 수 있습니다.
- 대안으로 검토한 Dioxus/egui 등 순수 Rust UI는 웹 UI를 전부 다시 써야 해서 "웹 기반으로 Android 적용" 목표와 맞지 않습니다.

## 3. 구조

```
rust/
  Cargo.toml                 워크스페이스 (default-members = bf-core)
  crates/bf-core/            growth.rs · safety.rs · verses.rs + 단위 테스트
  apps/bible-friend/         Tauri 2 셸 (lib = 모바일 진입점, commands.rs = IPC)
  web-dist/                  sync-web 결과물 (placeholder만 커밋)
scripts/sync-web.mjs         웹 클라이언트 빌드 → rust/web-dist 복사
```

JSON 필드는 웹 tRPC와 같은 camelCase(장비 티어 키는 snake_case)라서 서버 응답을 그대로 넘길 수 있습니다.

### 웹에서 호출 가능한 명령

| 명령 | 인자 | 설명 |
|---|---|---|
| `app_info` | – | 버전·플랫폼 (웹에서 Tauri 환경 감지용) |
| `screen_child_input` | `text` | 모델 호출 전 사전 검사(서버 검사는 그대로 유지) |
| `sanitize_reply` | `reply` | 링크·마크다운 제거, 700자 제한 |
| `growth_initial` / `growth_apply_activity` / `growth_apply_decay` / `growth_upgrade` | `profile`, `activity` … | 즉시 UI 반영용 로컬 계산. 저장은 서버가 권위 |
| `daily_verses` | – | 암송 구절 |

```ts
// 웹 쪽 사용 예 (Tauri 안에서만)
if ("__TAURI__" in window) {
  const r = await window.__TAURI__.core.invoke("screen_child_input", { text });
}
```

## 4. 명령어

```bash
pnpm rust:test            # bf-core 단위 테스트
pnpm rust:check           # fmt + clippy(-D warnings), Tauri 셸 포함 (Linux는 libwebkit2gtk-4.1-dev 필요)

# 최초 1회: Android Studio SDK + NDK, JAVA_HOME, ANDROID_HOME, NDK_HOME 설정 후
cargo install tauri-cli --version "^2" --locked
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
pnpm rust:android:init    # gen/android 생성

# 개발: 웹 dev 서버(포트 3000)를 띄운 상태에서
(cd ../bible-friend-web && pnpm dev)
pnpm rust:android:dev     # 에뮬레이터/기기에서 웹 UI + Rust 명령 핫리로드

pnpm rust:android:build   # 웹 빌드 동기화 → APK
```

## 5. 남은 작업 (다음 단계)

1. **API 주소(웹 저장소):** 웹 클라이언트가 `/api/trpc`, `/api/voice-tts-stream`을 상대 경로로 부릅니다.
   번들된 앱(`tauri://localhost`)에서는 서버 주소가 필요하므로 `VITE_API_BASE_URL`을 도입하고,
   서버에 Tauri origin CORS를 허용해야 합니다. 인증은 이미 `Authorization: Bearer` 경로가 있어 쿠키 없이 동작 가능합니다.
   (개발 모드는 dev 서버를 그대로 쓰므로 수정 없이 동작)
2. **백엔드 통합 결정:** 웹(Express+MySQL+Manus OAuth) vs Android(Supabase). 아동 보호 설계(동의·RLS·쿼터)가
   있는 Supabase로 모으는 것을 권장합니다.
3. **네이티브 기능:** 마이크 녹음(STT)·알림·오디오 포커스는 Tauri 플러그인(`tauri-plugin-notification` 등) 또는
   `gen/android`의 Kotlin 플러그인으로 추가. Android WebView 마이크 권한은 `RECORD_AUDIO` 매니페스트 필요.
4. **중복 제거:** 웹 서버 로직을 Rust로 옮길 경우 `bf-core`를 Axum 서버에서 재사용하고, TS 사본은 테스트 픽스처로 동기화 검증.
5. 기존 Expo 앱(`apps/mobile`)은 Tauri 셸이 기능 동등해질 때까지 유지.
