# 소셜 로그인 설정 (카카오 · Google · Apple)

앱은 Supabase Auth의 OAuth(PKCE) 흐름을 씁니다.

```
앱 ─ signInWithOAuth(provider, redirectTo = biblefriend://auth/callback)
   → 인앱 브라우저 → 공급자 로그인 → Supabase /auth/v1/callback
   → biblefriend://auth/callback?code=… → exchangeCodeForSession(code)
```

iOS에서 Apple은 네이티브 시트(`expo-apple-authentication`)와 `signInWithIdToken`을 씁니다.

## 공통: Supabase 대시보드

**Authentication → URL Configuration**

- Site URL: `biblefriend://auth/callback`
- Redirect URLs: `biblefriend://auth/callback`

각 공급자의 콜백 URL은 `https://<project-ref>.supabase.co/auth/v1/callback`입니다.

## 카카오

1. [Kakao Developers](https://developers.kakao.com)에서 애플리케이션을 만듭니다.
2. **카카오 로그인** 활성화 → Redirect URI에 Supabase 콜백 URL을 등록합니다.
3. **동의 항목**: 닉네임(필수), 카카오계정 이메일(선택).
4. **보안 → Client Secret**을 생성하고 활성화합니다.
5. Supabase **Authentication → Providers → Kakao**에 REST API 키(Client ID)와 Client Secret을 입력합니다.

## Google

1. Google Cloud Console → **APIs & Services → Credentials**
2. **OAuth client ID (Web application)** 을 만들고 Authorized redirect URI에 Supabase 콜백 URL을 넣습니다.
3. Supabase **Providers → Google**에 Client ID와 Secret을 입력합니다.

## Apple

1. Apple Developer → Identifiers에서 App ID `com.biblefriend.app`의 *Sign in with Apple*을 켭니다.
2. Android/웹 흐름용으로 **Services ID**를 만들고 Return URL에 Supabase 콜백 URL을 넣습니다.
3. **Key**(Sign in with Apple)를 만들고, Supabase **Providers → Apple**에 Services ID, Team ID, Key ID, 비밀 키를 입력합니다.
4. Client IDs에는 Services ID와 iOS 번들 ID(`com.biblefriend.app`)를 둘 다 넣습니다. iOS 네이티브 로그인에 필요합니다.

> App Store 정책상 카카오나 Google 같은 소셜 로그인을 제공하면 **Sign in with Apple도 반드시 제공**해야 합니다.

## 로컬 Supabase에서 테스트하려면

`supabase/config.toml`의 `[auth.external.*]`에서 `enabled = true`로 바꾸고, 환경 변수를 설정한 뒤 `pnpm db:stop && pnpm db:start`를 실행합니다.

```
SUPABASE_AUTH_EXTERNAL_KAKAO_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_KAKAO_SECRET=...
```

로컬 콜백은 `http://127.0.0.1:54321/auth/v1/callback`이므로 공급자 콘솔에도 이 주소를 등록해야 합니다. 보통은 **개발용 로그인**으로 충분합니다.
