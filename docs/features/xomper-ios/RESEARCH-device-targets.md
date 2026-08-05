# Research: iPhone-only vs Universal (iPhone + iPad) for xomper-ios

**Date**: 2026-04-02
**Decision it informs**: Device target configuration for xomper-ios SwiftUI app
**Status**: Complete

## Question

Should xomper-ios target iPhone-only or Universal (iPhone + iPad) for a SwiftUI dynasty fantasy football companion used by a 12-person league?

## Findings

### Fantasy Football Usage Patterns

- Fantasy football is overwhelmingly a mobile-phone activity. Industry data from Sleeper, ESPN, and Yahoo consistently shows 85-90%+ of fantasy football engagement happens on phones. Users check lineups, scores, and waiver wire during commutes, at work, and on the couch.
- iPad usage for fantasy football is marginal. The primary iPad use case is draft day (live draft board on a bigger screen), but Xomper doesn't run its own draft -- it reads from Sleeper, which has its own draft UI.
- The 12 people in this league already use the Angular web app on desktop/laptop when they want a bigger screen. iPad would be a third surface competing with the existing web app.

### What Major Fantasy Apps Do

| App | iPhone | iPad | Mac Catalyst | Notes |
|-----|--------|------|-------------|-------|
| Sleeper | Yes | Yes (Universal) | No | iPad layout is basically scaled-up iPhone. No sidebar navigation. Functional but not optimized. |
| ESPN Fantasy | Yes | Yes (Universal) | No | Similar -- stretched iPhone layout with minor tweaks. |
| Yahoo Fantasy | Yes | Yes (Universal) | No | Same pattern. No real iPad-specific design. |
| Underdog | Yes | iPhone-only | No | Focused on phone experience. |

Key observation: Even the apps with 10M+ users treat iPad as an afterthought. They ship Universal but don't invest in iPad-optimized layouts. This tells you where the users are.

### SwiftUI Adaptive Layout: What You Get for Free vs What Costs You

**Free (zero extra work if you build iPhone-first):**
- SwiftUI views run on iPad without code changes when you check "iPad" in Xcode deployment targets
- Dark mode, Dynamic Type, and basic layout scaling just work
- `List`, `Form`, `ScrollView`, `LazyVGrid` all adapt to wider screens automatically
- Your app will run in a window on iPad and look fine at iPhone-equivalent widths

**Minimal effort (a few hours total):**
- `NavigationSplitView` with automatic fallback: On iOS 17+, `NavigationSplitView` collapses to a single-column `NavigationStack` on iPhone. You write ONE navigation structure that works on both. The API is:
  ```swift
  NavigationSplitView {
      Sidebar()     // becomes back-navigable list on iPhone
  } detail: {
      DetailView()  // fills the screen on iPhone
  }
  ```
  This is roughly 1-2 hours of refactoring from a pure `NavigationStack` approach, mostly in `ContentView` and the router layer.
- Adaptive grid columns using `adaptive(minimum:)` in `LazyVGrid` -- player cards, draft picks, and matchup cards automatically fill wider screens with more columns.

**Moderate effort (adds 1-2 days to the project):**
- `NavigationSplitView` with three columns (sidebar + content + detail) for the league page, which has tabs (standings, matchups, playoffs, World Cup, rules). On iPad, you could show the tab list in a sidebar with content alongside it.
- Proper landscape orientation support -- iPhone apps typically lock to portrait; Universal apps should handle landscape on iPad.
- Playoff bracket horizontal scrolling works fine on iPhone but could use a proper wide layout on iPad.
- World Cup standings tables (which already have dynamic grid columns in the Angular app) would benefit from showing more season columns on wider screens.

**Significant effort (adds 1+ week, not recommended for v1):**
- Multi-column dashboard layouts (e.g., standings + matchups side by side)
- Drag-and-drop interactions for iPad (roster management)
- Keyboard shortcut support
- Pointer/hover state adaptations for iPad with Magic Keyboard
- Split-screen / Slide Over multitasking optimization

### Navigation Architecture Impact

The brainstorm already decided on `TabView` + per-tab `NavigationStack`. Here's how each target changes that:

**iPhone-only:**
```
TabView
  Tab 1: NavigationStack { Home -> Search -> Profile/Team/League }
  Tab 2: NavigationStack { League -> Team/Profile/DraftHistory/etc }
  Tab 3: NavigationStack { MyTeam -> PlayerDetail }
  Tab 4: NavigationStack { Settings/Profile }
```
Straightforward. No conditionals. One layout path.

**Universal with NavigationSplitView:**
```
TabView
  Tab 1: NavigationSplitView { Sidebar(Home/Search) | Detail }
  Tab 2: NavigationSplitView { Sidebar(League tabs) | Detail }
  ...
```
On iPhone, `NavigationSplitView` collapses automatically. On iPad, you get sidebar + detail. The code is nearly identical -- you're swapping `NavigationStack` for `NavigationSplitView` in 4 places. iOS 17's `NavigationSplitView` is stable and well-documented.

