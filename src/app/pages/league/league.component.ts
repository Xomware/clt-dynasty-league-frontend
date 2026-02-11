import { Component, Input, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { forkJoin, switchMap, take } from 'rxjs'
import { LeagueService } from 'src/app/services/league.service'
import {
  LeagueHistoryService,
  WorldCupDivision,
} from 'src/app/services/league-history.service'
import { RulesService, RuleProposal } from 'src/app/services/rules.service'
import { StandingsService } from 'src/app/services/standings.service'
import { ToastService } from 'src/app/services/toast.service'
import { TeamService } from 'src/app/services/team.service'
import { UserService } from 'src/app/services/user.service'
import { SupabaseService } from 'src/app/services/supabase.service'
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
  league: LeagueModel
  leaguePicture = ''
  leagueName = ''
  leagueId = ''
  leaguePlayoffTeams: number = 0
  leagueUsers
  leagueRosters: RosterModel[] = []
  standings: StandingsTeamModel[] = []
  standingsByDivision: { [division: string]: StandingsTeamModel[] }
  loading = false
  activeTab: 'standings' | 'matchups' | 'playoffs' | 'worldcup' | 'rules' =
    'standings'
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

  // Rules
  rulesLoaded = false
  scoringCategories: {
    name: string
    settings: { key: string; label: string; value: number }[]
  }[] = []
  rosterSlots: { position: string; count: number }[] = []
  proposals: RuleProposal[] = []
  proposalFilter: 'all' | 'open' | 'approved' | 'rejected' = 'all'
  showProposalForm = false
  proposalTitle = ''
  proposalDescription = ''
  submittingProposal = false
  expandedRuleSections: Set<number> = new Set()
  recentlyStamped: Set<string> = new Set()

  // Approval threshold: 2/3 vote of league size
  get approvalThreshold(): number {
    return Math.ceil(((this.league?.total_rosters || 12) * 2) / 3)
  }
  get denialThreshold(): number {
    return (this.league?.total_rosters || 12) - this.approvalThreshold + 1
  }

  static readonly LEAGUE_RULES: { title: string; content: string }[] = [
    {
      title: '1. League Setup',
      content: `<strong>A. Divisions</strong><br>Three divisions of 4. Divisions are set for four years then reset based on standings in the fourth year regular season.<br><br><em>Division realignment by finish:</em><br>ACC: #1 (Winner), #6, #7, #12 (Last)<br>SEC: #2, #5, #8, #11<br>Big 10: #3, #4, #9, #10<br><br><strong>World Cup Tournament</strong><br>Every four years there is a season-long in-season tournament. Top 2 teams from each division over the first 3 years compete in a 6-team tournament during the 4th year. Only intra-divisional games count. Tiebreaker: overall record, then H2H, then total points.<br><br><em>Rounds:</em><br>Round 1: Total points weeks 3-6. Top 4 advance.<br>Round 2: #1 vs #4, #2 vs #3. Aggregate points weeks 7-10.<br>Round 3: Winners aggregate points weeks 11-14.<br><br><strong>B. Fantasy Host Site</strong> &mdash; Sleeper.app`,
    },
    {
      title: '2. Schedule & Season Format',
      content: `<strong>A. Regular Season</strong><br>Week 14 is the last week of the regular season.<br><br><strong>B. Playoffs</strong><br>Playoffs begin Week 15 and end Week 17 (1-week matchups). In a tie, the higher seed wins. 6 teams make the playoffs: top team from each division seeded 1-3, plus 3 wild card spots. Overall record determines standings; tiebreaker is total points for.<br><br>No consolation games or 3rd place match. Eliminated teams are ranked by seed at time of elimination.<br><br><strong>C. Offseason</strong><br>No free agency adds during offseason &mdash; only via Rookie/FA draft. Trading of players and picks is allowed. Roster cuts due by midnight the Sunday after NFL preseason concludes.`,
    },
    {
      title: '3. Roster Rules, Trading & Add/Drops',
      content: `<strong>A. Roster Sizes</strong> &mdash; 26 active + 4 taxi + 8 IR<br><br><strong>B. Starting Requirements</strong><br>1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX (RB/WR/TE), 1 SUPERFLEX (QB/RB/WR/TE)<br><br>No purposely starting bye/injured/inactive players to tank. Active players must be used. $5 penalty for playing an inactive player while tanking (goes to winner's pot).<br><br><strong>C. Taxi Squad Steals</strong><br>Teams can steal another team's taxi player with draft pick compensation:<br><table class="rules-table"><tr><th>Round Taken</th><th>Minimum Cost</th></tr><tr><td>1st</td><td>1st + 2nd round pick</td></tr><tr><td>2nd</td><td>1st round pick</td></tr><tr><td>3rd</td><td>2nd round pick</td></tr><tr><td>4th</td><td>3rd round pick</td></tr><tr><td>5th</td><td>4th round pick</td></tr><tr><td>Undrafted</td><td>5th round pick</td></tr></table><br>Owner can promote the taxi player before Thursday 12pm EST to nullify the steal.<br><br><strong>D. Injured Reserve</strong> &mdash; 8 IR slots per team.<br><br><strong>E. Trading</strong><br>Trades can be uneven. Rosters must be adjusted to 26 active immediately. Vetoes require unanimous vote with evidence of collusion. Picks up to 2 years out can be traded.<br><br><strong>F. Trade Deadline</strong> &mdash; 2 weeks after NFL trade deadline (Tuesday after Week 10 at noon).<br><br><strong>G. Add/Drops</strong> &mdash; Deadline at conclusion of regular season. No adds once the first game of the week starts.<br><br><strong>H. Roster Cuts</strong> &mdash; By midnight Sunday after NFL preseason. Max: 26 active + 4 taxi + 8 IR = 38 total.<br><br><strong>I. Waivers</strong> &mdash; Dropped players clear waivers by Wednesday morning. Waiver order does not reset; claiming moves you to the back.`,
    },
    {
      title: '4. Scoring',
      content: `<strong>QB, RB, WR, TE Scoring:</strong><br><table class="rules-table"><tr><th>Event</th><th>Points</th></tr><tr><td>Passing TD</td><td>4 pts</td></tr><tr><td>Passing Yards</td><td>1 per 25 yds (0.04/yd)</td></tr><tr><td>Interception Thrown</td><td>-2 pts</td></tr><tr><td>Pass 2PT Conversion</td><td>2 pts</td></tr><tr><td>Rushing TD</td><td>6 pts</td></tr><tr><td>Rushing Yards</td><td>1 per 10 yds (0.1/yd)</td></tr><tr><td>Rush 2PT Conversion</td><td>2 pts</td></tr><tr><td>Receiving TD</td><td>6 pts</td></tr><tr><td>Receiving Yards</td><td>1 per 10 yds (0.1/yd)</td></tr><tr><td>Receptions (PPR)</td><td>1 pt (TE: 1.5 pts)</td></tr><tr><td>Rec 2PT Conversion</td><td>2 pts</td></tr><tr><td>Punt/Kick Return TD</td><td>6 pts</td></tr><tr><td>Fumble Lost</td><td>-2 pts</td></tr></table>`,
    },
    {
      title: '5. Draft Information',
      content: `<strong>A. Startup Draft</strong> &mdash; Snake draft, order randomized.<br><br><strong>B. Rookie Draft</strong><br>Not a snake draft. Last place gets 1.01, 2.01, 3.01, 4.01, 5.01. Picks are tradeable. Any free agents not added before the championship add/drop deadline are also eligible.<br><br><strong>C. Draft Order</strong><br>Non-playoff teams: determined by overall record.<br>Playoff teams: determined by playoff performance. Eliminated teams with worse seeds get better picks.`,
    },
    {
      title: '6. Dues & Payouts',
      content: `<strong>A. Dues</strong> &mdash; $100 per season.<br><br><strong>B. Payout Structure:</strong><br><table class="rules-table"><tr><th>Award</th><th>Payout</th></tr><tr><td>Champion</td><td>$600</td></tr><tr><td>2nd Place</td><td>$200</td></tr><tr><td>3rd Place</td><td>$80</td></tr><tr><td>4th Place</td><td>$80</td></tr><tr><td>Highest Weekly Score (x14)</td><td>$10 each</td></tr><tr><td>World Cup Winner (every 4 yrs)</td><td>$400</td></tr></table><br>MVP awards for positional leaders (player must have been started that week to count).`,
    },
    {
      title: '7. Rule Changes',
      content: `<strong>2/3 Vote Required</strong><br>Rule change voting occurs in the offseason. At least 8 owners (of 12) must vote in favor for a rule change to become permanent.<br><br>A <strong>100% unanimous vote</strong> can enact a rule effective immediately.`,
    },
  ]

  constructor(
    private LeagueService: LeagueService,
    private LeagueHistoryService: LeagueHistoryService,
    private RulesService: RulesService,
    private router: Router,
    private ToastService: ToastService,
    private StandingsService: StandingsService,
    private TeamService: TeamService,
    private UserService: UserService,
    private supabaseService: SupabaseService,
    private route: ActivatedRoute,
  ) {}

  get currentUserId(): string | undefined {
    return this.supabaseService.getUser()?.id
  }

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
      // Check for tab query param (e.g., from toolbar "Rules" link)
      this.route.queryParams.pipe(take(1)).subscribe((params) => {
        const tab = params['tab']
        if (
          tab &&
          ['standings', 'matchups', 'playoffs', 'worldcup', 'rules'].includes(
            tab,
          )
        ) {
          this.setTab(tab)
        }
      })
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

  setTab(tab: 'standings' | 'matchups' | 'playoffs' | 'worldcup' | 'rules') {
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
    if (tab === 'rules' && !this.rulesLoaded) {
      this.loadRules()
    }
  }

  // ---- PLAYOFFS BRACKET ----

  loadPlayoffBracket(): void {
    this.loading = true
    forkJoin({
      winners: this.LeagueService.getWinnersBracket(this.leagueId),
      losers: this.LeagueService.getLosersBracket(this.leagueId),
    })
      .pipe(take(1))
      .subscribe({
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
        },
      })
  }

  private groupBracketByRound(
    matches: PlayoffBracketMatch[],
  ): { round: number; matches: PlayoffBracketMatch[] }[] {
    const roundMap = new Map<number, PlayoffBracketMatch[]>()
    matches.forEach((m) => {
      if (!roundMap.has(m.r)) roundMap.set(m.r, [])
      roundMap.get(m.r)!.push(m)
    })
    return Array.from(roundMap.entries())
      .map(([round, matches]) => ({ round, matches }))
      .sort((a, b) => a.round - b.round)
  }

  getTeamName(rosterId: number | null): string {
    if (!rosterId) return 'TBD'
    const team = this.standings.find((s) => s.roster.roster_id === rosterId)
    return team?.teamName || `Roster ${rosterId}`
  }

  getTeamAvatar(rosterId: number | null): string {
    if (!rosterId) return 'assets/img/nfl.png'
    const team = this.standings.find((s) => s.roster.roster_id === rosterId)
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
    this.LeagueService.getLeagueChain(this.leagueId)
      .pipe(
        switchMap((chain) =>
          this.LeagueHistoryService.getMatchupHistoryFromChain(chain).pipe(
            take(1),
            switchMap((matchups) => {
              this.worldCupDivisions =
                this.LeagueHistoryService.getWorldCupStandings(chain, matchups)
              // Gather unique seasons
              this.worldCupSeasons = [
                ...new Set(matchups.map((m) => m.season)),
              ].sort((a, b) => parseInt(a) - parseInt(b))
              return [this.worldCupDivisions]
            }),
          ),
        ),
        take(1),
      )
      .subscribe({
        next: () => {
          // Build dynamic grid columns: base + one column per season
          const seasonCols = this.worldCupSeasons.map(() => '0.8fr').join(' ')
          this.wcGridColumns =
            `40px 2fr 0.6fr 0.6fr 1fr 1fr ${seasonCols}`.trim()
          this.worldCupLoaded = true
          this.loading = false
        },
        error: () => {
          this.ToastService.showNegativeToast(
            'Error loading World Cup standings.',
          )
          this.loading = false
        },
      })
  }

  getSeasonBreakdown(
    team: any,
    season: string,
  ): { wins: number; losses: number } {
    const sb = team.seasonBreakdown?.find((s: any) => s.season === season)
    return sb || { wins: 0, losses: 0 }
  }

  // ---- RULES ----

  private static readonly SCORING_KEY_LABELS: Record<string, string> = {
    pass_yd: 'Pass Yards',
    pass_td: 'Pass TD',
    pass_int: 'Interception',
    pass_2pt: 'Pass 2PT',
    pass_att: 'Pass Attempts',
    pass_cmp: 'Completions',
    pass_inc: 'Incompletions',
    rush_yd: 'Rush Yards',
    rush_td: 'Rush TD',
    rush_2pt: 'Rush 2PT',
    rush_att: 'Rush Attempts',
    rec: 'Receptions',
    rec_yd: 'Rec Yards',
    rec_td: 'Rec TD',
    rec_2pt: 'Rec 2PT',
    bonus_rec_te: 'TE Premium',
    bonus_rec_wr: 'WR Bonus',
    bonus_rec_rb: 'RB Rec Bonus',
    bonus_rush_yd_100: '100+ Rush Yds',
    bonus_rec_yd_100: '100+ Rec Yds',
    bonus_pass_yd_300: '300+ Pass Yds',
    pr_td: 'Punt Return TD',
    kr_td: 'Kick Return TD',
    fum: 'Fumble',
    fum_lost: 'Fumble Lost',
    fum_rec: 'Fumble Recovery',
    fum_rec_td: 'Fumble Rec TD',
    fg_0_19: 'FG 0-19',
    fg_20_29: 'FG 20-29',
    fg_30_39: 'FG 30-39',
    fg_40_49: 'FG 40-49',
    fg_50p: 'FG 50+',
    fg_miss: 'FG Miss',
    fg_miss_0_19: 'FG Miss 0-19',
    fg_miss_20_29: 'FG Miss 20-29',
    fg_miss_30_39: 'FG Miss 30-39',
    fg_miss_40_49: 'FG Miss 40-49',
    fg_miss_50p: 'FG Miss 50+',
    xpm: 'XP Made',
    xpmiss: 'XP Missed',
    sack: 'Sack',
    int: 'INT',
    ff: 'Forced Fumble',
    def_td: 'Defensive TD',
    safe: 'Safety',
    blk_kick: 'Blocked Kick',
    pts_allow_0: '0 Pts Allowed',
    pts_allow_1_6: '1-6 Pts Allowed',
    pts_allow_7_13: '7-13 Pts Allowed',
    pts_allow_14_20: '14-20 Pts Allowed',
    pts_allow_21_27: '21-27 Pts Allowed',
    pts_allow_28_34: '28-34 Pts Allowed',
    pts_allow_35p: '35+ Pts Allowed',
    st_td: 'ST TD',
    st_ff: 'ST Forced Fumble',
    st_fum_rec: 'ST Fumble Rec',
    def_st_td: 'Def/ST TD',
    def_st_ff: 'Def/ST FF',
    def_st_fum_rec: 'Def/ST Fum Rec',
  }

  private static readonly SCORING_CATEGORIES: {
    name: string
    prefixes: string[]
  }[] = [
    { name: 'Passing', prefixes: ['pass_'] },
    { name: 'Rushing', prefixes: ['rush_'] },
    { name: 'Receiving', prefixes: ['rec', 'bonus_rec'] },
    { name: 'Return TDs', prefixes: ['pr_', 'kr_'] },
    { name: 'Fumbles', prefixes: ['fum'] },
    { name: 'Kicking', prefixes: ['fg_', 'xp'] },
    {
      name: 'Defense / ST',
      prefixes: [
        'sack',
        'int',
        'ff',
        'def_',
        'safe',
        'blk_',
        'pts_allow',
        'st_',
      ],
    },
  ]

  loadRules(): void {
    if (!this.league) return

    // Parse scoring settings into categories
    const scoring = this.league.getScoringSettings()
    const usedKeys = new Set<string>()

    this.scoringCategories = LeagueComponent.SCORING_CATEGORIES.map((cat) => {
      const settings = Object.entries(scoring)
        .filter(
          ([key]) =>
            cat.prefixes.some((p) => key.startsWith(p)) && !usedKeys.has(key),
        )
        .map(([key, value]) => {
          usedKeys.add(key)
          return {
            key,
            label:
              LeagueComponent.SCORING_KEY_LABELS[key] ||
              this.formatScoringKey(key),
            value,
          }
        })
        .filter((s) => s.value !== 0)
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      return { name: cat.name, settings }
    }).filter((cat) => cat.settings.length > 0)

    // Bonus category for uncategorized
    const bonusSettings = Object.entries(scoring)
      .filter(([key]) => !usedKeys.has(key) && scoring[key] !== 0)
      .map(([key, value]) => ({
        key,
        label:
          LeagueComponent.SCORING_KEY_LABELS[key] || this.formatScoringKey(key),
        value,
      }))
    if (bonusSettings.length > 0) {
      this.scoringCategories.push({ name: 'Other', settings: bonusSettings })
    }

    // Parse roster positions
    const positions = this.league.getRosterPositions()
    const positionCounts = new Map<string, number>()
    positions.forEach((pos) => {
      if (pos === 'BN') return
      positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1)
    })
    this.rosterSlots = Array.from(positionCounts.entries()).map(
      ([position, count]) => ({ position, count }),
    )
    const benchCount = positions.filter((p) => p === 'BN').length
    if (benchCount > 0) {
      this.rosterSlots.push({ position: 'BN', count: benchCount })
    }

    // Load proposals from Supabase
    this.loadProposals()

    this.rulesLoaded = true
  }

  private formatScoringKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  loadProposals(): void {
    this.RulesService.getProposals(this.leagueId)
      .pipe(take(1))
      .subscribe({
        next: (proposals) => {
          this.proposals = proposals
          this.checkThresholds()
        },
      })
  }

  submitProposal(): void {
    if (!this.proposalTitle.trim()) return
    this.submittingProposal = true
    this.RulesService.createProposal(
      this.leagueId,
      this.proposalTitle.trim(),
      this.proposalDescription.trim(),
    )
      .pipe(take(1))
      .subscribe({
        next: (success) => {
          if (success) {
            this.proposalTitle = ''
            this.proposalDescription = ''
            this.showProposalForm = false
            this.ToastService.showPositiveToast('Proposal submitted!')
            this.loadProposals()
          } else {
            this.ToastService.showNegativeToast('Failed to submit proposal.')
          }
          this.submittingProposal = false
        },
        error: () => {
          this.ToastService.showNegativeToast('Failed to submit proposal.')
          this.submittingProposal = false
        },
      })
  }

  castVote(proposalId: string, vote: 'yes' | 'no'): void {
    this.RulesService.castVote(proposalId, vote)
      .pipe(take(1))
      .subscribe({
        next: (success) => {
          if (success) {
            this.loadProposals()
          } else {
            this.ToastService.showNegativeToast('Failed to cast vote.')
          }
        },
      })
  }

  toggleRuleSection(index: number): void {
    if (this.expandedRuleSections.has(index)) {
      this.expandedRuleSections.delete(index)
    } else {
      this.expandedRuleSections.add(index)
    }
  }

  get filteredProposals(): RuleProposal[] {
    if (this.proposalFilter === 'all') return this.proposals
    return this.proposals.filter((p) => p.status === this.proposalFilter)
  }

  get leagueRules() {
    return LeagueComponent.LEAGUE_RULES
  }

  private checkThresholds(): void {
    this.proposals.forEach((p) => {
      if (p.status !== 'open') return
      if (p.yes_count >= this.approvalThreshold) {
        this.recentlyStamped.add(p.id)
        this.RulesService.updateProposalStatus(p.id, 'approved')
          .pipe(take(1))
          .subscribe({
            next: (success) => {
              if (success) {
                p.status = 'approved'
                this.ToastService.showPositiveToast(
                  `"${p.title}" has been APPROVED!`,
                )
              }
            },
          })
      } else if (p.no_count >= this.denialThreshold) {
        this.recentlyStamped.add(p.id)
        this.RulesService.updateProposalStatus(p.id, 'rejected')
          .pipe(take(1))
          .subscribe({
            next: (success) => {
              if (success) {
                p.status = 'rejected'
                this.ToastService.showNegativeToast(
                  `"${p.title}" has been DENIED.`,
                )
              }
            },
          })
      }
    })
  }

  deleteProposal(proposalId: string): void {
    this.RulesService.deleteProposal(proposalId)
      .pipe(take(1))
      .subscribe({
        next: (success) => {
          if (success) {
            this.ToastService.showPositiveToast('Proposal deleted.')
            this.loadProposals()
          } else {
            this.ToastService.showNegativeToast('Failed to delete proposal.')
          }
        },
      })
  }

  getProposalDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
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
