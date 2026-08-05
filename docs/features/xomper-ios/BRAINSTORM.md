# Brainstorm: xomper-ios -- Native iOS App Architecture

**Date**: 2026-04-02
**Status**: Complete
**Author**: Brainstorm Agent

---

## Phase 1 -- Explore

### App Architecture Pattern
- **Vanilla SwiftUI + @Observable**: Simplest path. Use Swift 5.9 `@Observable` macro (iOS 17+). ViewModels are plain classes. No framework overhead.
- **MVVM with protocols**: Classic iOS pattern. Protocol-based ViewModels for testability. Well-understood, tons of examples.
- **TCA (The Composable Architecture)**: Point-Free's opinionated framework. Great for complex state, but steep learning curve and heavy boilerplate for a solo dev.
- **MV (Model-View) pattern**: Skip ViewModels entirely. Put logic in models and use SwiftUI's built-in state management. Works for simpler apps but Xomper has real complexity.
- **Redux-like with custom store**: Roll your own unidirectional data flow. Overkill here.
- **Hybrid**: @Observable ViewModels for screens, shared services as singletons via Environment. Maps closely to how the Angular app already works.

### Navigation
- **NavigationStack with path-based routing**: Modern SwiftUI (iOS 16+). Type-safe navigation paths. Supports deep linking naturally.
- **NavigationStack + Router enum**: Single enum defines all routes. Centralized, easy to reason about. Pairs well with tab-based layout.
- **TabView + per-tab NavigationStack**: Each tab owns its own nav stack. Standard iOS pattern for apps with distinct sections.
- **Coordinator pattern**: UIKit-era pattern ported to SwiftUI. Adds complexity with limited benefit in pure SwiftUI.
- **Simple NavigationLink**: Works but doesn't scale. Hard to do programmatic navigation.

### Data/Networking Layer
- **URLSession + async/await**: Native, zero dependencies. Codable handles JSON. Straightforward for REST APIs.
- **Alamofire**: Popular but unnecessary for this scope. URLSession + async/await covers it.
- **Repository pattern**: Abstract data sources behind protocols. SleeperRepository, SupabaseRepository. Easy to mock for tests.
- **Single API client with endpoint enum**: One `SleeperAPI` enum defining all endpoints. Clean, type-safe.
- **Actor-based networking**: Use Swift actors for thread-safe API clients. Natural fit for caching.
- **Offline-first with SwiftData**: Persist to local DB, sync when online. Nice but the web app has no offline support -- probably overkill for v1.
- **In-memory caching via actor**: Mirror the web app's Map-based caching but thread-safe. Cache Sleeper responses, invalidate on pull-to-refresh.

### State Management / Shared State
- **@Observable singletons in Environment**: Mirror Angular's service-based approach. `LeagueStore`, `UserStore`, `PlayerStore` as `@Observable` classes injected via `.environment()`.
- **SwiftUI Environment + EnvironmentObject**: Standard approach but @EnvironmentObject is being superseded by @Observable.
- **Global app state object**: Single `AppState` @Observable that holds everything. Simple but becomes a god object.
- **Per-feature state with shared dependencies**: Each feature has its own ViewModel, shared services injected. Closest to Angular's DI pattern.
- **SwiftData for persistence**: Could persist league/player data locally. Good for offline but adds complexity.

### Supabase Integration
- **Official supabase-swift SDK**: Maintained by Supabase team. Handles auth (including Google OAuth), realtime, database queries. Auth has `ASWebAuthenticationSession` support for OAuth flows.
- **Custom REST client**: More control but you'd be reimplementing auth token management, refresh, etc. Not worth it.
- **Hybrid**: Use official SDK for auth, custom client for specific queries where SDK is clunky.

### Feature Scope
- **Full port, all 15 pages**: Complete feature parity. Risky -- could take months.
- **Core + World Cup for v1**: Auth, league dashboard, standings, team/roster, World Cup. Skip draft history, matchup history, taxi squad, rule proposals for v2.
- **Full port but phased UI**: Build all data/networking first, ship screens incrementally. Data layer is the hard part anyway.
- **MVP: Read-only first**: Skip all write operations (rule proposals, taxi steals, Sleeper linking) for v1. Focus on dashboards and data display.

