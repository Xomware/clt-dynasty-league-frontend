# Plan: xomper-ios -- Native SwiftUI Fantasy Football Companion

**Status**: Ready
**Created**: 2026-04-02
**Last updated**: 2026-04-02

## Summary

Build a Universal SwiftUI app (iOS 17+, iPhone + iPad + Mac via Designed for iPad) that is a full native port of the xomper-front-end Angular web app. The app provides a dynasty fantasy football companion for a 12-person league, including standings, matchups, playoff brackets, World Cup tournament, draft history, matchup history, rule proposals, taxi squad management, and Sleeper account integration. Success looks like: every feature in the Angular app works natively on iOS with the Midnight Emerald dark theme, using the same Supabase backend and Sleeper API.

## Approach

**Option A: Lean SwiftUI + @Observable Services** from the brainstorm doc. Angular services map 1:1 to `@Observable` Swift store classes. `NavigationSplitView` for adaptive layout (collapses to single-column on iPhone). Supabase Swift SDK for auth (copy XomFit pattern). URLSession + async/await for Sleeper API. File-based player cache with ETag validation.

Reference docs:
- `docs/features/xomper-ios/BRAINSTORM.md`
- `docs/features/xomper-ios/RESEARCH-supabase-auth.md`
- `docs/features/xomper-ios/RESEARCH-player-data-caching.md`
- `docs/features/xomper-ios/RESEARCH-device-targets.md`

## Project Structure

```
xomper-ios/
  Xomper.xcodeproj
  Xomper/
    App/
      XomperApp.swift                    # Entry point, environment injection, onOpenURL
      ContentView.swift                  # Auth gate -> TabView
    Config.swift                         # Supabase URL, anon key, OAuth callback, API Gateway URL
    Config.swift.template                # Committed template (no secrets)

    Core/
      Networking/
        SleeperAPIClient.swift           # Protocol + URLSession implementation
        SupabaseManager.swift            # Supabase Swift SDK client init + validation
        XomperAPIClient.swift            # API Gateway client (email endpoints)
      Stores/
        AuthStore.swift                  # Auth state, Google OAuth, Apple Sign-In, email auth
        LeagueStore.swift                # League state, chain traversal, matchup fetching
        PlayerStore.swift                # Player dictionary + file cache + ETag
        UserStore.swift                  # Sleeper user state, avatar URLs
        TeamStore.swift                  # Selected team state
        StandingsStore.swift             # Standings calculation (league-wide + divisional)
        HistoryStore.swift               # Draft history, matchup history, champions (chain-based)
        WorldCupStore.swift              # World Cup standings computation (extracted from HistoryStore)
        RulesStore.swift                 # Rule proposals, voting, CRUD via Supabase
        TaxiSquadStore.swift             # Taxi squad player loading, steal requests
        NflStateStore.swift              # NFL state (current week, season)
      Models/
        League.swift                     # League struct (Codable) + LeagueConfig
        Roster.swift                     # Roster struct (Codable)
        Player.swift                     # Player struct (Codable)
        SleeperUser.swift                # Sleeper User struct (Codable)
        Matchup.swift                    # Matchup struct (Codable)
        Draft.swift                      # Draft + DraftPick structs (Codable)
        NflState.swift                   # NFL state struct (Codable)
        PlayoffBracket.swift             # PlayoffBracketMatch struct (Codable)
        StandingsTeam.swift              # Computed standings view model
        MatchupHistory.swift             # MatchupHistoryRecord struct
        DraftHistory.swift               # DraftHistoryRecord struct
        WorldCup.swift                   # WorldCupDivision, WorldCupTeamRecord structs
        RuleProposal.swift               # RuleProposal struct
        TaxiSquadPlayer.swift            # TaxiSquadPlayer struct
        Profile.swift                    # Supabase profile + WhitelistedUser
      Theme/
        XomperTheme.swift                # Color palette, typography, spacing constants
        XomperColors.swift               # Color asset references (Midnight Emerald)
      Extensions/
        Double+Formatting.swift          # Points formatting (2 decimal places)
        URL+Sleeper.swift                # Sleeper CDN avatar/image URL builders

    Features/
      Auth/
        AuthGateView.swift               # Loading -> Login or Content switch
        LoginView.swift                  # Google, Apple, Email sign-in buttons
        LinkSleeperView.swift            # Sleeper account linking flow
      Home/
        HomeView.swift                   # Landing page, league quick-access
        SearchView.swift                 # User/league search
      League/
        LeagueDashboardView.swift        # Main league view with tab picker
        StandingsView.swift              # League-wide + divisional standings tables
        MatchupsView.swift               # Season/week matchup history with detail drill-in
        MatchupDetailView.swift          # Full matchup breakdown (starters, points)
        PlayoffBracketView.swift         # Winners + losers bracket visualization
        WorldCupView.swift               # Divisional tournament standings + season breakdown
        RulesView.swift                  # Static rules + proposal voting
        RuleProposalFormView.swift       # New proposal creation
      Team/
        TeamView.swift                   # Roster: starters, bench, taxi, IR
        PlayerDetailView.swift           # Player info modal/sheet
      DraftHistory/
        DraftHistoryView.swift           # Multi-season draft picks, grouped by round
      MatchupHistory/
        MatchupHistoryView.swift         # H2H matchup history across seasons
      TaxiSquad/
        TaxiSquadView.swift              # All taxi players, steal button
        TaxiStealConfirmView.swift       # Steal confirmation + pick cost display
      Profile/
        ProfileView.swift                # User profile (Sleeper stats, avatar)
        MyProfileView.swift              # Authenticated user's profile + settings
      Shared/
        LoadingView.swift                # Reusable spinner/skeleton
        AvatarView.swift                 # AsyncImage with Sleeper CDN fallback
        EmptyStateView.swift             # No data placeholder
        ErrorView.swift                  # Error state with retry
        RecordBadge.swift                # W-L record badge component
        DivisionBadge.swift              # Division name + avatar badge

    Navigation/
      AppTab.swift                       # Tab enum (Home, League, MyTeam, Profile)
      AppRouter.swift                    # NavigationSplitView wrapper per tab

    Resources/
      Assets.xcassets/                   # App icon, color sets, images
      Info.plist                         # URL scheme (xomper), orientation config
```

