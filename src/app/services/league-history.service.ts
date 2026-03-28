import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable, forkJoin, of, from } from 'rxjs'
import { map, switchMap, tap, catchError } from 'rxjs/operators'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { environment } from 'src/environments/environment'
import { DraftService } from './draft.service'
import { LeagueService } from './league.service'
import { DraftModel } from '../models/draft.model'
import { DraftPick } from '../models/draft.interface'
import { LeagueModel } from '../models/league.model'
import { User } from '../models/user.interface'
import { Roster } from '../models/roster.interface'
import { Matchup } from '../models/matchup.interface'

type MatchupPair = { teamA: Matchup; teamB: Matchup }

export interface DraftHistoryRecord {
  league_id: string
  draft_id: string
  season: string
  round: number
  pick_no: number
  draft_slot: number
  player_id: string
  player_name: string
  player_position: string
  player_team: string
  picked_by_user_id: string
  picked_by_roster_id: number
  picked_by_username: string
  picked_by_team_name: string
  is_keeper: boolean
}

export interface MatchupHistoryRecord {
  league_id: string
  season: string
  week: number
  matchup_id: number
  team_a_roster_id: number
  team_a_user_id: string
  team_a_username: string
  team_a_team_name: string
  team_a_points: number
  team_b_roster_id: number
  team_b_user_id: string
  team_b_username: string
  team_b_team_name: string
  team_b_points: number
  winner_roster_id: number | null
  is_playoff: boolean
  is_championship: boolean
  team_a_division: number
  team_b_division: number
}

export interface SeasonStandingsRecord {
  league_id: string
  season: string
  roster_id: number
  user_id: string
  username: string
  team_name: string
  division: string
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  league_rank: number
  division_rank: number
  playoff_seed: number
  is_champion: boolean
  is_runner_up: boolean
  made_playoffs: boolean
}

export interface WorldCupTeamRecord {
  user_id: string
  username: string
  team_name: string
  division: number
  divisionName: string
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
  qualified: boolean         // top 2 in division
  seasonBreakdown: {
    season: string
    wins: number
    losses: number
    pointsFor: number
    pointsAgainst: number
  }[]
}

export interface WorldCupDivision {
  divisionNumber: number
  divisionName: string
  teams: WorldCupTeamRecord[]
}

export interface LeagueChampion {
  league_id: string
  season: string
  champion_roster_id: number
  champion_user_id: string
  champion_username: string
  champion_team_name: string
  runner_up_roster_id: number
  runner_up_username: string
  championship_score: number
  runner_up_score: number
}

@Injectable({
  providedIn: 'root'
})
export class LeagueHistoryService {
  private supabase: SupabaseClient
  private baseUrl = 'https://api.sleeper.app/v1'

  // Cache
  private draftHistoryCache: Map<string, DraftHistoryRecord[]> = new Map()
  private matchupHistoryCache: Map<string, MatchupHistoryRecord[]> = new Map()
  private standingsHistoryCache: Map<string, SeasonStandingsRecord[]> = new Map()
  private championsCache: Map<string, LeagueChampion[]> = new Map()

