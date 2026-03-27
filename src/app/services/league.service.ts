import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable, EMPTY, map, of, forkJoin } from 'rxjs'
import { expand, reduce, tap } from 'rxjs/operators'
import { Roster } from '../models/roster.interface'
import { League } from '../models/league.interface'
import { LeagueModel } from '../models/league.model'
import { User } from '../models/user.interface'
import { LeagueConfig } from '../models/league-config.interface'
import { Matchup } from '../models/matchup.interface'
import { NflStateModel } from '../models/nfl-state.model'
import { NflState } from '../models/nfl-state.interface'
import { PlayoffBracketMatch } from '../models/playoff-bracket.interface'
import { environment } from 'src/environments/environment'
import { getCurrentSeason } from '../constants/season'

export interface Transaction {
  type: string
  status: string
  transaction_id: string
  roster_ids: number[]
  adds: Record<string, number> | null
  drops: Record<string, number> | null
  created: number
  [key: string]: unknown
}

export interface TradedPick {
  season: string
  round: number
  roster_id: number
  previous_owner_id: number
  owner_id: number
  [key: string]: unknown
}

@Injectable({
  providedIn: 'root',
})
export class LeagueService {
  private myLeague: LeagueModel | null = null
  private currentLeague: LeagueModel | null = null
  private leagueState: NflStateModel | null = null
  private leagueChainCache: LeagueModel[] | null = null

  private baseUrl = 'https://api.sleeper.app/v1'

  // Whitelisted league from environment
  private whitelistedLeagueId = environment.myLeagueId
  private whitelistedLeagueName = environment.myLeagueName

  private leagueMap: Record<string, LeagueConfig> = {
    'clt-dynasty': {
      id: this.whitelistedLeagueId,
      display_name: this.whitelistedLeagueName,
      dynasty: true,
      divisions: 3,
      size: 12,
      taxi: true,
    },
  }

  constructor(private http: HttpClient) {}

  // =========================================
  // API CALLS
  // =========================================

  searchLeague(leagueId: string): Observable<LeagueModel> {
    return this.http
      .get<League>(`${this.baseUrl}/league/${leagueId}`)
      .pipe(map((l) => new LeagueModel(l)))
  }

