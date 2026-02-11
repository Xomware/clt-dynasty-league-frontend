import { Component, Input, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { forkJoin, switchMap, take } from 'rxjs'
import { LeagueService } from 'src/app/services/league.service'
import { LeagueHistoryService, WorldCupDivision } from 'src/app/services/league-history.service'
import { StandingsService } from 'src/app/services/standings.service'
import { ToastService } from 'src/app/services/toast.service'
import { TeamService } from 'src/app/services/team.service'
import { UserService } from 'src/app/services/user.service'
import { UserModel } from 'src/app/models/user.model'
import { LeagueModel } from 'src/app/models/league.model'
import { RosterModel } from 'src/app/models/roster.model'
import { StandingsTeamModel } from 'src/app/models/standings.model'
import { Matchup } from 'src/app/models/matchup.interface'
import { MatchupModel } from 'src/app/models/matchup.model'
import { MatchupDisplay } from 'src/app/models/matchup-display.interface'
import { MatchupDetailInput } from 'src/app/models/matchup-detail-input.interface'
import { PlayoffBracketMatch } from 'src/app/models/playoff-bracket.interface'

@Component({
  selector: 'app-league',
  templateUrl: './league.component.html',
  styleUrls: ['./league.component.scss'],
})
export class LeagueComponent implements OnInit {
  @Input() mode: 'my' | 'selected' = 'selected'
  viewMode: 'league' | 'division' = 'league' // default to full league
  private league: LeagueModel
  leaguePicture = ''
  leagueName = ''
  leagueId = ''
  leaguePlayoffTeams: number = 0
  leagueUsers
  leagueRosters: RosterModel[] = []
  standings: StandingsTeamModel[] = []
  standingsByDivision: { [division: string]: StandingsTeamModel[] }
  loading = false
  activeTab: 'standings' | 'matchups' | 'playoffs' | 'worldcup' = 'standings'
  matchups: MatchupModel[] = []
  matchupsGrouped: MatchupDisplay[] = []
  private rawMatchupPairs: { teamA: Matchup; teamB: Matchup }[] = []
  currentWeek: number = -1
  selectedWeek: number = this.currentWeek
  weeks: number[] = Array.from({ length: 18 }, (_, i) => i + 1) // e.g., 1–18 weeks
  selectedMatchupDetail: MatchupDetailInput | null = null
  modalStart!: {
    top: number
    left: number
    width: number
    height: number
  } | null

  leagueTaxiSquadIds: string[] = []

  // Playoffs bracket
  winnersBracket: PlayoffBracketMatch[] = []
  losersBracket: PlayoffBracketMatch[] = []
  bracketRounds: { round: number; matches: PlayoffBracketMatch[] }[] = []
  loserRounds: { round: number; matches: PlayoffBracketMatch[] }[] = []
  playoffsLoaded = false

  // World Cup
  worldCupDivisions: WorldCupDivision[] = []
  worldCupLoaded = false
  worldCupSeasons: string[] = []
  wcGridColumns = '40px 2fr 0.6fr 0.6fr 1fr 1fr'

  constructor(
    private LeagueService: LeagueService,
    private LeagueHistoryService: LeagueHistoryService,
    private router: Router,
    private ToastService: ToastService,
    private StandingsService: StandingsService,
    private TeamService: TeamService,
    private UserService: UserService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    console.log('League Init.')
    this.loading = true

    // If mode is 'my', just use myLeague (already set at login)
    if (this.mode === 'my') {
      const myLeague = this.LeagueService.getMyLeague()
      if (!myLeague) {
        console.warn('No myLeague set!')
        this.loading = false
        return
      }
      this.league = myLeague
      this.setupLeague()
      this.loading = false
    } else {
      // Mode is 'other' / currentLeague
      this.route.queryParams.pipe(take(1)).subscribe((params) => {
        const queryLeagueId = params['leagueId']
        this.viewMode = params['view']

        console.log('LeagueId from query:', queryLeagueId)

        const currentLeague = this.LeagueService.getCurrentLeague()

        // Only fetch if we don't already have it or ID differs
        if (!currentLeague || currentLeague.league_id !== queryLeagueId) {
          this.LeagueService.searchLeague(queryLeagueId)
            .pipe(take(1))
            .subscribe({
              next: (league) => {
                console.log('League Found from query param:', league)
                this.LeagueService.setCurrentLeague(league)
                this.league = this.LeagueService.getCurrentLeague()
                this.ToastService.showPositiveToast('League Loaded.')
                this.setupLeague()
              },
              error: (err) => {
                console.error('Error loading league from query param', err)
                this.ToastService.showNegativeToast('Error loading league.')
              },
              complete: () => {
                this.loading = false
              },
            })
        } else {
          // Already have the league, no need to fetch
          this.league = currentLeague
          this.setupLeague()
          this.loading = false
        }
      })
    }
  }

  private setupLeague(): void {
    this.leaguePicture = this.league.getProfilePicture()
    this.leagueName = this.league.getDisplayName()
    this.leagueId = this.league.getId()
    this.leagueUsers = this.league.getUsers()
    this.leaguePlayoffTeams = this.league.getPlayoffTeams()
    this.league.setDivisions()
    this.getLeagueUsers()
  }
  getLeagueUsers(): void {
    this.loading = true
    console.log('Getting League Users.')
    this.LeagueService.findLeagueUsers(this.leagueId)
      .pipe(take(1))
      .subscribe({
        next: (users) => {
          console.log('League Users Found------')
          const userModels = users.map((user) => new UserModel(user))
          this.league.setUsers(userModels)
          if (this.mode == 'my') {
            this.LeagueService.setMyLeague(this.league)
          } else {
            this.LeagueService.setCurrentLeague(this.league)
          }
          this.leagueUsers = this.league.getUsers()
          //this.ToastService.showPositiveToast("Users Found.")
          this.getLeagueRosters()
        },
        error: (err) => {
          console.error('Error Getting League Users', err)
          this.ToastService.showNegativeToast('Error Finding League Users.')
          this.loading = false
        },
        complete: () => {
          this.loading = false
        },
      })
  }
  getLeagueRosters(): void {
    this.loading = true
    console.log('Getting League Rosters.')
    this.LeagueService.findLeagueRosters(this.leagueId)
      .pipe(take(1))
      .subscribe({
        next: (rosters) => {
          console.log('League Rosters Found------', rosters)
          const rosterModels = rosters.map((roster) => new RosterModel(roster))
          this.league.setRosters(rosterModels)
          if (this.mode == 'my') {
            this.LeagueService.setMyLeague(this.league)
          } else {
            this.LeagueService.setCurrentLeague(this.league)
          }
          this.leagueRosters = this.league.getRosters()

          this.leagueTaxiSquadIds = this.leagueRosters.reduce(
            (acc: string[], roster) => acc.concat(roster.taxi),
            [],
          )
          this.league.setTaxiSquadIds(this.leagueTaxiSquadIds)
          if (this.mode == 'my') {
            this.LeagueService.setMyLeague(this.league)
          } else {
            this.LeagueService.setCurrentLeague(this.league)
          }

          // Build standings view model
          this.standings = this.leagueRosters.map((roster) => {
            // Find the user object from leagueUsers
            const user = this.leagueUsers.find(
              (u) => u.user_id === roster.owner_id,
            )

            // Parse streak from metadata.streak (example: "1W" or "2L")
            let streakTotal = 0
            let streakType: '' | 'win' | 'loss' = ''
            if (roster.metadata?.streak) {
              const match = roster.metadata.streak.match(/(\d+)([WL])/)
              if (match) {
                streakTotal = parseInt(match[1], 10)
                streakType = match[2] === 'W' ? 'win' : 'loss'
              }
            }

            //const divisionIndex = roster.settings?.division - 1;
            const divisionIndex =
              roster.settings?.division != null
                ? `division_${roster.settings.division}`
                : null
            const divisionName = divisionIndex
              ? (this.league.metadata?.[divisionIndex] ?? 'Unknown Division')
              : 'Unknown Division'
            const divisionAvatar = divisionIndex
              ? (this.league.metadata?.[`${divisionIndex}_avatar`] ??
                'assets/img/nfl.png')
              : 'assets/img/nfl.png'

            // Build plain interface (StandingsTeam)
            const teamData = {
              roster, // if this is still a plain Roster, wrap with new RosterModel(roster)
              players: [],
              user: new UserModel(user!),
              league: this.league!, // wrap in LeagueModel if needed
              teamName:
                user?.metadata?.team_name || `${user?.display_name}'s Team`,
              userName: user?.display_name || 'Unknown User',
              avatar: user?.avatar
                ? this.UserService.buildAvatar(user.avatar)
                : 'assets/img/nfl.png',
              wins: roster.settings?.wins ?? 0,
              losses: roster.settings?.losses ?? 0,
              fpts:
                (roster.settings?.fpts ?? 0) +
                (roster.settings?.fpts_decimal ?? 0) / 100,
              fptsAgainst:
                (roster.settings?.fpts_against ?? 0) +
                (roster.settings?.fpts_against_decimal ?? 0) / 100,
              streak: {
                type: streakType,
                total: streakTotal,
              },
              divisionName: divisionName,
              divisionAvatar: divisionAvatar,
              leagueRank: -1,
              divisionRank: -1,
            }

            // Convert to model
            return new StandingsTeamModel(teamData)
          })
        },
        error: (err) => {
          console.error('Error Getting League Rosters', err)
          this.ToastService.showNegativeToast('Error Finding League Rosters.')
          this.loading = false
        },
        complete: () => {
          // Sort league
          this.standings = this.StandingsService.buildStandings(this.standings)
          this.league.setStandingsTeams(this.standings)

          if (this.mode == 'my') {
            console.log('Setting My Team.')
            // Get My Team
            const myUserName = this.UserService.getMyUser().getUserName()
            const myTeam = this.standings.find(
              (team) => team.userName === myUserName,
            )
            this.LeagueService.setMyLeague(this.league)
            this.TeamService.setMyTeam(myTeam)
          } else {
            this.LeagueService.setCurrentLeague(this.league)
            console.log('Not my league bro.')
          }

          // dynamically build division -> teams map
          this.standingsByDivision =
            this.StandingsService.buildDivisionStandings(this.standings)

          console.log('Standings by division:', this.standingsByDivision)
          this.loading = false
        },
      })
  }
  selectCurrentTeam(team: StandingsTeamModel): void {
    console.log(`Team Selected: ${team.getTeamName()}`)
    if (team.getTeamName() == this.TeamService.getMyTeam()?.getTeamName()) {
      console.log('Selected yourself - (conceited, pompous, self centered)')
      this.router.navigate(['/my-team'], {
        queryParams: {
          user: this.TeamService.getMyTeam().getUserName(),
          league: this.league.getId(),
        },
      })
    } else {
      this.TeamService.setCurrentTeam(team)
      this.router.navigate(['/selected-team'], {
        queryParams: {
          user: this.TeamService.getCurrentTeam().getUserName(),
          league: this.league.getId(),
        },
      })
    }
  }
  goToUserProfile(userId: string): void {
    console.log(`User Selected: ${userId}`)
    if (userId == this.UserService.getMyUser()?.getUserId()) {
      console.log('Selected yourself - (conceited, pompous, self centered)')
      this.router.navigate(['/my-profile'], {
        queryParams: {
          userId: userId,
        },
      })
    } else {
      this.router.navigate(['/selected-profile'], {
        queryParams: {
          userId: userId,
        },
      })
    }
  }
  setWeek(week: number) {
    this.selectedWeek = week
    this.getMatchups()
  }

  getMatchups(): void {
    this.loading = true
    this.LeagueService.getLeagueMatchups(this.leagueId, this.selectedWeek)
      .pipe(take(1))
      .subscribe({
        next: (rawPairs) => {
          this.rawMatchupPairs = rawPairs
          this.matchupsGrouped = rawPairs.map((pair) => {
            const teamAInfo = this.standings.find(
              (t) => t.roster.roster_id === pair.teamA.roster_id,
            )
            const teamBInfo = this.standings.find(
              (t) => t.roster.roster_id === pair.teamB.roster_id,
            )

            // Only highlight if week is in the past
            const highlightA =
              this.selectedWeek < this.LeagueService.getNflState().week
                ? pair.teamA.points > pair.teamB.points
                  ? 'win'
                  : 'loss'
                : ''
            const highlightB =
              this.selectedWeek < this.LeagueService.getNflState().week
                ? pair.teamB.points > pair.teamA.points
                  ? 'win'
                  : 'loss'
                : ''
            // Set Match Status
            let matchStatus = 'Future'
            if (this.currentWeek == this.selectedWeek) {
              matchStatus = 'In Progress'
            } else if (this.currentWeek > this.selectedWeek) {
              matchStatus = 'Complete'
            }
            return {
              teamA: {
                teamName: teamAInfo.teamName,
                userName: teamAInfo.userName,
                avatar: teamAInfo.avatar,
                wins: teamAInfo.wins,
                losses: teamAInfo.losses,
                points: pair.teamA.points,
                highlight: highlightA,
                standingsTeam: teamAInfo,
              },
              teamB: {
                teamName: teamBInfo.teamName,
                userName: teamBInfo.userName,
                avatar: teamBInfo.avatar,
                wins: teamBInfo.wins,
                losses: teamBInfo.losses,
                points: pair.teamB.points,
                highlight: highlightB,
                standingsTeam: teamBInfo,
              },
              status: matchStatus,
            } as MatchupDisplay
          })
        },
        error: (err) => {
          console.error('Error Getting League Matchups', err)
          this.ToastService.showNegativeToast('Error Finding League Matchups.')
          this.loading = false
        },
        complete: () => {
          this.loading = false
        },
      })
  }

  setTab(tab: 'standings' | 'matchups' | 'playoffs' | 'worldcup') {
    this.activeTab = tab
    if (tab === 'matchups' && this.matchups.length === 0) {
      this.getMatchups()
    }
    if (tab === 'playoffs' && !this.playoffsLoaded) {
      this.loadPlayoffBracket()
    }
    if (tab === 'worldcup' && !this.worldCupLoaded) {
      this.loadWorldCup()
    }
  }

  // ---- PLAYOFFS BRACKET ----

  loadPlayoffBracket(): void {
    this.loading = true
    forkJoin({
      winners: this.LeagueService.getWinnersBracket(this.leagueId),
      losers: this.LeagueService.getLosersBracket(this.leagueId)
    }).pipe(take(1)).subscribe({
      next: ({ winners, losers }) => {
        this.winnersBracket = winners as PlayoffBracketMatch[]
        this.losersBracket = losers as PlayoffBracketMatch[]
        this.bracketRounds = this.groupBracketByRound(this.winnersBracket)
        this.loserRounds = this.groupBracketByRound(this.losersBracket)
        this.playoffsLoaded = true
        this.loading = false
      },
      error: () => {
        this.ToastService.showNegativeToast('Error loading playoff bracket.')
        this.loading = false
      }
    })
  }

  private groupBracketByRound(matches: PlayoffBracketMatch[]): { round: number; matches: PlayoffBracketMatch[] }[] {
    const roundMap = new Map<number, PlayoffBracketMatch[]>()
    matches.forEach(m => {
      if (!roundMap.has(m.r)) roundMap.set(m.r, [])
      roundMap.get(m.r)!.push(m)
    })
    return Array.from(roundMap.entries())
      .map(([round, matches]) => ({ round, matches }))
      .sort((a, b) => a.round - b.round)
  }

  getTeamName(rosterId: number | null): string {
    if (!rosterId) return 'TBD'
    const team = this.standings.find(s => s.roster.roster_id === rosterId)
    return team?.teamName || `Roster ${rosterId}`
  }

  getTeamAvatar(rosterId: number | null): string {
    if (!rosterId) return 'assets/img/nfl.png'
    const team = this.standings.find(s => s.roster.roster_id === rosterId)
    return team?.avatar || 'assets/img/nfl.png'
  }

  getBracketMatchLabel(match: PlayoffBracketMatch): string {
    if (match.p === 1) return 'Championship'
    if (match.p === 3) return '3rd Place'
    if (match.p === 5) return '5th Place'
    return ''
  }

  // ---- WORLD CUP ----

  loadWorldCup(): void {
    this.loading = true
    this.LeagueService.getLeagueChain(this.leagueId).pipe(
      switchMap(chain => this.LeagueHistoryService.getMatchupHistoryFromChain(chain).pipe(
        take(1),
        switchMap(matchups => {
          this.worldCupDivisions = this.LeagueHistoryService.getWorldCupStandings(chain, matchups)
          // Gather unique seasons
          this.worldCupSeasons = [...new Set(matchups.map(m => m.season))]
            .sort((a, b) => parseInt(a) - parseInt(b))
          return [this.worldCupDivisions]
        })
      )),
      take(1)
    ).subscribe({
      next: () => {
        // Build dynamic grid columns: base + one column per season
        const seasonCols = this.worldCupSeasons.map(() => '0.8fr').join(' ')
        this.wcGridColumns = `40px 2fr 0.6fr 0.6fr 1fr 1fr ${seasonCols}`.trim()
        this.worldCupLoaded = true
        this.loading = false
      },
      error: () => {
        this.ToastService.showNegativeToast('Error loading World Cup standings.')
        this.loading = false
      }
    })
  }

  getSeasonBreakdown(team: any, season: string): { wins: number; losses: number } {
    const sb = team.seasonBreakdown?.find((s: any) => s.season === season)
    return sb || { wins: 0, losses: 0 }
  }

  openMatchupModal(index: number, event: MouseEvent) {
    const card = (event.currentTarget as HTMLElement).getBoundingClientRect()
    this.modalStart = {
      top: card.top,
      left: card.left,
      width: card.width,
      height: card.height,
    }

    const pair = this.rawMatchupPairs[index]
    const display = this.matchupsGrouped[index]
    if (!pair || !display) return

    this.selectedMatchupDetail = {
      teamA: {
        teamName: display.teamA.teamName,
        userName: display.teamA['userName'] || '',
        avatar: display.teamA.avatar || 'assets/img/nfl.png',
        wins: display.teamA.wins,
        losses: display.teamA.losses,
        totalPoints: pair.teamA.points,
        rosterId: pair.teamA.roster_id,
        starters: pair.teamA.starters || [],
        players: pair.teamA.players || [],
        startersPoints: pair.teamA.starters_points || [],
        playersPoints: pair.teamA.players_points || {},
      },
      teamB: {
        teamName: display.teamB.teamName,
        userName: display.teamB['userName'] || '',
        avatar: display.teamB.avatar || 'assets/img/nfl.png',
        wins: display.teamB.wins,
        losses: display.teamB.losses,
        totalPoints: pair.teamB.points,
        rosterId: pair.teamB.roster_id,
        starters: pair.teamB.starters || [],
        players: pair.teamB.players || [],
        startersPoints: pair.teamB.starters_points || [],
        playersPoints: pair.teamB.players_points || {},
      },
      week: this.selectedWeek,
      season: this.league.season,
      leagueId: this.leagueId,
      status: display.status,
    }
  }

  closeMatchupModal() {
    this.selectedMatchupDetail = null
    this.modalStart = null
  }
}
