import { PlayerModel } from './player.model'
import { TaxiSquadPlayer } from './taxi-squad-player.interface'

export class TaxiSquadPlayerModel
  extends PlayerModel
  implements TaxiSquadPlayer
{
  rosterId!: number
  ownerUserId!: string
  ownerDisplayName!: string
  ownerUsername!: string
  ownerTeamName!: string
  draftRound?: number
  draftPickNo?: number
  declare photoError?: boolean

  constructor(base: PlayerModel, extras: Partial<TaxiSquadPlayer>) {
    super(base)
    Object.assign(this, extras)
  }
}
