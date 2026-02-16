// taxi-squad.interface.ts
import { Player } from './player.interface'

export interface TaxiSquadPlayer extends Player {
  rosterId: number // which roster owns them
  ownerUserId: string // user_id from Sleeper
  ownerDisplayName: string // from LeagueService (user metadata)
  ownerUsername: string // sleeper username for email lookup
  ownerTeamName: string // team name from roster metadata
  draftRound?: number // round they were drafted in (if found)
  draftPickNo?: number // optional extra info
  photoError?: boolean
}
