# Research: Supabase Swift SDK - Google OAuth on iOS

**Date**: 2026-04-02
**Decision it informs**: Auth architecture for xomper-ios native app
**Status**: Complete

## Question
How should xomper-ios implement Google OAuth (and other auth) using the Supabase Swift SDK? What's the SDK maturity, best flow for iOS, and production-quality implementation pattern?

## Key Finding: XomFit Already Solves This

Before diving into external research, the critical discovery is that **XomFit (xomfit-ios) already has a production Supabase Swift auth implementation** with Google OAuth, Apple Sign-In, and email/password. This is a solved problem within the Xomware org. The patterns below are validated and running.

- **Repo**: `/Users/dom/Code/xomfit-ios`
- **Auth service**: `Xomfit/Services/AuthService.swift`
- **Supabase client**: `Xomfit/Services/SupabaseClient.swift`
- **App entry + URL handling**: `Xomfit/XomfitApp.swift`
- **Full setup guide**: `docs/SETUP_GUIDE.md`
- **SDK version in use**: supabase-swift 2.41.1

## Findings

### 1. Supabase Swift SDK Maturity

**Package**: `supabase-swift` (https://github.com/supabase/supabase-swift)
**Version in XomFit**: 2.41.1 (latest stable as of early 2026)
**Swift compatibility**: Swift 6.1+ confirmed working (XomFit builds with Swift 6.1.2)
**iOS compatibility**: iOS 17+ works. The SDK uses Swift concurrency (`async/await`, `AsyncSequence`).

Key capabilities verified in XomFit:
- Full `async/await` API (no completion handlers needed)
- `authStateChanges` as `AsyncSequence` -- works with `for await` loops
- `signInWithOAuth` for browser-based flows (Google)
- `signInWithIdToken` for native token exchange (Apple)
- `signInWithPassword` for email/password
- Automatic token refresh
- Session persistence via Keychain (built-in, no config needed)

**Assessment**: Mature, actively maintained, first-party SDK. No concerns for production use.

### 2. Google OAuth Flow on iOS

**How XomFit implements it** (and how Xomper should too):

Supabase's `signInWithOAuth(provider: .google)` uses `ASWebAuthenticationSession` under the hood. This is Apple's sanctioned way to do OAuth in-app -- it shows a system web sheet (not a full Safari redirect), handles cookies, and dismisses cleanly.

**Flow**:
1. User taps "Sign in with Google"
2. SDK calls `signInWithOAuth(provider: .google, redirectTo: URL(string: "xomper://login-callback"))`
3. `ASWebAuthenticationSession` opens a web sheet to Supabase's OAuth endpoint
4. User authenticates with Google in the web sheet
5. Google redirects to `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
6. Supabase processes the token and redirects to `xomper://login-callback`
7. iOS intercepts the custom URL scheme and sends it to `onOpenURL`
8. App calls `supabase.auth.session(from: url)` to exchange for a session
9. `authStateChanges` fires, updating the auth state

**Code (from XomFit, works as-is)**:
```swift
// In AuthService
func signInWithGoogle() async {
    do {
        try await supabase.auth.signInWithOAuth(
            provider: .google,
            redirectTo: URL(string: Config.oauthCallbackURL)
        )
    } catch {
        errorMessage = error.localizedDescription
    }
}

// In XomperApp.swift (entry point)
.onOpenURL { url in
    Task {
        try? await supabase.auth.session(from: url)
    }
}
```

**No native Google Sign-In SDK needed.** Supabase's built-in OAuth flow via `ASWebAuthenticationSession` is the correct approach. Adding Google's SDK would mean:
- Extra 10MB+ dependency
- Separate Google Cloud iOS client ID (distinct from web client ID)
- More complex token exchange logic
- No meaningful UX improvement over `ASWebAuthenticationSession`

### 3. Apple Sign-In (Recommended Addition)

XomFit implements Apple Sign-In using the native `AuthenticationServices` framework + Supabase's `signInWithIdToken`. This is the highest-quality approach because:
- Uses the native iOS Sign in with Apple sheet (best UX)
- No web view involved
- Required by App Store if you offer any third-party sign-in

**Flow**:
1. Generate a cryptographic nonce
2. Create `ASAuthorizationAppleIDRequest` with the hashed nonce
3. Present `SignInWithAppleButton` (SwiftUI native)
4. On success, extract the `identityToken` from the credential
5. Pass `identityToken` + raw nonce to `supabase.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: token, nonce: nonce))`
6. Supabase returns a session

**App Store requirement**: If Xomper offers Google Sign-In, Apple Sign-In must also be offered per App Store Review Guidelines 4.8. This is non-negotiable for App Store distribution.

### 4. Auth Session Persistence

The Supabase Swift SDK handles this automatically:
- **Token storage**: Keychain (secure, persists across app launches)
- **Token refresh**: Automatic -- the SDK refreshes tokens before they expire
- **Session restoration**: On app launch, `authStateChanges` emits `.initialSession` with the persisted session
- **No manual Keychain code needed**

XomFit's pattern for handling this:
```swift
// In AuthService.init()
Task { await listenForAuthChanges() }

// The listener
private func listenForAuthChanges() async {
    for await (event, session) in supabase.auth.authStateChanges {
        self.currentSession = session
        self.currentUser = session?.user
        self.isAuthenticated = session != nil
        if event == .initialSession {
            self.isLoading = false  // App is ready to show UI
        }
    }
}
```

### 5. Required Configuration

**Supabase Dashboard**:
- Enable Google provider with Web OAuth Client ID + Secret
- Enable Apple provider with Service ID + Key
- Add `xomper://login-callback` to Redirect URLs
- Set Site URL to `xomper://login-callback`

**Google Cloud Console**:
- Create a **Web application** OAuth Client ID (not iOS -- Supabase handles the flow server-side)
- Add `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` as authorized redirect URI
- Note: The same Supabase project that serves xomper-front-end can be reused. Google provider is already configured there.

**Xcode / Info.plist**:
- Register custom URL scheme `xomper` in URL Types
- Add `onOpenURL` handler in the app entry point

**Config.swift**:
```swift
enum Config {
    static let supabaseURL = "https://YOUR_REF.supabase.co"
    static let supabaseAnonKey = "YOUR_ANON_KEY"
    static let oauthScheme = "xomper"
    static let oauthCallbackURL = "xomper://login-callback"
}
```

### 6. Known Gotchas

From XomFit's troubleshooting docs and implementation:

| Issue | Cause | Fix |
|-------|-------|-----|
| OAuth redirect opens Safari instead of app | URL scheme not registered in Info.plist | Add `xomper` to CFBundleURLSchemes |
| Google Sign-In redirects but doesn't complete | Redirect URL mismatch | Ensure Supabase redirect URLs include `xomper://login-callback` exactly |
| Session not restored on app launch | Missing `onOpenURL` handler | Add `.onOpenURL` to the root view in the App struct |
| `ASWebAuthenticationSession` dismissed without completing | User cancelled or callback URL mismatch | Handle gracefully; check `oauthCallbackURL` matches Supabase config |
| Apple rejects app | Offers Google but not Apple Sign-In | Must include Sign in with Apple per guideline 4.8 |
| Simulator Google OAuth fails | Simulator restrictions with `ASWebAuthenticationSession` | Test on physical device; simulator usually works but can be flaky |

### 7. Shared Supabase Project Consideration

Xomper web already has a Supabase project with Google OAuth configured. The iOS app can use the **same Supabase project** -- same URL, same anon key, same `profiles` and `whitelisted_users` tables. The only addition needed is:
- Adding `xomper://login-callback` to the Supabase project's redirect URLs
- The Google OAuth Web Client ID already configured for the web app works for iOS too (since Supabase handles it server-side)

This means zero backend changes. Auth just works.

## Recommendation

**Port XomFit's auth implementation directly.** It is a proven, production-quality pattern that already runs in the Xomware org. Specifically:

1. **Use Supabase's built-in OAuth** for Google Sign-In (`signInWithOAuth`). Do not add the Google Sign-In SDK.
2. **Add Apple Sign-In** using native `AuthenticationServices` + `signInWithIdToken`. Required for App Store.
3. **Include email/password** as a fallback (matches web app).
4. **Reuse the same Supabase project** as xomper-front-end. Just add the iOS redirect URL.
5. **Copy XomFit's `AuthService.swift` pattern** -- `@Observable`, `@MainActor`, `async/await` throughout, `authStateChanges` for reactive state.

Files to reference when implementing:
- `xomfit-ios/Xomfit/Services/AuthService.swift` -- primary auth logic
- `xomfit-ios/Xomfit/Services/SupabaseClient.swift` -- client init pattern
- `xomfit-ios/Xomfit/XomfitApp.swift` -- `onOpenURL` handler
- `xomfit-ios/Xomfit/Config.swift.template` -- config pattern
- `xomfit-ios/Info.plist.example` -- URL scheme registration
- `xomfit-ios/docs/SETUP_GUIDE.md` -- complete setup walkthrough (sections 6-9)

Estimated effort: 1-2 hours to port and configure. The code is effectively copy-paste with `xomfit` replaced by `xomper`.

## Key Links / References
- Supabase Swift SDK: https://github.com/supabase/supabase-swift
- Supabase iOS OAuth docs: https://supabase.com/docs/reference/swift/auth-signinwithoauth
- Apple Sign in with Apple docs: https://developer.apple.com/sign-in-with-apple/
- App Store Review Guideline 4.8 (Sign in with Apple requirement): https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple
- XomFit setup guide (internal): `/Users/dom/Code/xomfit-ios/docs/SETUP_GUIDE.md`

## Open Questions
- [ ] Does the existing Xomper Supabase project have Apple Sign-In configured? If not, need Apple Developer setup (Service ID, key, etc.)
- [ ] Should xomper-ios enforce the same whitelist check as the web app (`whitelisted_users` table), or is the 12-person league small enough to skip it on mobile?
- [ ] Will xomper-ios share the same Sleeper account linking flow, or should it assume the profile is already linked via the web app?
