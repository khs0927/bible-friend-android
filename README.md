# 성경 친구 (Bible Friend) — Android · iOS

어린이가 성경 이야기를 읽고, 궁금한 것을 AI 성경 친구에게 목소리로 묻고, 기도하고, 말씀을 외우며 "성장"하는 앱입니다.
[`bible-friend-web`](https://github.com/khs0927/bible-friend-web)(Manus 기반 웹)을 **Expo + Supabase** 네이티브 앱으로 새로 만든 저장소입니다.

## 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 앱 | **Expo SDK 57** (React Native 0.86, New Architecture, Hermes) + **Expo Router** | 하나의 코드로 Android·iOS, EAS로 빌드/스토어 제출/OTA 업데이트 |
| 서버 상태 | TanStack Query | 캐시·재시도·로딩 상태 |
| 음성 | `expo-audio`(녹음·재생), `expo-speech`(기기 음성 폴백) | 웹의 iOS 오디오 우회 코드 없이 네이티브로 처리 |
| 백엔드 | **Supabase** — Auth(카카오·Apple·Google), Postgres + **RLS**, Storage, **Edge Functions**(Deno) | 서버 없이 보안·인증·DB·AI 프록시를 한 곳에서 |
| AI | Gemini (대화·TTS·STT) — Edge Function에서만 호출 | API 키가 앱에 절대 포함되지 않음 |
| 공유 로직 | `packages/core` (zod 계약, 성장 엔진, 성경 콘텐츠, 아동 안전 규칙) | 앱과 Edge Function이 같은 코드 사용 |
| 모노레포 | pnpm workspaces + Turborepo | |

## 구조

```
apps/mobile/            Expo 앱 (src/app = 화면/라우트, src/lib = 데이터·음성·인증)
packages/core/          공유 도메인 로직 + 테스트 (vitest)
supabase/
  migrations/           스키마 + RLS + 쿼터 함수
  functions/            chat · tts · transcribe · growth · delete-account
  functions/_shared/core  ← packages/core 자동 복사본 (pnpm sync:core)
  tests/database/       pgTAP 보안 테스트
scripts/                sync-core, smoke-local (E2E)
docs/                   아키텍처, 로컬 개발, 로그인 설정, 로드맵
```

## 빠른 시작 (Windows + Android 에뮬레이터)

```bash
pnpm install
pnpm android:setup   # 최초 1회: SDK 패키지 확인/설치 + 에뮬레이터(BibleFriend_Pixel) 생성
pnpm android:dev     # Supabase → Edge Functions → 에뮬레이터 → 앱 빌드·설치·실행
```

자세한 내용은 [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)를 보세요. 개발 빌드의 로그인 화면에 있는 **개발용 로그인** 버튼을 쓰면 실제 카카오/구글 키 없이 바로 테스트할 수 있습니다.

## 검증

```bash
pnpm check        # core 복사본 동기화 확인 + 타입체크 + 린트 + 유닛 테스트
pnpm db:test      # pgTAP: RLS·동의·쿼터 보안 테스트
pnpm smoke        # 로컬 스택 E2E: 가입→동의→아이→대화→성장→탈퇴
```

## 아동 보호 설계 요약

- 보호자 계정만 로그인하고, 아이는 **별명 + 출생 연도**만 가진 프로필로 사용합니다.
- **법정대리인 동의** 전에는 아이 프로필 생성과 AI 사용이 DB·서버 양쪽에서 막힙니다.
- 아이 입력은 모델 호출 **전에** 자해·학대·개인정보를 걸러 안전 답변과 상담 번호(1388·1391)로 안내합니다.
- Gemini 안전 필터는 가장 엄격한 수준이고, 답변에서는 링크·마크다운을 제거합니다.
- 대화 기록·성장·보물 카드는 Edge Function만 쓸 수 있습니다. 앱이 보상을 위조할 수 없습니다.
- 보호자 계정 단위로 하루 AI 사용량 한도가 있습니다. 비용 폭주를 막습니다.
- 설정 화면은 **보호자 확인(곱셈 문제)** 뒤에 있고, 계정 영구 삭제를 지원합니다(스토어 정책).