  constructor(
    private http: HttpClient,
    private draftService: DraftService,
    private leagueService: LeagueService
  ) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    )
  }

  // =========================================
  // DRAFT HISTORY
  // =========================================

  /**
   * Get draft history for a league
   * First checks Supabase cache, then fetches from Sleeper API if needed
   */
  getDraftHistory(leagueId: string): Observable<DraftHistoryRecord[]> {
    // Check memory cache first
    const cacheKey = `draft_${leagueId}`
    if (this.draftHistoryCache.has(cacheKey)) {
      return of(this.draftHistoryCache.get(cacheKey)!)
    }

    // Check Supabase cache
    return from(
      this.supabase
        .from('draft_history')
        .select('*')
        .eq('league_id', leagueId)
        .order('season', { ascending: false })
        .order('pick_no', { ascending: true })
    ).pipe(
      switchMap(({ data, error }) => {
        if (data && data.length > 0) {
          // Found in Supabase, use cached data
          this.draftHistoryCache.set(cacheKey, data)
          return of(data as DraftHistoryRecord[])
        }
        
        // Not in cache, fetch from Sleeper API and sync
        return this.syncDraftHistoryFromSleeper(leagueId)
      }),
      catchError(() => {
        // Error:'Error getting draft history:', err)
        return of([])
      })
    )
  }

  /**
   * Sync draft history from Sleeper API to Supabase
   */
  private syncDraftHistoryFromSleeper(leagueId: string): Observable<DraftHistoryRecord[]> {
    return this.draftService.loadDraftsAndPicks(leagueId).pipe(
      switchMap((drafts: DraftModel[]) => {
        if (!drafts || drafts.length === 0) {
          return of([])
        }

        const league = this.leagueService.getMyLeague() || this.leagueService.getCurrentLeague()
        const users = league?.getUsers() || []
        const standings = league?.getStandingsTeams() || []

        const records: DraftHistoryRecord[] = []

        drafts.forEach(draft => {
          draft.picks?.forEach(pick => {
            const user = users.find(u => u.user_id === pick.picked_by)
            const team = standings.find(s => s.roster.roster_id.toString() === pick.roster_id)

            records.push({
              league_id: leagueId,
              draft_id: draft.draft_id,
              season: draft.season,
              round: pick.round,
              pick_no: pick.pick_no,
              draft_slot: pick.draft_slot,
              player_id: pick.player_id,
              player_name: `${pick.metadata?.first_name || ''} ${pick.metadata?.last_name || ''}`.trim(),
              player_position: pick.metadata?.position || '',
              player_team: pick.metadata?.team || '',
              picked_by_user_id: pick.picked_by || '',
              picked_by_roster_id: parseInt(pick.roster_id) || 0,
              picked_by_username: user?.username || '',
              picked_by_team_name: team?.teamName || (user?.metadata?.team_name as string) || '',
              is_keeper: pick.is_keeper || false
            })
          })
        })

        // Save to Supabase
        if (records.length > 0) {
          return from(
            this.supabase
              .from('draft_history')
              .upsert(records, { onConflict: 'draft_id,pick_no' })
          ).pipe(
            map(() => {
              this.draftHistoryCache.set(`draft_${leagueId}`, records)
              return records
            })
          )
        }

        return of(records)
      })
    )
  }

  /**
   * Get draft picks grouped by round for display
   */
  getDraftPicksByRound(leagueId: string, season?: string): Observable<Map<number, DraftHistoryRecord[]>> {
    return this.getDraftHistory(leagueId).pipe(
      map(picks => {
        const filtered = season ? picks.filter(p => p.season === season) : picks
        const grouped = new Map<number, DraftHistoryRecord[]>()
        
        filtered.forEach(pick => {
          if (!grouped.has(pick.round)) {
            grouped.set(pick.round, [])
          }
          grouped.get(pick.round)!.push(pick)
        })

        return grouped
      })
    )
  }

  /**
   * Get all draft picks for a specific user across all seasons
   */
  getUserDraftHistory(leagueId: string, userId: string): Observable<DraftHistoryRecord[]> {
    return this.getDraftHistory(leagueId).pipe(
      map(picks => picks.filter(p => p.picked_by_user_id === userId))
    )
  }

  // =========================================
  // DRAFT HISTORY (CHAIN - ALL SEASONS)
  // =========================================

  /**
   * Load draft history across an entire dynasty league chain.
   * Hits Sleeper API directly (bypasses Supabase).
   * Each season's picks get proper name resolution from that season's users/rosters.
   */
  getDraftHistoryFromChain(chain: LeagueModel[]): Observable<DraftHistoryRecord[]> {
    const cacheKey = `draft_chain_${chain[0]?.league_id}`
    if (this.draftHistoryCache.has(cacheKey)) {
      return of(this.draftHistoryCache.get(cacheKey)!)
    }

    if (!chain || chain.length === 0) return of([])

    const leagueIds = chain.map(l => l.league_id)

    // Load drafts+picks AND user/roster context for each league in parallel
    return forkJoin({
      drafts: this.draftService.loadDraftsAndPicksForChain(leagueIds),
      contexts: forkJoin(
        chain.map(l => this.leagueService.loadLeagueContext(l))
      )
    }).pipe(
      map(({ drafts, contexts }) => {
        // Build a lookup: leagueId -> { users, rosters }
        const contextMap = new Map<string, { users: User[], rosters: Roster[] }>()
        contexts.forEach(ctx => {
          contextMap.set(ctx.league.league_id, {
            users: ctx.users,
            rosters: ctx.rosters
          })
        })

        const records: DraftHistoryRecord[] = []

        drafts.forEach(draft => {
          const ctx = contextMap.get(draft.league_id) || { users: [], rosters: [] }

          draft.picks?.forEach(pick => {
            // Resolve user from this season's roster data
            const roster = ctx.rosters.find(r => r.roster_id.toString() === pick.roster_id)
            const user = ctx.users.find(u => u.user_id === (pick.picked_by || roster?.owner_id))

            records.push({
              league_id: draft.league_id,
              draft_id: draft.draft_id,
              season: draft.season,
              round: pick.round,
              pick_no: pick.pick_no,
              draft_slot: pick.draft_slot,
              player_id: pick.player_id,
              player_name: `${pick.metadata?.first_name || ''} ${pick.metadata?.last_name || ''}`.trim(),
              player_position: pick.metadata?.position || '',
              player_team: pick.metadata?.team || '',
              picked_by_user_id: pick.picked_by || roster?.owner_id || '',
              picked_by_roster_id: parseInt(pick.roster_id) || 0,
              picked_by_username: user?.username || '',
              picked_by_team_name: (user?.metadata?.team_name as string) || '',
              is_keeper: pick.is_keeper || false
            })
          })
        })

        // Sort: newest season first, then by pick_no ascending
        records.sort((a, b) => {
          const seasonDiff = parseInt(b.season) - parseInt(a.season)
          if (seasonDiff !== 0) return seasonDiff
          return a.pick_no - b.pick_no
        })

        this.draftHistoryCache.set(cacheKey, records)
        return records
      })
    )
  }

  // =========================================
  // MATCHUP HISTORY (CHAIN - ALL SEASONS)
  // =========================================

  /**
   * Load matchup history across an entire dynasty league chain.
   * For each league: loads context (users/rosters) then fetches all weeks' matchups.
   * Skips pre_draft leagues. Completed leagues fetch all 17 weeks.
   */
  getMatchupHistoryFromChain(chain: LeagueModel[]): Observable<MatchupHistoryRecord[]> {
    const cacheKey = `matchup_chain_${chain[0]?.league_id}`
    if (this.matchupHistoryCache.has(cacheKey)) {
      return of(this.matchupHistoryCache.get(cacheKey)!)
    }

    // Filter out pre-draft leagues (no matchups yet)
    const leaguesWithMatchups = chain.filter(l => l.status !== 'pre_draft')
    if (leaguesWithMatchups.length === 0) return of([])

    // For each league: load context + all weeks
    const perLeague$ = leaguesWithMatchups.map(league =>
      this.leagueService.loadLeagueContext(league).pipe(
        switchMap(ctx => {
          const totalWeeks = 17
          const weekCalls: Observable<{ week: number; pairs: MatchupPair[] }>[] = []

          for (let week = 1; week <= totalWeeks; week++) {
            weekCalls.push(
              this.leagueService.getLeagueMatchups(league.league_id, week).pipe(
                map(pairs => ({ week, pairs })),
                catchError(() => of({ week, pairs: [] }))
              )
            )
          }

          return forkJoin(weekCalls).pipe(
            map(weekResults => this.convertMatchupResults(
              league.league_id, league.season, weekResults, ctx.users, ctx.rosters
            ))
          )
        })
      )
    )

    return forkJoin(perLeague$).pipe(
      map(results => {
        const allRecords = results.flat()
        // Sort: newest season first, then week ascending
        allRecords.sort((a, b) => {
          const seasonDiff = parseInt(b.season) - parseInt(a.season)
          if (seasonDiff !== 0) return seasonDiff
          return a.week - b.week
        })
        this.matchupHistoryCache.set(cacheKey, allRecords)
        return allRecords
      })
    )
  }

  private convertMatchupResults(
    leagueId: string,
    season: string,
    weekResults: { week: number; pairs: MatchupPair[] }[],
    users: User[],
    rosters: Roster[]
  ): MatchupHistoryRecord[] {
    const records: MatchupHistoryRecord[] = []

    weekResults.forEach(({ week, pairs }) => {
      pairs.forEach((pair, idx) => {
        // Guard against undefined teamB (bye week)
        if (!pair.teamA || !pair.teamB) return

        const rosterA = rosters.find(r => r.roster_id === pair.teamA.roster_id)
        const rosterB = rosters.find(r => r.roster_id === pair.teamB.roster_id)
        const userA = users.find(u => u.user_id === rosterA?.owner_id)
        const userB = users.find(u => u.user_id === rosterB?.owner_id)

        const pointsA = pair.teamA.points || 0
        const pointsB = pair.teamB.points || 0
        const winnerId = pointsA > pointsB
          ? pair.teamA.roster_id
          : pointsB > pointsA
            ? pair.teamB.roster_id
            : null

        records.push({
          league_id: leagueId,
          season,
          week,
          matchup_id: pair.teamA.matchup_id || idx + 1,
          team_a_roster_id: pair.teamA.roster_id,
          team_a_user_id: userA?.user_id || '',
          team_a_username: userA?.username || '',
          team_a_team_name: (userA?.metadata?.team_name as string) || userA?.display_name || '',
          team_a_points: pointsA,
          team_b_roster_id: pair.teamB.roster_id,
          team_b_user_id: userB?.user_id || '',
          team_b_username: userB?.username || '',
          team_b_team_name: (userB?.metadata?.team_name as string) || userB?.display_name || '',
          team_b_points: pointsB,
          winner_roster_id: winnerId,
          is_playoff: week > 14,
          is_championship: week === 16 || week === 17,
          team_a_division: rosterA?.settings?.division ?? 0,
          team_b_division: rosterB?.settings?.division ?? 0
        })
      })
    })

    return records
  }

  // =========================================
  // MATCHUP HISTORY (SINGLE LEAGUE)
  // =========================================

  /**
   * Get matchup history for a league/season
   */
  getMatchupHistory(leagueId: string, season?: string): Observable<MatchupHistoryRecord[]> {
    const cacheKey = `matchup_${leagueId}_${season || 'all'}`
    if (this.matchupHistoryCache.has(cacheKey)) {
      return of(this.matchupHistoryCache.get(cacheKey)!)
    }

    let query = this.supabase
      .from('matchup_history')
      .select('*')
      .eq('league_id', leagueId)
      .order('season', { ascending: false })
      .order('week', { ascending: true })

    if (season) {
      query = query.eq('season', season)
    }

    return from(query).pipe(
      switchMap(({ data, error }) => {
        if (data && data.length > 0) {
          this.matchupHistoryCache.set(cacheKey, data)
          return of(data as MatchupHistoryRecord[])
        }

        // If no cached data, return empty (sync happens separately)
        return of([])
      }),
      catchError(() => {
        // Error:'Error getting matchup history:', err)
        return of([])
      })
    )
  }

  /**
   * Sync a full season's matchups from Sleeper to Supabase
   */
  syncSeasonMatchups(leagueId: string, season: string, totalWeeks: number = 17): Observable<MatchupHistoryRecord[]> {
    const league = this.leagueService.getMyLeague() || this.leagueService.getCurrentLeague()
    const users = league?.getUsers() || []
    const standings = league?.getStandingsTeams() || []

    // Fetch all weeks
    const weekCalls: Observable<any>[] = []
    for (let week = 1; week <= totalWeeks; week++) {
      weekCalls.push(
        this.leagueService.getLeagueMatchups(leagueId, week).pipe(
          map(pairs => ({ week, pairs })),
          catchError(() => of({ week, pairs: [] }))
        )
      )
    }

    return forkJoin(weekCalls).pipe(
      switchMap(weekResults => {
        const records: MatchupHistoryRecord[] = []

        weekResults.forEach(({ week, pairs }) => {
          pairs.forEach((pair: MatchupPair, idx: number) => {
            const teamAStanding = standings.find(s => s.roster.roster_id === pair.teamA.roster_id)
            const teamBStanding = standings.find(s => s.roster.roster_id === pair.teamB.roster_id)
            const userA = users.find(u => u.user_id === teamAStanding?.user?.user_id)
            const userB = users.find(u => u.user_id === teamBStanding?.user?.user_id)

            const winnerId = pair.teamA.points > pair.teamB.points
              ? pair.teamA.roster_id
              : pair.teamB.points > pair.teamA.points
                ? pair.teamB.roster_id
                : null

            records.push({
              league_id: leagueId,
              season: season,
              week: week,
              matchup_id: pair.teamA.matchup_id || idx + 1,
              team_a_roster_id: pair.teamA.roster_id,
              team_a_user_id: userA?.user_id || '',
              team_a_username: userA?.username || '',
              team_a_team_name: teamAStanding?.teamName || '',
              team_a_points: pair.teamA.points || 0,
              team_b_roster_id: pair.teamB.roster_id,
              team_b_user_id: userB?.user_id || '',
              team_b_username: userB?.username || '',
              team_b_team_name: teamBStanding?.teamName || '',
              team_b_points: pair.teamB.points || 0,
              winner_roster_id: winnerId,
              is_playoff: week > 14, // Adjust based on league settings
              is_championship: week === 16 || week === 17,
              team_a_division: teamAStanding?.roster?.settings?.division ?? 0,
              team_b_division: teamBStanding?.roster?.settings?.division ?? 0
            })
          })
        })

        // Upsert to Supabase
        if (records.length > 0) {
          return from(
            this.supabase
              .from('matchup_history')
              .upsert(records, { onConflict: 'league_id,season,week,matchup_id' })
          ).pipe(
            map(() => {
              this.matchupHistoryCache.set(`matchup_${leagueId}_${season}`, records)
              return records
            })
          )
        }

        return of(records)
      })
    )
  }

  /**
   * Get head-to-head record between two teams
   */
  getHeadToHead(leagueId: string, rosterId1: number, rosterId2: number): Observable<{
    team1Wins: number,
    team2Wins: number,
    ties: number,
    matchups: MatchupHistoryRecord[]
  }> {
    return this.getMatchupHistory(leagueId).pipe(
      map(matchups => {
        const h2h = matchups.filter(m =>
          (m.team_a_roster_id === rosterId1 && m.team_b_roster_id === rosterId2) ||
          (m.team_a_roster_id === rosterId2 && m.team_b_roster_id === rosterId1)
        )

        let team1Wins = 0
        let team2Wins = 0
        let ties = 0

        h2h.forEach(m => {
          if (m.winner_roster_id === rosterId1) team1Wins++
          else if (m.winner_roster_id === rosterId2) team2Wins++
          else ties++
        })

        return { team1Wins, team2Wins, ties, matchups: h2h }
      })
    )
  }

  // =========================================
  // STANDINGS HISTORY
  // =========================================

  /**
   * Get historical standings for all seasons
   */
  getStandingsHistory(leagueId: string): Observable<SeasonStandingsRecord[]> {
    const cacheKey = `standings_${leagueId}`
    if (this.standingsHistoryCache.has(cacheKey)) {
      return of(this.standingsHistoryCache.get(cacheKey)!)
    }

    return from(
      this.supabase
        .from('season_standings_history')
        .select('*')
        .eq('league_id', leagueId)
        .order('season', { ascending: false })
        .order('league_rank', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (data) {
          this.standingsHistoryCache.set(cacheKey, data)
          return data as SeasonStandingsRecord[]
        }
        return []
      }),
      catchError(() => {
        // Error:'Error getting standings history:', err)
        return of([])
      })
    )
  }

  // =========================================
  // CHAMPIONS
  // =========================================

  /**
   * Get all league champions
   */
  getChampions(leagueId: string): Observable<LeagueChampion[]> {
    const cacheKey = `champions_${leagueId}`
    if (this.championsCache.has(cacheKey)) {
      return of(this.championsCache.get(cacheKey)!)
    }

    return from(
      this.supabase
        .from('league_champions')
        .select('*')
        .eq('league_id', leagueId)
        .order('season', { ascending: false })
    ).pipe(
      map(({ data }) => {
        if (data) {
          this.championsCache.set(cacheKey, data)
          return data as LeagueChampion[]
        }
        return []
      }),
      catchError(() => {
        // Error:'Error getting champions:', err)
        return of([])
      })
    )
  }

  // =========================================
  // WORLD CUP (DIVISIONAL HEAD-TO-HEAD)
  // =========================================

  /**
   * Compute World Cup standings from divisional head-to-head records
   * across all seasons in the chain. Only counts regular-season
   * intra-divisional matchups (both teams in same division).
   * Uses user_id as stable identifier across seasons.
   */
  getWorldCupStandings(
    chain: LeagueModel[],
    matchups: MatchupHistoryRecord[]
  ): WorldCupDivision[] {
    // Get division names from the most recent league in chain
    const currentLeague = chain[0]
    const divisionNameMap = new Map<number, string>()
    if (currentLeague?.metadata) {
      for (const key of Object.keys(currentLeague.metadata)) {
        const match = key.match(/^division_(\d+)$/)
        if (match && !key.endsWith('_avatar')) {
          divisionNameMap.set(parseInt(match[1]), String(currentLeague.metadata[key]))
        }
      }
    }

    // Filter: regular season only, intra-divisional matchups with scores
    const divisionalMatchups = matchups.filter(m =>
      !m.is_playoff &&
      m.team_a_division > 0 &&
      m.team_b_division > 0 &&
      m.team_a_division === m.team_b_division &&
      (m.team_a_points > 0 || m.team_b_points > 0)
    )

    // Build per-user records: keyed by user_id
    const userRecords = new Map<string, {
      user_id: string
      username: string
      team_name: string
      division: number
      wins: number
      losses: number
      ties: number
      pointsFor: number
      pointsAgainst: number
      seasonData: Map<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number }>
    }>()

    const ensureUser = (userId: string, username: string, teamName: string, division: number) => {
      if (!userRecords.has(userId)) {
        userRecords.set(userId, {
          user_id: userId,
          username,
          team_name: teamName,
          division,
          wins: 0, losses: 0, ties: 0,
          pointsFor: 0, pointsAgainst: 0,
          seasonData: new Map()
        })
      }
      // Update team name to latest
      const rec = userRecords.get(userId)!
      if (teamName) rec.team_name = teamName
      if (division > 0) rec.division = division
      return rec
    }

    const ensureSeason = (rec: ReturnType<typeof ensureUser>, season: string) => {
      if (!rec.seasonData.has(season)) {
        rec.seasonData.set(season, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 })
      }
      return rec.seasonData.get(season)!
    }

    for (const m of divisionalMatchups) {
      const recA = ensureUser(m.team_a_user_id, m.team_a_username, m.team_a_team_name, m.team_a_division)
      const recB = ensureUser(m.team_b_user_id, m.team_b_username, m.team_b_team_name, m.team_b_division)
      const seasonA = ensureSeason(recA, m.season)
      const seasonB = ensureSeason(recB, m.season)

      recA.pointsFor += m.team_a_points
      recA.pointsAgainst += m.team_b_points
      seasonA.pointsFor += m.team_a_points
      seasonA.pointsAgainst += m.team_b_points

      recB.pointsFor += m.team_b_points
      recB.pointsAgainst += m.team_a_points
      seasonB.pointsFor += m.team_b_points
      seasonB.pointsAgainst += m.team_a_points

      if (m.winner_roster_id === null) {
        recA.ties++; recB.ties++
      } else if (m.team_a_points > m.team_b_points) {
        recA.wins++; recB.losses++
        seasonA.wins++; seasonB.losses++
      } else {
        recB.wins++; recA.losses++
        seasonB.wins++; seasonA.losses++
      }
    }

    // Group by division
    const divisionGroups = new Map<number, WorldCupTeamRecord[]>()

    for (const rec of userRecords.values()) {
      if (!divisionGroups.has(rec.division)) {
        divisionGroups.set(rec.division, [])
      }

      const seasonBreakdown = Array.from(rec.seasonData.entries())
        .map(([season, data]) => ({ season, ...data }))
        .sort((a, b) => parseInt(a.season) - parseInt(b.season))

      divisionGroups.get(rec.division)!.push({
        user_id: rec.user_id,
        username: rec.username,
        team_name: rec.team_name,
        division: rec.division,
        divisionName: divisionNameMap.get(rec.division) || `Division ${rec.division}`,
        wins: rec.wins,
        losses: rec.losses,
        ties: rec.ties,
        pointsFor: rec.pointsFor,
        pointsAgainst: rec.pointsAgainst,
        qualified: false,
        seasonBreakdown
      })
    }

    // Sort within each division: wins desc, then points for desc as tiebreaker
    const divisions: WorldCupDivision[] = []

    for (const [divNum, teams] of divisionGroups.entries()) {
      teams.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.pointsFor - a.pointsFor
      })

      // Top 2 qualify
      if (teams.length >= 1) teams[0].qualified = true
      if (teams.length >= 2) teams[1].qualified = true

      divisions.push({
        divisionNumber: divNum,
        divisionName: divisionNameMap.get(divNum) || `Division ${divNum}`,
        teams
      })
    }

    // Sort divisions by number
    divisions.sort((a, b) => a.divisionNumber - b.divisionNumber)

    return divisions
  }

  // =========================================
  // UTILITY
  // =========================================

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.draftHistoryCache.clear()
    this.matchupHistoryCache.clear()
    this.standingsHistoryCache.clear()
    this.championsCache.clear()
  }

  /**
   * Get available seasons for a league
   */
  getAvailableSeasons(leagueId: string): Observable<string[]> {
    return this.getDraftHistory(leagueId).pipe(
      map(drafts => {
        const seasons = [...new Set(drafts.map(d => d.season))]
        return seasons.sort((a, b) => parseInt(b) - parseInt(a))
      })
    )
  }
}