### Other Considerations
- **Player data is 10MB+**: The Sleeper `/players/nfl` endpoint returns a massive JSON blob. Need to cache aggressively. Consider background download + local persistence.
- **Dynasty chain traversal**: Recursive async calls. Swift's async/await with `AsyncStream` or simple recursion fits naturally.
- **Dark theme**: SwiftUI's native dark mode + custom color assets. Can recreate "Midnight Emerald" easily.
- **Target iOS version**: iOS 17+ gives @Observable macro. iOS 16+ would require @ObservableObject everywhere. Given this is a personal project for a 12-person fantasy league, iOS 17+ is fine.
- **Push notifications**: Could replace Lambda email notifications for mobile. Not v1 but worth designing for.
- **Widget**: Home screen widget showing standings/matchups. Great iOS-native feature for v2.
- **Minimum viable testing**: Protocol-based services enable unit testing. Don't need UI tests for v1.

---

## Phase 2 -- Converge

### Option A: Lean SwiftUI + @Observable Services

**What**: Vanilla SwiftUI with @Observable service classes, mirroring the Angular service architecture almost 1:1.

**How it works**: Each Angular service maps to an `@Observable` Swift class (`LeagueStore`, `PlayerStore`, `HistoryStore`, etc.). These are injected via SwiftUI's `Environment`. ViewModels are optional -- simple screens read directly from stores, complex screens get a dedicated ViewModel. Navigation uses `TabView` with per-tab `NavigationStack` and a shared `Router` enum. Networking is plain `URLSession` + `async/await` with an `actor`-based `SleeperAPIClient`. Supabase uses the official Swift SDK.

**Pros**:
- Closest mental model to existing Angular architecture (services hold state, views consume it)
- Minimal framework overhead -- just Swift and SwiftUI
- @Observable is the future direction of SwiftUI state management
- Easy to onboard to -- any Swift dev can read it
- Fastest path to v1 since architecture maps directly from existing code

**Cons / Risks**:
- @Observable requires iOS 17+ (acceptable for personal project)
- No enforced unidirectional data flow -- stores can be mutated from anywhere
- Testing requires discipline (protocol abstractions for mockability)
- Risk of "god store" if boundaries aren't clean

**Best if**: You want the fastest path to a working app with the least architectural overhead. The Angular codebase is already well-structured -- this approach preserves that structure.

---

### Option B: MVVM with Repository Pattern

**What**: Formal MVVM with protocol-based repositories abstracting all data sources, ViewModels per screen, and dependency injection container.

**How it works**: Define `SleeperRepository` and `SupabaseRepository` protocols with concrete implementations. Each screen gets a `@Observable` ViewModel that depends on repositories (injected, not constructed). A lightweight DI container (or manual injection via Environment) wires everything together. Navigation via `NavigationStack` with typed paths. State flows unidirectionally: Repository -> ViewModel -> View.

**Pros**:
- Clean separation of concerns with enforced boundaries
- Highly testable -- mock repositories, test ViewModels in isolation
- Familiar pattern for iOS community; easy to explain in interviews/portfolio
- Repository layer makes it easy to add offline support later (swap in SwiftData-backed implementation)

**Cons / Risks**:
- More boilerplate than Option A (protocol + implementation + ViewModel per screen = 3x files)
- 15 screens x 3 files each = ~45 files just for the feature layer, before shared code
- Might over-engineer for a 12-person league app
- ViewModel-per-screen can feel forced when some screens are just "show a list from the API"

**Best if**: You want a portfolio-quality architecture that demonstrates best practices, or you plan to eventually open-source or scale the app beyond your league.

---

### Option C: TCA (The Composable Architecture)

**What**: Use Point-Free's TCA framework for fully composable, testable state management with unidirectional data flow.

**How it works**: Each feature is a `Reducer` with `State`, `Action`, and `Effect`. Features compose together. Side effects (API calls) are modeled as `Effect` values. Navigation is state-driven. Dependencies are managed via TCA's `@Dependency` system.