  findLeagueUsers(leagueId: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/league/${leagueId}/users`)
  }

  findLeagueRosters(leagueId: string): Observable<Roster[]> {
    return this.http.get<Roster[]>(`${this.baseUrl}/league/${leagueId}/rosters`)
  }

  findUserLeagues(
    season?: string,
    userId?: string,
  ): Observable<LeagueModel[]> {
    if (!userId) throw new Error('User ID required to fetch leagues')
    const effectiveSeason = season || getCurrentSeason()
    return this.http
      .get<League[]>(`${this.baseUrl}/user/${userId}/leagues/nfl/${effectiveSeason}`)
      .pipe(map((leagues) => leagues.map((l) => new LeagueModel(l))))
  }

  getLeagueMatchups(
    leagueId: string,
    week: number,
  ): Observable<{ teamA: Matchup; teamB: Matchup }[]> {
    return this.http
      .get<Matchup[]>(`${this.baseUrl}/league/${leagueId}/matchups/${week}`)
      .pipe(
        map((matchups) => {
          const grouped: Record<number, Matchup[]> = {}
          matchups.forEach((m) => {
            if (!grouped[m.matchup_id]) {
              grouped[m.matchup_id] = []
            }
            grouped[m.matchup_id].push(m)
          })

          return Object.values(grouped).map((pair) => ({
            teamA: pair[0],
            teamB: pair[1],
          }))
        }),
      )
  }

  getLeagueState(): Observable<NflStateModel> {
    return this.http
      .get<NflState>(`${this.baseUrl}/state/nfl`)
      .pipe(map((state) => new NflStateModel(state)))
  }

  getLeagueTransactions(leagueId: string, week: number): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(
      `${this.baseUrl}/league/${leagueId}/transactions/${week}`,
    )
  }

  getTradedPicks(leagueId: string): Observable<TradedPick[]> {
    return this.http.get<TradedPick[]>(
      `${this.baseUrl}/league/${leagueId}/traded_picks`,
    )
  }

  getWinnersBracket(leagueId: string): Observable<PlayoffBracketMatch[]> {
    return this.http.get<PlayoffBracketMatch[]>(
      `${this.baseUrl}/league/${leagueId}/winners_bracket`,
    )
  }

  getLosersBracket(leagueId: string): Observable<PlayoffBracketMatch[]> {
    return this.http.get<PlayoffBracketMatch[]>(
      `${this.baseUrl}/league/${leagueId}/losers_bracket`,
    )
  }

  // =========================================
  // WHITELISTED LEAGUE
  // =========================================

  getWhitelistedLeagueId(): string {
    return this.whitelistedLeagueId
  }

  getWhitelistedLeagueName(): string {
    return this.whitelistedLeagueName
  }

  isWhitelistedLeague(leagueId: string): boolean {
    return leagueId === this.whitelistedLeagueId
  }

  loadWhitelistedLeague(): Observable<LeagueModel> {
    return this.searchLeague(this.whitelistedLeagueId)
  }

  // =========================================
  // LEAGUE STATE
  // =========================================

  setMyLeague(league: LeagueModel): void {
    this.myLeague =
      league instanceof LeagueModel ? league : new LeagueModel(league)
  }

  getMyLeague(): LeagueModel | null {
    return this.myLeague
  }

  setCurrentLeague(league: LeagueModel): void {
    this.currentLeague =
      league instanceof LeagueModel ? league : new LeagueModel(league)
  }

  getCurrentLeague(): LeagueModel | null {
    return this.currentLeague
  }

  myLeagueSelected(): boolean {
    return !!this.myLeague
  }

  currentLeagueSelected(): boolean {
    return !!this.currentLeague
  }

  setNflState(state: NflStateModel): void {
    this.leagueState = state
  }

  getNflState(): NflStateModel | null {
    return this.leagueState
  }

  reset(): void {
    this.myLeague = null
    this.currentLeague = null
    this.leagueState = null
    this.leagueChainCache = null
  }

  // =========================================
  // LEAGUE CHAIN (DYNASTY HISTORY)
  // =========================================

  getLeagueChain(leagueId: string): Observable<LeagueModel[]> {
    if (this.leagueChainCache) {
      return of(this.leagueChainCache)
    }

    return this.searchLeague(leagueId).pipe(
      expand(league =>
        league.previous_league_id
          ? this.searchLeague(league.previous_league_id)
          : EMPTY
      ),
      reduce((acc: LeagueModel[], league: LeagueModel) => {
        acc.push(league)
        return acc
      }, []),
      tap(chain => this.leagueChainCache = chain)
    )
  }

  loadLeagueContext(league: LeagueModel): Observable<{
    league: LeagueModel
    users: User[]
    rosters: Roster[]
  }> {
    return forkJoin({
      users: this.findLeagueUsers(league.league_id),
      rosters: this.findLeagueRosters(league.league_id)
    }).pipe(
      map(({ users, rosters }) => ({ league, users, rosters }))
    )
  }

  // =========================================
  // LEAGUE MAP
  // =========================================

  getAllowedLeagueId(leagueName: string): string | null {
    return this.leagueMap[leagueName]?.id ?? null
  }

  getAllowedLeagues(): string[] {
    return Object.keys(this.leagueMap)
  }

  getLeagueMap(): Record<string, LeagueConfig> {
    return this.leagueMap
  }

  getLeagueConfig(leagueId: string): LeagueConfig | null {
    return (
      Object.values(this.leagueMap).find((config) => config.id === leagueId) ||
      null
    )
  }
}
