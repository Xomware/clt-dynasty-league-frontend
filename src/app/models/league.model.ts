import { League } from './league.interface'
import { RosterModel } from './roster.model'
import { StandingsTeamModel } from './standings.model'
import { UserModel } from './user.model'

export class LeagueModel implements League {
  league_id!: string
  name!: string
  season!: string
  users: UserModel[] = []
  rosters: RosterModel[] = []
  season_type!: string
  sport!: string
  status!: string
  total_rosters!: number
  shard!: number
  draft_id!: string
  previous_league_id!: string | null
  bracket_id?: string | null
  group_id?: string | null
  avatar!: string | null
  divisions: string[] = []
  divisionAvatars: string[] = []
  taxiSquadIds: string[] = []
  standingsTeams: StandingsTeamModel[] = []

  scoring_settings!: Record<string, number>
  roster_positions!: string[]

  settings!: {
    daily_waivers?: number
    daily_waiver_hour?: number
    playoff_round_type?: number
    playoff_teams?: number
    playoff_seed_type?: number
    waiver_type?: number
    reserve_slots?: number
    taxi_slots?: number
    trade_deadline?: number
    max_keepers?: number
    draft_rounds?: number
    num_teams?: number
    [key: string]: unknown
  }

  metadata!: {
    latest_league_winner_roster_id?: string
    [key: string]: unknown
  } | null

  constructor(data: League) {
    Object.assign(this, data)
  }

  getProfilePicture(): string {
    return this.avatar
      ? `https://sleepercdn.com/avatars/${this.avatar}`
      : 'assets/img/nfl.png'
  }

  getId(): string {
    return this.league_id
  }

  getDisplayName(): string {
    return this.name || `League ${this.league_id}`
  }

  setDivisions(): void {
    if (!this.metadata) {
      return
    }
    const divisionKeys = Object.keys(this.metadata).filter((key) =>
      key.startsWith('division_') && !key.endsWith('_avatar')
    )
    this.divisions = divisionKeys.map((key) => this.metadata![key] as string)
    const divisionAvatarKeys = Object.keys(this.metadata).filter(
      (key) => key.startsWith('division_') && key.endsWith('_avatar')
    )
    this.divisionAvatars = divisionAvatarKeys.map((key) => this.metadata![key] as string)
  }

  getDivisions(): string[] {
    return this.divisions
  }

  getSeasonType(): string {
    return this.season_type
  }

  isDynasty(): boolean {
    return (this.settings as Record<string, unknown>)?.['type'] === 2 || this.metadata?.['dynasty'] === '1' || false
  }

  getPlayoffTeams(): number {
    return this.settings?.playoff_teams ?? 0
  }

  getTaxiSlots(): number {
    return this.settings?.taxi_slots ?? 0
  }

  getReserveSlots(): number {
    return this.settings?.reserve_slots ?? 0
  }

  getScoringSettings(): Record<string, number> {
    return this.scoring_settings ?? {}
  }

  getRosterPositions(): string[] {
    return this.roster_positions ?? []
  }

  getWinnerRosterId(): string | null {
    return this.metadata?.latest_league_winner_roster_id ?? null
  }

  setUsers(users: UserModel[]): void {
    this.users = users
  }

  getUsers(): UserModel[] {
    return this.users
  }

  setRosters(rosters: RosterModel[]): void {
    this.rosters = rosters
  }

  getRosters(): RosterModel[] {
    return this.rosters
  }

  setTaxiSquadIds(ids: string[]): void {
    this.taxiSquadIds = ids
  }

  getTaxiSquadIds(): string[] {
    return this.taxiSquadIds
  }

  setStandingsTeams(standingsTeams: StandingsTeamModel[]): void {
    this.standingsTeams = standingsTeams
  }

  getStandingsTeams(): StandingsTeamModel[] {
    return this.standingsTeams
  }
}
