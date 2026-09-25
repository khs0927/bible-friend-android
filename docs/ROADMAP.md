# 로드맵

## ✅ v0.1 — 기반 (이 커밋)

- Expo SDK 57 모노레포, Supabase 스키마·RLS·Edge Functions
- 보호자 로그인(카카오·Google·Apple), 법정대리인 동의, 아이 프로필
- 대화(텍스트·음성), 읽어주기(서버 음성 + 기기 음성 폴백), 이야기 9편 + 다윗 그림책 30쪽 + 퀴즈
- 기도 노트(말씀 추천), 즐겨찾기, 보물 카드, 성장(스탯·암송·미션·전신갑주)
- 매일 말씀 로컬 알림, 보호자 설정(보호자 확인, 사용량, 기록 삭제, 탈퇴)
- 테스트: core vitest, pgTAP, E2E 스모크, CI

## v0.2 — 실제 기기 · 운영 준비

- [ ] Supabase 호스팅 프로젝트 생성·연결(`supabase link`, `db push`, `functions deploy`, `secrets set`)
- [ ] 카카오·Google·Apple 콘솔 설정 ([AUTH_PROVIDERS.md](AUTH_PROVIDERS.md))
- [ ] `eas init` → `eas build --profile development` (실기기 테스트)
- [ ] 개인정보 처리방침·이용약관 페이지(URL) 작성 후 동의 화면에 연결
- [ ] Sentry(`@sentry/react-native`) 오류 수집, 개인정보가 빠진 이벤트만 전송
- [ ] Maestro E2E(로그인 → 동의 → 대화 → 기도) 흐름 테스트

## v0.3 — 경험 고도화

- [ ] 답변 스트리밍(SSE)으로 첫 글자 지연 줄이기
- [ ] 성장 캐릭터 애니메이션(Rive 또는 Reanimated), 웹의 3D 캐릭터를 경량 2D로 이식
- [ ] 동화 콘텐츠를 DB/Storage로 옮겨 앱 업데이트 없이 추가
- [ ] 보호자 대시보드(주간 리포트, 대화 요약)
- [ ] 오프라인: 이야기·구절 캐시

## 출시

- [ ] Google Play: 가족 정책(Families), 데이터 보안 양식, 타깃 연령 설정
- [ ] App Store: Kids 카테고리 여부 결정(외부 링크·광고·분석 제한), 개인정보 라벨
- [ ] `eas submit`, EAS Update 채널(preview / production)
