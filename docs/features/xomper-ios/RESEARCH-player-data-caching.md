# Research: Large JSON Data Caching for iOS (Sleeper Player Data)

**Date**: 2026-04-02
**Decision it informs**: PlayerStore caching strategy for xomper-ios
**Status**: Complete

## Question
What is the best strategy for caching the Sleeper API `/players/nfl` endpoint (13MB+ JSON, 11,578 players) on iOS to minimize memory pressure, enable fast app launches, and keep data reasonably fresh?

## Raw Data (Measured)

| Metric | Value |
|--------|-------|
| Raw JSON size | 13.2 MB |
| Gzipped JSON | 2.0 MB |
| Total player records | 11,578 |
| Active players | 8,776 |
| Active with fantasy_positions | 8,692 |
| Fields per player | 53 |
| Fields app actually uses | ~27 |
| Stripped JSON (used fields only) | 7.3 MB |
| Active + stripped JSON | 5.5 MB |
| Estimated Swift struct memory (full) | 17-25 MB |
| Estimated Swift JSONDecoder parse time | 12-20ms |
| API cache-control | `public, s-maxage=600, stale-while-revalidate=300` |
| ETag support | Yes -- returns 304 Not Modified |
| Cloudflare CDN | Yes (CF-Cache-Status: HIT) |

## Findings

### Option A: In-Memory Actor Cache (Mirror Web App)

Swift actor holding `[String: Player]` dictionary, populated on first access, lost on termination.

```swift
actor PlayerCache {
    private var players: [String: Player]?
    func getAll() async throws -> [String: Player] { ... }
}
```

- **Pros**: Simplest implementation. ~15ms parse time is negligible. Direct port of Angular's `shareReplay(1)` pattern.
- **Cons**: 17-25 MB resident memory for the full dictionary. Lost on every app termination -- user pays 13MB download on every cold launch. No offline support.
- **Xomware fit**: Identical to what the web app does today. Acceptable for v1 but leaves performance on the table.

### Option B: File-Based Cache + ETag Validation

Save raw JSON to `Caches/` directory. On launch, load from disk. On refresh, send `If-None-Match` with stored ETag -- if 304, skip download entirely.

```swift
actor PlayerStore {
    private let cacheFile = FileManager.cacheDirectory.appending("players.json")
    private let etagFile = FileManager.cacheDirectory.appending("players.etag")
    
    func load() async throws -> [String: Player] {
        // 1. If cache file exists, parse it immediately (~15ms)
        // 2. In background, hit API with If-None-Match
        // 3. If 304, done. If 200, save new file + etag, update in-memory dict
    }
}
```