## Angular -> Swift Service Mapping

| Angular Service | Swift Store | Key Differences |
|----------------|-------------|-----------------|
| `SupabaseService` | `AuthStore` | Copy XomFit pattern. `@Observable`, `@MainActor`. `authStateChanges` loop. |
| `LeagueService` | `LeagueStore` | `expand()` chain -> recursive `async` function. `forkJoin` -> `async let`. |
| `PlayerService` | `PlayerStore` | `shareReplay(1)` -> file cache + ETag. ~50 lines per research doc. |
| `UserService` | `UserStore` | Direct port, minimal logic. |
| `TeamService` | `TeamStore` | Direct port, state holder only. |
| `StandingsService` | `StandingsStore` | Direct port, sort + rank assignment. |
| `LeagueHistoryService` | `HistoryStore` + `WorldCupStore` | Split: history data fetching vs World Cup computation. World Cup is ~140 lines of pure logic, worth isolating. |
| `DraftService` | Part of `HistoryStore` | Draft loading folds into history store since it's only used there. |
| `RulesService` | `RulesStore` | Direct port. Supabase queries via Swift SDK. |
| `TaxiSquadService` | `TaxiSquadStore` | Direct port. |
| `EmailService` | `XomperAPIClient` | HTTP calls to API Gateway. Not a store, just a client. |
| `ToastService` | N/A | Use SwiftUI `.alert()` / `.toast()` modifier or custom overlay. |

## Angular -> Swift Model Mapping