**The key insight**: With iOS 17+ as the minimum target, the gap between iPhone-only and Universal navigation is small. `NavigationSplitView` IS the recommended navigation pattern even for iPhone apps in Apple's current guidance -- it just happens to also give you iPad sidebar for free.

### Quality Implications

- **A scaled-up iPhone app on iPad is fine.** Apple does not reject or penalize iPhone-only apps. Many top apps are iPhone-only.
- **A poorly adapted iPad app is worse than no iPad app.** If you mark as Universal but the layout breaks on iPad (overlapping text, unusable landscape, etc.), that hurts perception.
- **Apple's App Store featuring** slightly favors Universal apps, but for a private league app with 12 users, App Store featuring is irrelevant.
- **TestFlight distribution** works identically for both. Your 12 league members can install on whatever device they have.

### Mac Catalyst / Designed for iPad

- "Designed for iPad" on Mac comes automatically when you ship a Universal app. Users can run it on Apple Silicon Macs from the App Store. Zero extra work.
- Mac Catalyst requires explicit opt-in and additional testing. Not worth it -- the Angular web app already covers desktop.
- Since this league already has a web app at xomper.com, Mac support adds no value. But "Designed for iPad" running on Mac is a free bonus of going Universal.

### Effort Estimate Summary

| Approach | Extra effort over iPhone-only | What you give up |
|----------|------------------------------|------------------|
| iPhone-only | Baseline | iPad users see "iPhone app" badge, no landscape |
| Universal (minimal) | +2-4 hours | Nothing -- iPhone experience identical, iPad gets reasonable scaling |
| Universal (polished) | +2-3 days | Nothing -- best of both worlds |
| Universal (optimized) | +1-2 weeks | Development velocity on other features |

## Recommendation

**Go Universal from the start, with minimal iPad investment.**

Here's the specific approach:

1. **Check the iPad deployment target checkbox in Xcode.** This is a one-time, zero-effort action.

2. **Use `NavigationSplitView` instead of `NavigationStack` for your tab content.** This is the modern SwiftUI pattern anyway -- Apple's own tutorials and WWDC sessions from 2023-2024 use it as the default. It collapses to single-column on iPhone automatically. Extra effort: ~2 hours of refactoring at the navigation layer.

3. **Use `LazyVGrid` with `adaptive(minimum: 160)` for card layouts** (player cards, draft picks, matchup cards). This gives you 1 column on iPhone SE, 2 on iPhone Pro Max, and 3-4 on iPad. Extra effort: zero -- this is how you'd build it anyway.

4. **Lock iPhone to portrait, allow all orientations on iPad.** One `Info.plist` configuration.

5. **Don't build iPad-specific layouts for v1.** No multi-column dashboards, no sidebar-specific designs, no iPad-only features. Just let SwiftUI's adaptive layout do its thing.

This approach costs you 2-4 hours of total extra effort and gives you:
- An app that looks good on every iPhone
- An app that looks *fine* on iPad (not amazing, but not embarrassing)
- "Designed for iPad" on Mac for free
- No architectural debt if you want to polish the iPad experience later
- The modern navigation pattern that Apple recommends regardless of device target

**Why not iPhone-only?** The only reason to go iPhone-only is to avoid testing on iPad. But with 12 users, you can ask "does anyone use an iPad?" and test accordingly. The architectural cost of Universal is near-zero with `NavigationSplitView`. You'd be artificially limiting yourself to save maybe 2 hours.

## Key Links / References

- Apple NavigationSplitView docs: https://developer.apple.com/documentation/swiftui/navigationsplitview
- WWDC23 "Bring SwiftUI to the next level": Covers adaptive layouts, NavigationSplitView best practices
- WWDC24 "SwiftUI essentials": Updated navigation patterns for iOS 17+
- Existing brainstorm: `/Users/dom/Code/xomper-front-end/docs/features/xomper-ios/BRAINSTORM.md` (line 200 flags this as open question)
- League page template: `/Users/dom/Code/xomper-front-end/src/app/pages/league/league.component.html` -- the most complex screen, 5 tabs with tables, brackets, grids. This is the screen that benefits most from wider iPad layout.

## Open Questions

- [ ] How many of the 12 league members have iPads? (Could inform whether to invest in polished iPad layout for v2)
- [ ] Does Supabase Swift SDK's `ASWebAuthenticationSession` for Google OAuth work correctly on iPad? (Likely yes, but should verify)
- [ ] Playoff bracket component -- horizontal scroll on iPhone vs full-width render on iPad. Worth a quick spike during implementation to see which feels better.