- **Pros**: Near-instant launch after first run (disk read + parse ~15-20ms total on modern iPhones). ETag means most refreshes transfer 0 bytes. Survives app termination. Simple to implement -- just FileManager + JSONDecoder.
- **Cons**: Still loads full 17-25 MB into memory when parsed. Cache directory can be purged by OS under storage pressure (acceptable -- it's a cache, not user data).
- **Xomware fit**: Strong. Low complexity, big UX win. ETag support from the API makes this a no-brainer baseline.

### Option C: SwiftData / Core Data Persistence

Import all player records into a local database. Query on demand instead of holding everything in memory.

- **Pros**: Partial loading (only fetch players you need). Queryable (search by name, filter by position). Memory-efficient -- only loaded records consume RAM. Enables offline mode. Background import with `ModelActor`.
- **Cons**: Initial import of 11,578 records is expensive (~2-5 seconds with batch inserts). Schema migration complexity as Player fields change. SwiftData is still maturing (iOS 17.0 had bugs, 17.4+ is stable). Mapping 53 JSON fields to SwiftData model is tedious. Overkill for the actual usage pattern -- the app typically needs player lookups by ID (dictionary access), not complex queries.
- **Xomware fit**: Poor for v1. The app's primary access pattern is `players[id]` -- a dictionary lookup. A database adds latency (even SQLite) for a pattern that's O(1) in memory. Worth reconsidering only if memory becomes a real problem.

### Option D: Hybrid -- Stripped In-Memory + Full on Disk

Store full JSON on disk, but only parse/hold a stripped-down struct in memory (the 27 fields the app uses, or even fewer).

```swift
struct PlayerSummary: Codable {
    let playerId: String
    let firstName: String
    let lastName: String
    let position: String?
    let team: String?
    let searchFullName: String?
    // ~12 fields instead of 53
}
```

- **Pros**: Cuts memory to ~8-12 MB (vs 17-25 MB). Parse time stays under 20ms. Can lazy-load full player details from disk if a detail view needs all 53 fields.
- **Cons**: Two model types adds complexity. Unlikely to matter in practice -- the difference between 15 MB and 25 MB is not meaningful on devices with 4-6 GB RAM.
- **Xomware fit**: Premature optimization. The memory savings don't justify the added complexity for a personal app.

### Option E: NSCache + Disk Backing

Use `NSCache` for recently accessed players (auto-evicts under memory pressure), backed by disk file.

- **Pros**: System manages memory automatically.
- **Cons**: NSCache is per-object, not designed for a dictionary. Would need to cache individual Player objects by ID, losing the ability to do full-collection operations (search). Adds complexity without meaningful benefit over Option B.
- **Xomware fit**: Wrong tool for this job. NSCache shines for images/thumbnails, not structured data you need to search across.

### Background Refresh (BGAppRefreshTask)

iOS allows scheduling background app refresh tasks. Constraints:
- System decides when to run (not guaranteed timing)
- Limited execution time (~30 seconds)
- 13 MB download is feasible within that window on WiFi
- Must register in `Info.plist` with `BGTaskScheduler`
- Realistically updates 1-2x per day depending on user habits

**Verdict**: Nice-to-have for v2. The ETag-based approach in Option B already ensures minimal data transfer on foreground launches. Background refresh would only save the ~15ms parse time on launch, which users won't notice.

### Sleeper API Delta/Incremental Support

The API does **not** support delta updates or partial player fetches. The only endpoint is the full `/players/nfl` blob. However:
- **ETag support is confirmed** -- `If-None-Match` returns 304 with 0 bytes transferred
- **Cache-Control**: `s-maxage=600` means data is considered fresh for 10 minutes
- **Cloudflare CDN**: Responses are cached at the edge, so even full fetches are fast (~350ms from CDN)

This means the app should respect the 10-minute freshness window and use ETags for revalidation.

### Compression

| Format | Size | Notes |
|--------|------|-------|
| Raw JSON | 13.2 MB | As-is from API |
| Gzip | 2.0 MB | 85% reduction |

URLSession automatically handles `Accept-Encoding: gzip` with Sleeper's CDN (Cloudflare), so network transfer is already ~2 MB. For disk caching, storing the raw JSON (13 MB) is simpler than managing compression. The Caches directory can hold this comfortably -- iOS devices have 64-256 GB storage. Gzipping the disk cache would save 11 MB of storage at the cost of ~50ms decompression. Not worth the complexity.

## Recommendation

**Option B: File-Based Cache + ETag Validation.** This is the clear winner.

### Implementation Plan

```swift
@Observable
final class PlayerStore {
    private(set) var players: [String: Player] = [:]
    private(set) var isLoading = false
    
    private let cacheURL: URL  // Caches/players.json
    private let etagURL: URL   // Caches/players.etag
    private let apiURL = URL(string: "https://api.sleeper.app/v1/players/nfl")!
    
    func loadPlayers() async {
        // Step 1: Load from disk cache if available (~15ms)
        if let cached = loadFromDisk() {
            self.players = cached
        }
        
        // Step 2: Revalidate with API using ETag
        let storedETag = try? String(contentsOf: etagURL, encoding: .utf8)
        var request = URLRequest(url: apiURL)
        if let etag = storedETag {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { return }
        
        if httpResponse.statusCode == 304 {
            return  // Cache is fresh, nothing to do
        }
        
        if httpResponse.statusCode == 200 {
            // Parse and update
            let decoded = try JSONDecoder().decode([String: Player].self, from: data)
            self.players = decoded
            
            // Persist to disk (background)
            Task.detached(priority: .utility) {
                try? data.write(to: self.cacheURL)
                if let newETag = httpResponse.value(forHTTPHeaderField: "Etag") {
                    try? newETag.write(to: self.etagURL, atomically: true, encoding: .utf8)
                }
            }
        }
    }
}
```

### Why This Wins

1. **First launch**: Downloads 13 MB (2 MB over wire with gzip), parses in ~15ms, saves to disk.
2. **Subsequent launches**: Loads from disk in ~15ms, validates ETag in background. If 304, zero additional work. If 200, updates seamlessly.
3. **Memory**: ~20 MB for the parsed dictionary. On a 4-6 GB device, this is <0.5% of RAM. Acceptable.
4. **Complexity**: ~50 lines of code. No database, no migration, no schema management.
5. **Offline**: Works fully offline from disk cache.
6. **Freshness**: Respects the 10-minute `s-maxage` window. Users see current data.

### What NOT to do

- **Don't use SwiftData/CoreData** for this. The access pattern is `players[id]` -- a dictionary lookup. A database query is strictly slower and more complex for this pattern.
- **Don't strip fields** to save memory. 20 MB vs 12 MB doesn't matter on modern iOS devices. Keep it simple.
- **Don't implement background refresh** in v1. ETag validation on foreground launch is sufficient.
- **Don't build incremental sync**. The API doesn't support it, and ETags eliminate the pain of full fetches.

### Memory Pressure Escape Hatch (If Needed Later)

If profiling shows the 20 MB dictionary is a problem (unlikely), the upgrade path is:
1. Store gzipped JSON on disk (2 MB)
2. Parse on demand into a `[String: Player]` actor cache
3. Add `didReceiveMemoryWarning` handler to nil out the dictionary and reload from disk on next access

This is a 30-minute change. Don't build it until Instruments says you need it.

## Key Links / References

- Sleeper API docs: https://docs.sleeper.com (limited, but endpoints are stable)
- Sleeper `/players/nfl` endpoint: `https://api.sleeper.app/v1/players/nfl`
- Current Angular implementation: `src/app/services/player.service.ts` (shareReplay pattern)
- Player model: `src/app/models/player.interface.ts` (27 fields used, 53 available)
- iOS Brainstorm doc: `docs/features/xomper-ios/BRAINSTORM.md`
- Apple docs on Caches directory: https://developer.apple.com/documentation/foundation/filemanager/1407693-urls
- Apple docs on BGAppRefreshTask: https://developer.apple.com/documentation/backgroundtasks/bgapprefreshtask

## Open Questions

- [ ] Does the Sleeper ETag change on every roster move, or only on scheduled bulk updates? (Monitor over a week to understand update frequency)
- [ ] What is the actual Swift JSONDecoder parse time on a real iPhone 15? (Python estimate of 12-20ms needs device validation)
- [ ] Should we pre-filter to active players only? Cuts data in half but loses historical player lookups (draft history references retired players)
