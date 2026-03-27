import { Injectable } from '@angular/core'
import { LeagueService } from './league.service'
import { DraftService } from './draft.service'
import { PlayerService } from './player.service'
import { SupabaseService } from './supabase.service'
import { TaxiSquadPlayerModel } from '../models/taxi-squad-player.model'
import { Roster } from '../models/roster.interface'
import { forkJoin, from, map, Observable, of, switchMap, catchError } from 'rxjs'
import { PlayerModel } from '../models/player.model'

interface StealRequest {
  player_id: string
}

@Injectable({ providedIn: 'root' })
export class TaxiSquadService {
  constructor(
    private leagueService: LeagueService,
    private draftService: DraftService,
    private playerService: PlayerService,
    private supabaseService: SupabaseService,
  ) {}

  loadTaxiSquadPlayers(leagueId: string): Observable<TaxiSquadPlayerModel[]> {
    return this.draftService.getDraftsForLeague(leagueId).pipe(
      switchMap((drafts) => {
        const league = this.leagueService.getMyLeague()
        if (!league) return of([])

        const picks = drafts.map((draft) => draft.picks)
        const combinedPicks = picks.flat()

        const taxiPlayerRequests: Observable<TaxiSquadPlayerModel>[] = []

        league.rosters.forEach((roster: Roster) => {
          const ownerUser = league.users.find(
            (u) => u.user_id === roster.owner_id
          )
          const ownerTeam = league.standingsTeams.find(
            (st) => st.user.user_id === ownerUser?.user_id
          )

          roster.taxi?.forEach((playerId) => {
            const player$ = this.playerService.getPlayerById(playerId).pipe(
              map((playerData) => {
                const draftPick = combinedPicks.find(
                  (p) => p.player_id === playerId
                )

                const basePlayer = new PlayerModel(playerData)

                return new TaxiSquadPlayerModel(basePlayer, {
                  rosterId: roster.roster_id,
                  ownerUserId: ownerUser?.user_id ?? '',
                  ownerDisplayName: ownerUser?.display_name ?? '',
                  ownerUsername: ownerUser?.username ?? '',
                  ownerTeamName: ownerTeam?.teamName ?? '',
                  draftRound: draftPick?.round ?? -1,
                  draftPickNo: draftPick?.draft_slot ?? -1,
                })
              })
            )

            taxiPlayerRequests.push(player$)
          })
        })

        return taxiPlayerRequests.length ? forkJoin(taxiPlayerRequests) : of([])
      })
    )
  }

  getStealRequests(leagueId: string): Observable<Set<string>> {
    return from(
      this.supabaseService.getClient()
        .from('taxi_steal_requests')
        .select('player_id')
        .eq('league_id', leagueId)
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return new Set<string>()
        return new Set<string>((data as StealRequest[]).map((r) => r.player_id))
      }),
      catchError(() => of(new Set<string>()))
    )
  }

  createStealRequest(leagueId: string, playerId: string, requestedByName: string): Observable<boolean> {
    const userId = this.supabaseService.getUser()?.id
    if (!userId) return of(false)

    return from(
      this.supabaseService.getClient()
        .from('taxi_steal_requests')
        .insert({
          league_id: leagueId,
          player_id: playerId,
          requested_by: userId,
          requested_by_name: requestedByName,
        })
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false))
    )
  }
}