**Pros**:
- Strongest testability story -- every state transition and effect is testable
- Forced unidirectional data flow prevents state bugs
- Great for complex state interactions (World Cup aggregation, chain traversal)
- Built-in dependency injection system

**Cons / Risks**:
- Steep learning curve even for experienced Swift devs
- Significant boilerplate: State struct + Action enum + Reducer + View for every feature
- Framework lock-in -- hard to migrate away from
- Overkill for a personal project with a single developer
- Slower iteration speed during development
- Framework updates can require significant migration effort

**Best if**: You're already comfortable with TCA and want to use this project to deepen that expertise, or the app's state complexity is causing real bugs that simpler patterns can't prevent.

---

## Phase 3 -- Recommendation

**Go with Option A: Lean SwiftUI + @Observable Services.**

Here's why:

1. **Direct mapping from Angular**: The existing codebase has 13 services with clear responsibilities. These map 1:1 to @Observable store classes. You already understand the data flow -- you designed it.

2. **Solo dev economics**: Option B adds ~50% more files for testability you might not exercise on a personal project. Option C adds 2x+ boilerplate for guarantees you don't need when you're the only developer.

3. **Speed to v1**: World Cup is a must-have. The fastest way to get there is to port the existing `LeagueHistoryService.getWorldCupStandings()` logic directly into a Swift equivalent without adding architectural ceremony.

4. **Escape hatches exist**: If a specific screen gets complex enough to warrant a ViewModel, add one. If testing becomes important, add protocols to the stores. Option A doesn't prevent you from adopting Option B patterns where they're needed -- it just doesn't force them everywhere.

5. **iOS 17+ is fine**: Your league has 12 people. Anyone with a 2-year-old iPhone runs iOS 17. This unlocks @Observable which is dramatically simpler than @ObservableObject.

**The one thing I'd borrow from Option B**: Use the repository/protocol pattern for the networking layer only. A `SleeperAPIClient` protocol and a `SupabaseClient` wrapper protocol make it easy to write previews with mock data and test business logic without hitting real APIs. The cost is minimal (2 protocols) and the benefit is immediate.

### Recommended Architecture Summary

```
xomper-ios/
  App/
    XomperApp.swift              # Entry point, environment setup
    ContentView.swift            # TabView + auth gate
  Core/
    Networking/
      SleeperAPIClient.swift     # Protocol + URLSession implementation
      SupabaseManager.swift      # Official SDK wrapper
    Stores/                      # @Observable service classes
      AuthStore.swift            # Supabase auth + profile
      LeagueStore.swift          # League state, chain, context
      PlayerStore.swift          # Player data + cache
      HistoryStore.swift         # Draft/matchup/standings history
      StandingsStore.swift       # Standings calculation
    Models/                      # Swift structs (Codable)
      League.swift, Roster.swift, Player.swift, etc.
    Theme/
      XomperTheme.swift          # Midnight Emerald color palette
  Features/
    Home/                        # Home + search
    League/                      # League dashboard, standings, matchups
    Team/                        # Roster management
    WorldCup/                    # Divisional tournament
    DraftHistory/                # Multi-season draft viewer
    MatchupHistory/              # H2H history
    Rules/                       # Proposals + voting
    TaxiSquad/                   # Prospect management
    Profile/                     # User profile, Sleeper linking
  Navigation/
    AppRouter.swift              # Route enum + NavigationStack setup
    TabRouter.swift              # Tab definitions
```

**Key decisions baked in**:
- iOS 17+ minimum (enables @Observable)
- Supabase official Swift SDK for auth and database
- URLSession + async/await for Sleeper API (no third-party HTTP libs)
- Actor-based caching for expensive calls (player data, league chains)
- TabView with 4-5 tabs, NavigationStack per tab
- Full feature port for v1 (World Cup required, everything else is already built in Angular -- just port it)

**What depends on further investigation**:
- Supabase Swift SDK maturity for Google OAuth on iOS (needs `/research` pass)
- Player data caching strategy (10MB+ JSON -- in-memory actor vs local file vs SwiftData)
- Whether to target iPhone-only or also iPad (affects navigation patterns)