| Angular Interface/Model | Swift Struct | Notes |
|------------------------|-------------|-------|
| `League` + `LeagueModel` | `League: Codable, Identifiable` | Flatten to single struct. Computed properties replace getter methods. `divisions` parsed from `metadata`. |
| `Roster` + `RosterModel` | `Roster: Codable, Identifiable` | `id = roster_id`. Computed `fpts` combines `fpts + fpts_decimal/100`. |
| `Player` + `PlayerModel` | `Player: Codable, Identifiable` | `id = player_id`. `CodingKeys` for snake_case mapping. |
| `User` + `UserModel` | `SleeperUser: Codable, Identifiable` | `id = user_id`. Named `SleeperUser` to avoid collision with Supabase `User`. |
| `Matchup` | `Matchup: Codable` | Direct port. |
| `Draft` + `DraftModel` + `DraftPick` | `Draft: Codable` + `DraftPick: Codable` | Flatten. Picks stored inline. |
| `NflState` + `NflStateModel` | `NflState: Codable` | Direct port. |
| `PlayoffBracketMatch` | `PlayoffBracketMatch: Codable, Identifiable` | Single-letter keys (`r`, `m`, `t1`, `t2`, `w`, `l`). Custom `CodingKeys`. |
| `StandingsTeam` + `StandingsTeamModel` | `StandingsTeam` (plain struct) | Not Codable -- computed from Roster + User + League at runtime. |
| `MatchupHistoryRecord` | `MatchupHistoryRecord: Codable, Identifiable` | Direct port from `LeagueHistoryService`. |
| `DraftHistoryRecord` | `DraftHistoryRecord: Codable, Identifiable` | Direct port. |
| `WorldCupDivision` + `WorldCupTeamRecord` | `WorldCupDivision` + `WorldCupTeamRecord` | Not Codable -- computed at runtime. |
| `RuleProposal` | `RuleProposal: Codable, Identifiable` | Direct port. |
| `TaxiSquadPlayer` | `TaxiSquadPlayer: Identifiable` | Composed from `Player` + ownership metadata. |
| `Profile` + `WhitelistedUser` | `XomperProfile: Codable` + `WhitelistedUser: Codable` | Supabase table models. |
| `LeagueConfig` | `LeagueConfig` | Static config struct. |

## Implementation Steps

### Phase 0: Project Scaffold (1 day)

- [ ] Create new `xomper-ios` git repo with `.gitignore` (Xcode/Swift), `LICENSE`, initial commit
- [ ] Create Xcode project: Universal app, iOS 17+ deployment target, Swift 6, SwiftUI lifecycle
- [ ] Add `supabase-swift` SPM dependency (version 2.41.1+)
- [ ] Set up folder structure per the project structure above (empty files with `// TODO` placeholders)
- [ ] Create `Config.swift.template` with placeholder values and `Config.swift` in `.gitignore`
- [ ] Create actual `Config.swift` locally with real Supabase URL, anon key, OAuth callback URL (`xomper://login-callback`), API Gateway URL
- [ ] Register `xomper` URL scheme in `Info.plist`
- [ ] Set orientation: portrait-only on iPhone, all orientations on iPad
- [ ] Set up `.claude/CLAUDE.md` with project-specific rules for the new repo
- [ ] Verify project builds and runs on simulator

### Phase 1: Theme + Design System (0.5 days)

