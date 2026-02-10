export interface MatchupDetailTeam {
  teamName: string
  userName: string
  avatar: string
  wins: number
  losses: number
  totalPoints: number
  rosterId: number
  starters: string[]
  players: string[]
  startersPoints: number[]
  playersPoints: Record<string, number>
}

export interface MatchupDetailInput {
  teamA: MatchupDetailTeam
  teamB: MatchupDetailTeam
  week: number
  season: string
  leagueId: string
  status: string
}
