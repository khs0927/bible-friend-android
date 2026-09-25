# 아키텍처

## 계정 모델

```
auth.users ──1:1── guardians (보호자, 동의 기록)
                      └──1:N── children (별명·출생연도·아바타, 최대 6명)
                                  ├── chat_messages      (쓰기: chat 함수만)
                                  ├── prayer_notes       (앱이 직접 CRUD, RLS)
                                  ├── favorite_verses    (앱이 직접 CRUD, RLS)
                                  ├── treasure_cards     (쓰기: growth 함수만)
                                  ├── growth_profiles    (쓰기: growth 함수만)
                                  └── growth_events      (보상 멱등키)
guardians ──1:N── ai_usage (일일 쿼터, consume_ai_quota()로만 증가)
```

아이는 로그인하지 않습니다. 보호자 계정 안에서 기기에 선택된 아이 프로필로 동작합니다.

## 요청 흐름

| 기능 | 경로 |
|---|---|
| 기도 노트·즐겨찾기·아이 프로필 | 앱 → PostgREST (RLS로 보호) |
| 대화 | 앱 → `chat` 함수 → 동의·소유 확인 → 쿼터 → 안전 검사 → Gemini → 저장 → 성장 보상 |
| 읽어주기 | 앱 → `tts` 함수 → Storage 캐시 확인 → (없으면) Gemini TTS → WAV 저장 → 서명 URL → `expo-audio` 재생 |
| 목소리 질문 | `expo-audio` 녹음(16kHz 모노 AAC) → `transcribe` 함수 → Gemini → 텍스트 (오디오는 저장하지 않음) |
| 성장 | 앱 → `growth` 함수 (get / claim / upgrade). 멱등키 + 낙관적 동시성(updated_at CAS) |
| 탈퇴 | 앱 → `delete-account` 함수 → `auth.admin.deleteUser` → CASCADE |

## 음성 재생 전략

1. 문장 단위로 나눠 첫 문장부터 서버 음성(Gemini)을 요청하고, 재생하는 동안 다음 문장을 미리 받아 둡니다.
2. 서버 음성이 실패하면 남은 문장은 기기 음성(`expo-speech`, ko-KR)으로 이어 읽습니다.
3. 같은 문장(동화·인사·구절)은 Storage에 캐시되므로 두 번째부터는 비용과 지연이 없습니다.

## 공유 코드

`packages/core`는 의존성이 `zod` 하나뿐인 순수 TypeScript입니다. Supabase CLI는 `supabase/functions` 밖의 파일을 번들하지 않으므로 `pnpm sync:core`가 `_shared/core`로 복사합니다. CI는 `pnpm sync:core --check`로 복사본이 최신인지 확인합니다.

## 품질 게이트

| 계층 | 도구 |
|---|---|
| 도메인 | vitest (`packages/core`) |
| DB 보안 | pgTAP (`supabase/tests/database`) |
| 서버 | `deno check` + E2E 스모크 (`scripts/smoke-local.mjs`) |
| 앱 | `tsc`, `expo lint`, `expo export --platform android` |