- [ ] Define `XomperColors` color set in `Assets.xcassets` (extracted from web app `_variables.scss`):
  - **Backgrounds**: `deepNavy` (#050a08), `darkNavy` (#0c1612), `bgDark` (#030706), `bgCard` (#0a1610), `bgCardHover` (#14271e), `bgInput` (#14271e)
  - **Accents**: `championGold` (#00ffab — neon emerald, primary accent), `steelBlue` (#00e89d — secondary emerald), `accentRed` (#ff4757 — vibrant red)
  - **Text**: `textPrimary` (#f0f5f0 — near white, green tint), `textSecondary` (#8fada0 — sage), `textMuted` (#4a6b5c)
  - **Semantic**: `successGreen` (#00e676), `errorRed` (#ff5252), `surfaceLight` (#1a2e26 — borders/dividers)
  - **Legacy**: `legacyRed` (#bf0a0a), `legacyBlue` (#1b8edc)
  - **Gradients**: `bgGradient` (180deg #050a08 -> #0c1612 -> #050a08), `cardGradient` (135deg rgba(12,22,18,0.97) -> rgba(5,10,8,0.97)), `goldAccent` (90deg #00ffab -> #00e89d), `redAccent` (90deg #ff4757 -> #ff6b7a)
  - **Shadows**: sm (0 2px 4px 0.3), md (0 4px 8px 0.4), lg (0 8px 16px 0.5), xl (0 12px 24px 0.6)
- [ ] Port NFL team color pairs from `src/app/constants/team-colors.ts` (32 teams, primary + secondary hex pairs)
- [ ] Create `XomperTheme.swift` with font sizes, spacing scale, corner radii, shadow definitions
- [ ] Build `LoadingView`, `EmptyStateView`, `ErrorView`, `AvatarView` shared components
- [ ] Verify dark theme renders correctly on both iPhone and iPad simulator

### Phase 2: Auth + Core Infrastructure (1-2 days)

- [ ] Implement `SupabaseManager.swift` -- copy XomFit's `SupabaseClient.swift` pattern, replace config references
- [ ] Implement `AuthStore.swift` -- copy XomFit's `AuthService.swift`, adapt for Xomper (add whitelist check, Sleeper profile loading)
- [ ] Implement `LoginView.swift` -- Google OAuth button, email/password form (no Apple Sign-In for v1 — TestFlight distribution only; Apple Sign-In required if publishing to App Store later)
- [ ] Add `onOpenURL` handler in `XomperApp.swift` for OAuth callback
- [ ] Implement `AuthGateView.swift` -- show loading spinner during `initialSession`, then route to Login or Content
- [ ] Implement whitelist check: query `whitelisted_users` table on auth, gate access to league features
- [ ] Implement `LinkSleeperView.swift` -- search Sleeper user by username, link `sleeper_user_id` to Supabase profile
- [ ] Add Supabase dashboard config: add `xomper://login-callback` to redirect URLs
- [ ] Test full auth flow on physical device (simulator is flaky for OAuth)

### Phase 3: Networking + Data Layer (1-2 days)

- [ ] Implement `SleeperAPIClient` protocol:
  ```swift
  protocol SleeperAPIClientProtocol {
      func fetchLeague(_ id: String) async throws -> League
      func fetchLeagueUsers(_ leagueId: String) async throws -> [SleeperUser]
      func fetchLeagueRosters(_ leagueId: String) async throws -> [Roster]
      func fetchLeagueMatchups(_ leagueId: String, week: Int) async throws -> [Matchup]
      func fetchNflState() async throws -> NflState
      func fetchDrafts(_ leagueId: String) async throws -> [Draft]
      func fetchDraftPicks(_ draftId: String) async throws -> [DraftPick]
      func fetchUserLeagues(_ userId: String, season: String) async throws -> [League]
      func fetchUser(_ userId: String) async throws -> SleeperUser
      func fetchAllPlayers() async throws -> [String: Player]
      func fetchWinnersBracket(_ leagueId: String) async throws -> [PlayoffBracketMatch]
      func fetchLosersBracket(_ leagueId: String) async throws -> [PlayoffBracketMatch]
      func fetchTradedPicks(_ leagueId: String) async throws -> [TradedPick]
      func fetchTransactions(_ leagueId: String, week: Int) async throws -> [Transaction]
  }
  ```
- [ ] Implement `SleeperAPIClient` concrete class with URLSession + async/await, base URL `https://api.sleeper.app/v1`
- [ ] Implement all Swift model structs (`League`, `Roster`, `Player`, `SleeperUser`, `Matchup`, `Draft`, `DraftPick`, `NflState`, `PlayoffBracketMatch`) with `Codable` conformance and `CodingKeys` for snake_case
- [ ] Implement `PlayerStore` with file-based cache + ETag validation per research doc (~50 lines core logic)
- [ ] Implement `XomperAPIClient` for API Gateway calls (rule proposal emails, taxi steal emails)
- [ ] Write unit tests for model decoding using sample Sleeper API JSON responses
- [ ] Write unit tests for `PlayerStore` cache logic (mock FileManager + URLSession)

### Phase 4: League Dashboard -- Standings (2-3 days)

- [ ] Implement `LeagueStore` -- `fetchLeague()`, `fetchLeagueContext()` (users + rosters in parallel via `async let`), league chain traversal (recursive async), state management for `myLeague` and `currentLeague`
- [ ] Implement `NflStateStore` -- fetch + cache NFL state
- [ ] Implement `UserStore` -- `myUser`, `currentUser` state, avatar URL builder
- [ ] Implement `TeamStore` -- `myTeam`, `currentTeam` state
- [ ] Implement `StandingsStore` -- port `buildStandings()` and `buildDivisionStandings()` from Angular. Build `StandingsTeam` from Roster + User + League metadata (division names, avatars, streaks)
- [ ] Implement `ContentView.swift` -- `TabView` with 4 tabs: Home, League, My Team, Profile
- [ ] Implement `AppRouter.swift` -- `NavigationSplitView` wrapper per tab with `NavigationPath` for programmatic navigation
- [ ] Implement `LeagueDashboardView.swift` -- tab picker (Standings, Matchups, Playoffs, World Cup, Rules), lazy-load tab content
- [ ] Implement `StandingsView.swift` -- league-wide table + divisional view toggle. Show rank, avatar, team name, record, points for, points against, streak. Tap row to navigate to team
- [ ] Implement `HomeView.swift` -- show whitelisted league card, quick-access to league dashboard
- [ ] Test on iPhone and iPad -- verify `NavigationSplitView` collapses correctly on iPhone

### Phase 5: Team/Roster View (1-2 days)

- [ ] Implement `TeamView.swift` -- display starters (ordered by roster position slots), bench, taxi squad, IR. Show player name, position, team, points. Tap player for detail sheet
- [ ] Implement `PlayerDetailView.swift` -- `.sheet` presentation with player info: name, position, team, college, age, years exp, injury status, height/weight. Sleeper CDN player image
- [ ] Implement `AvatarView.swift` -- `AsyncImage` with Sleeper CDN URL builder, fallback to SF Symbol
- [ ] Wire up navigation: standings row tap -> team view, team view player tap -> player detail
- [ ] Support both "my team" and "selected team" modes (same view, different data source)

### Phase 6: Matchup History (2-3 days)

- [ ] Implement `HistoryStore` -- `getMatchupHistoryFromChain()`: for each league in chain, load context (users + rosters) then fetch all 17 weeks of matchups. Build `MatchupHistoryRecord` array. Port the `convertMatchupResults()` logic directly from Angular
- [ ] Implement `MatchupsView.swift` -- season picker, week accordion/list, matchup cards showing team A vs team B with scores and W/L indicator
- [ ] Implement `MatchupDetailView.swift` -- tap a matchup card to drill into full breakdown: starters with individual points, bench players, total score comparison
- [ ] Implement `MatchupHistoryView.swift` -- standalone H2H history page (all matchups between two specific teams, accessible from profile)
- [ ] Port league chain caching -- cache the chain once, reuse for matchup history, draft history, and World Cup

### Phase 7: Playoff Brackets (1 day)

- [ ] Implement bracket fetching in `LeagueStore` -- `fetchWinnersBracket()`, `fetchLosersBracket()`
- [ ] Implement `PlayoffBracketView.swift` -- horizontal scroll bracket visualization. Group matches by round. Show team names, avatars, W/L/TBD states. Support both winners and losers brackets
- [ ] Resolve team names from `StandingsTeam` array using `rosterId`
- [ ] Handle `t1_from` / `t2_from` references (winner/loser of previous match)
- [ ] Test on iPad -- wider screen should show more of the bracket without scrolling

### Phase 8: World Cup (2-3 days) -- MOST COMPLEX FEATURE

This is the highest-complexity feature. The Angular implementation is ~140 lines of pure computation in `getWorldCupStandings()`. Port it precisely.

- [ ] Implement `WorldCupStore` as a separate `@Observable` class (not merged into HistoryStore -- the computation is complex enough to warrant isolation)
- [ ] Port `getWorldCupStandings()` logic step-by-step:
  1. Extract division names from current league's `metadata` (`division_1`, `division_2`, etc.)
  2. Filter matchups: regular season only (`!is_playoff`), intra-divisional only (`team_a_division == team_b_division`), must have scores
  3. Build per-user records keyed by `user_id` (stable across seasons): aggregate wins, losses, ties, points for, points against
  4. Track per-season breakdown within each user record
  5. Group users by division
  6. Sort within division: wins desc, then points for desc as tiebreaker
  7. Mark top 2 per division as `qualified`
  8. Sort divisions by number
- [ ] Implement `WorldCupView.swift`:
  - Division sections with division name headers
  - Table per division: rank, team name, record (W-L-T), PF, PA, per-season breakdown columns
  - Qualified badge for top 2 teams
  - Adaptive grid: use `LazyVGrid` with `adaptive(minimum:)` for season columns -- show more on iPad
  - Horizontal scroll on iPhone if too many season columns
- [ ] Write unit tests for World Cup computation with mock matchup data -- verify:
  - Only intra-divisional regular season matchups count
  - User aggregation works across seasons (same user_id, different roster_ids)
  - Tiebreaker (points for) works correctly
  - Qualification marking is correct (top 2 per division)
  - Division names resolve from metadata

### Phase 9: Draft History (1-2 days)

- [ ] Implement draft history loading in `HistoryStore` -- `getDraftHistoryFromChain()`: load drafts + picks for each league in chain, resolve user/roster context per season, build `DraftHistoryRecord` array. Port chain-based resolution directly from Angular
- [ ] Implement `DraftHistoryView.swift` -- season picker, round grouping, draft board display. Show pick number, player name, position, team, picked by (username + team name), keeper badge
- [ ] Support filtering by season and by user ("My Picks" filter)
- [ ] Wire up player tap -> `PlayerDetailView`

### Phase 10: Rule Proposals + Voting (1-2 days)

- [ ] Implement `RulesStore` -- port all Supabase queries from Angular `RulesService`:
  - `getProposals()` with joined profiles, vote counts, user's vote
  - `createProposal()`, `deleteProposal()`, `castVote()`, `updateProposalStatus()`
  - `getVoterNames()` for approval/rejection display
  - Approval threshold: `ceil(total_rosters * 2 / 3)`, denial threshold: `total_rosters - approvalThreshold + 1`
- [ ] Implement `RulesView.swift`:
  - Static league rules (hardcoded, same as Angular `LEAGUE_RULES` array)
  - Scoring settings table (from league `scoring_settings`)
  - Roster position breakdown (from league `roster_positions`)
  - Proposal list with filter (all/open/approved/rejected)
  - Vote buttons (yes/no) with auto-status-update on threshold reached
  - Expandable voter name list
- [ ] Implement `RuleProposalFormView.swift` -- title + description form, submit action
- [ ] Wire up email notifications via `XomperAPIClient` on proposal creation and status change
- [ ] Test voting flow end-to-end

### Phase 11: Taxi Squad (1 day)

- [ ] Implement `TaxiSquadStore` -- port `loadTaxiSquadPlayers()`: iterate all rosters' taxi arrays, resolve player data + draft pick metadata, build `TaxiSquadPlayer` models. Port steal request CRUD via Supabase
- [ ] Implement `TaxiSquadView.swift` -- list all taxi squad players across league, grouped by owner. Show player info, draft round, pick cost table
- [ ] Implement `TaxiStealConfirmView.swift` -- confirmation sheet with pick compensation rules, steal button, email notification trigger
- [ ] Gate steal functionality behind whitelist check (only league members can steal)

### Phase 12: User Profile + Search (1 day)

- [ ] Implement `ProfileView.swift` -- display Sleeper user info: avatar, username, display name, team name. Show user's leagues (via Sleeper API). Navigate to league/team from profile
- [ ] Implement `MyProfileView.swift` -- authenticated user's profile with sign-out, Sleeper account link status, display name editing
- [ ] Implement `SearchView.swift` -- search Sleeper users by username, search leagues by ID. Navigate to profile or league on selection
- [ ] Wire up profile navigation from standings rows and matchup cards

### Phase 13: Polish + Testing (2-3 days)

- [ ] Pull-to-refresh on all data views (standings, matchups, brackets, World Cup, taxi squad)
- [ ] Loading states: skeleton views or spinners during async loads
- [ ] Error handling: retry buttons on all network failures, user-friendly error messages
- [ ] Haptic feedback on vote buttons, steal confirmation, tab switches
- [ ] Transitions: matched geometry for navigation, smooth sheet presentations
- [ ] Test on iPhone SE (smallest), iPhone 16 Pro Max (largest), iPad (landscape + portrait)
- [ ] Test full auth flow on physical device
- [ ] Test offline behavior: player cache serves from disk, graceful errors for network-dependent features
- [ ] Memory profiling with Instruments: verify player dictionary ~20MB, no leaks
- [ ] Accessibility: Dynamic Type support, VoiceOver labels on key elements

### Phase 14: App Store Prep (1 day)

- [ ] App icon design (Midnight Emerald theme, Xomper branding)
- [ ] Launch screen (solid dark background, app logo)
- [ ] App Store screenshots (iPhone 6.7", iPad)
- [ ] TestFlight setup: internal testing group with league members
- [ ] Privacy policy URL (required for App Store)
- [ ] App Store Connect listing: description, keywords, category (Sports)

## Out of Scope

- Push notifications (v2 -- would replace Lambda email notifications)
- Home screen widgets (v2 -- standings/matchups widget)
- Mac Catalyst (web app covers desktop; "Designed for iPad" runs on Mac for free)
- Offline-first / SwiftData persistence (file cache for players is sufficient)
- Background app refresh (ETag validation on foreground launch is sufficient)
- Live Activities / Dynamic Island (v2 -- show matchup scores during games)
- iPad-optimized multi-column layouts (v2 -- basic adaptive layout is sufficient for v1)
- Drag-and-drop roster management
- Custom animations beyond standard SwiftUI transitions

## Risks / Tradeoffs

- **World Cup logic complexity**: The computation is ~140 lines of stateful logic with cross-season user identity resolution. Mitigation: port line-by-line from Angular, write unit tests with known data before building the view.
- **League chain traversal**: Recursive async calls to Sleeper API. Mitigation: cache the chain aggressively, same as Angular's `leagueChainCache`.
- **Player data size (13MB)**: First launch downloads 13MB (2MB gzipped). Mitigation: file cache + ETag means subsequent launches are instant. Research doc confirms this is the right approach.
- **Supabase Swift SDK stability**: SDK is actively maintained and used in XomFit without issues. Low risk.
- **Sleeper API rate limiting**: No documented rate limits, but chain traversal can trigger many sequential requests. Mitigation: parallelize with `TaskGroup` where possible, cache responses.
- **App Store Apple Sign-In requirement**: Apple requires Apple Sign-In if offering third-party social login. Skipped for v1 (TestFlight only). Must add before App Store publication.
- **12-person league only**: Hardcoded `whitelistedLeagueId` and league rules. Not designed for multi-league or public use. This is intentional.
- **Single developer**: Estimated 3-4 weeks total. Phases are ordered so each produces a testable app increment.

## Resolved Questions

- [x] **Apple Sign-In**: Skipped for v1. Distributing via TestFlight only. Apple Sign-In is required for App Store publication if offering third-party social login (Google) — add in v2 if publishing.
- [x] **Whitelist enforcement**: Yes, same as web app. Gate league features behind `whitelisted_users` check.
- [x] **Sleeper account linking**: Required, same as web app. Needed for "my league" features.
- [x] **Midnight Emerald colors**: Extracted from `src/styles/_variables.scss`. Full palette documented in Phase 1.
- [x] **Static league rules**: Hardcoded for v1, same as web app. (Hardcoded = baked into app code, requires app update to change. Supabase-backed = stored in database, changeable without release.)
- [x] **World Cup cycle**: Current cycle only, same as web app.

## Skills / Agents to Use

- **Planner Agent**: This document. Use to generate per-phase sub-plans if any phase needs further breakdown.
- **Execute Agent**: Run phases sequentially. Each phase produces a buildable, testable increment. Start with `/execute xomper-ios` after flipping status to Ready.
- **Research Agent**: Invoke if any open question above blocks implementation (especially Apple Sign-In configuration and theme color extraction).
- **Fix Agent**: Use for bug fixes discovered during testing phases (13-14).
