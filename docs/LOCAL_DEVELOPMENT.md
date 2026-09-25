# 로컬 개발 (Windows · Android 에뮬레이터)

## 1. 한 번만 설치

| 도구 | 용도 | 확인 |
|---|---|---|
| Node.js 22+ / pnpm 10 | 패키지 | `node -v`, `pnpm -v` |
| Docker Desktop | 로컬 Supabase | `docker info` |
| JDK 17 이상 | Android 빌드 | `java -version` |
| **Android Studio** | SDK + 에뮬레이터 | 아래 참고 |

### Android Studio 설정

1. [Android Studio](https://developer.android.com/studio)를 설치합니다.
2. **More Actions → SDK Manager**에서 *Android SDK Platform*(최신)과 *Android SDK Build-Tools*, *Android Emulator*, *Android SDK Platform-Tools*를 설치합니다.
3. 환경 변수를 설정합니다(PowerShell).
   ```powershell
   setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
   setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator"
   ```
4. **Device Manager**에서 에뮬레이터(예: Pixel 8, 최신 API, Google Play 이미지)를 만들고 실행합니다.
5. 새 터미널에서 `adb devices`로 에뮬레이터가 보이는지 확인합니다.

공식 안내: https://docs.expo.dev/workflow/android-studio-emulator/

## 2. 백엔드 (로컬 Supabase)

```bash
pnpm install
pnpm db:start            # 첫 실행은 Docker 이미지 다운로드로 몇 분 걸려요
pnpm exec supabase status   # API URL과 Publishable key 확인
```

Edge Functions용 비밀 값:

```bash
cp supabase/functions/.env.example supabase/functions/.env
# GEMINI_API_KEY 입력 (없어도 동작: 대화는 안전한 기본 답변, 음성은 기기 음성으로 대체)
pnpm functions:serve
```

## 3. 앱

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

`.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321          # 에뮬레이터 → 내 PC
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase status의 Publishable key>
```

> 실제 폰으로 테스트할 때는 `10.0.2.2` 대신 PC의 LAN IP(예: `192.168.0.10`)를 씁니다.

```bash
pnpm android      # = expo run:android : 개발 빌드를 만들어 에뮬레이터에 설치하고 Metro 실행
```

이후에는 `pnpm dev`(Metro만 실행)로 빠르게 반복할 수 있습니다. 네이티브 모듈을 추가했을 때만 `pnpm android`로 다시 빌드합니다.

> Expo Go는 쓰지 않습니다. 이 앱은 Apple 로그인·알림 같은 네이티브 모듈과 커스텀 스킴(`biblefriend://`)을 쓰므로 **개발 빌드(dev client)** 가 필요합니다.

## 4. 로그인

- 개발 빌드의 로그인 화면에 있는 **개발용 로그인** 버튼은 로컬 Supabase에 `guardian@dev.local` 계정을 자동으로 만들어 로그인합니다.
- 카카오·Google·Apple 로그인 설정은 [AUTH_PROVIDERS.md](AUTH_PROVIDERS.md)를 보세요.

## 5. 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `pnpm check` | core 동기화 확인, 타입체크, 린트, 유닛 테스트 |
| `pnpm db:test` | pgTAP 보안 테스트 |
| `pnpm smoke` | 로컬 스택 E2E 스모크 테스트 |
| `pnpm db:reset` | DB 초기화 후 마이그레이션 다시 적용 |
| `pnpm db:types` | DB 스키마 → `apps/mobile/src/lib/database.types.ts` 생성 |
| `pnpm sync:core` | `packages/core` → Edge Functions 복사 (core 수정 후 필수) |

## 6. 새 마이그레이션

```bash
pnpm exec supabase migration new <이름>
# SQL 작성 후
pnpm db:reset && pnpm db:types && pnpm db:test
```
