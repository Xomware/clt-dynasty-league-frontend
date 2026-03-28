import { Draft, DraftPick, DraftSettings, DraftMetadata } from './draft.interface'

export class DraftModel implements Draft {
  draft_id!: string
  league_id!: string
  type!: string
  status!: string
  start_time!: number
  sport!: string
  settings!: DraftSettings
  season_type!: string
  season!: string
  metadata!: DraftMetadata
  last_picked!: number
  last_message_time!: number
  last_message_id!: string
  draft_order!: Record<string, number> | null
  creators!: string[] | null
  created!: number
  picks: DraftPick[] = []

  constructor(data: Draft) {
    Object.assign(this, data)
  }

  addPicks(picks: DraftPick[]): void {
    this.picks = picks
  }
}
