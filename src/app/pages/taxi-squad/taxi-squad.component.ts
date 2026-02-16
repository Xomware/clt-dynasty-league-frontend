import { Component, OnInit } from '@angular/core'
import { ToastService } from 'src/app/services/toast.service'
import { LeagueService } from 'src/app/services/league.service'
import { TaxiSquadService } from 'src/app/services/taxi-squad.service'
import { DraftService } from 'src/app/services/draft.service'
import { TaxiSquadPlayerModel } from 'src/app/models/taxi-squad-player.model'
import { LeagueModel } from 'src/app/models/league.model'
import { SupabaseService } from 'src/app/services/supabase.service'
import { TEAM_COLORS } from 'src/app/constants/team-colors'

@Component({
  selector: 'app-taxi-squad',
  templateUrl: './taxi-squad.component.html',
  styleUrls: ['./taxi-squad.component.scss'],
})
export class TaxiSquadComponent implements OnInit {
  league!: LeagueModel
  taxiPlayers: TaxiSquadPlayerModel[] = []
  loading = false
  selectedPlayer: TaxiSquadPlayerModel | null = null
  stolenPlayerIds = new Set<string>()
  mySleeperUserId = ''
  modalStart!: {
    top: number
    left: number
    width: number
    height: number
  } | null

  POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
  tabs = [
    { key: 'round', label: 'Draft Round' },
    { key: 'position', label: 'Position' },
    { key: 'owner', label: 'Owner' },
  ]
  selectedTab = 'round'

  // Cached grouped results to prevent change detection re-renders
  cachedByRound: { round: number; players: TaxiSquadPlayerModel[] }[] = []
  cachedByPosition: { position: string; players: TaxiSquadPlayerModel[] }[] = []
  cachedByOwner: { ownerDisplayName: string; ownerTeamName: string | undefined; players: TaxiSquadPlayerModel[] }[] = []

  constructor(
    private ToastService: ToastService,
    private LeagueService: LeagueService,
    private TaxiSquadService: TaxiSquadService,
    private DraftService: DraftService,
    private supabaseService: SupabaseService,
  ) {}

  ngOnInit(): void {
    this.league = this.LeagueService.getMyLeague()
    this.mySleeperUserId = this.supabaseService.getProfile()?.sleeper_user_id || ''
    this.loadTaxiPlayers()
    this.loadStealRequests()
  }

  loadTaxiPlayers(): void {
    if (!this.league) return

    this.loading = true

    // Step 1: Ensure all drafts + picks for this league are loaded
    this.DraftService.loadDraftsAndPicks(this.league.league_id).subscribe({
      next: () => {
        // Step 2: Build Taxi Squad players from service
        this.TaxiSquadService.loadTaxiSquadPlayers(
          this.league.league_id
        ).subscribe({
          next: (players) => {
            this.taxiPlayers = players
            this.sortPlayers()
            this.rebuildGroupCaches()
            this.ToastService.showPositiveToast(
              'Taxi Squad Loaded Successfully.'
            )
          },
          error: (err) => {
            console.error('Error building Taxi Squad:', err)
            this.ToastService.showNegativeToast('Failed to build Taxi Squad.')
          },
          complete: () => {
            this.loading = false
          },
        })
      },
      error: (err) => {
        console.error('Error loading drafts:', err)
        this.ToastService.showNegativeToast('Failed to load draft data.')
        this.loading = false
      },
    })
  }

  loadStealRequests(): void {
    if (!this.league) return
    this.TaxiSquadService.getStealRequests(this.league.league_id).subscribe({
      next: (ids) => {
        this.stolenPlayerIds = ids
      },
    })
  }

  sortPlayers() {
    this.taxiPlayers.sort((a, b) => {
      const aIndex = this.POSITION_ORDER.indexOf(a.position)
      const bIndex = this.POSITION_ORDER.indexOf(b.position)
      return (aIndex >= 0 ? aIndex : 99) - (bIndex >= 0 ? bIndex : 99)
    })
  }

  openPlayerModal(player: TaxiSquadPlayerModel, event: MouseEvent) {
    const card = (event.currentTarget as HTMLElement).getBoundingClientRect()
    this.modalStart = {
      top: card.top,
      left: card.left,
      width: card.width,
      height: card.height,
    }
    this.selectedPlayer = player
  }

  closePlayerModal() {
    this.selectedPlayer = null
    this.modalStart = null
  }

  onStealComplete(playerId: string) {
    this.stolenPlayerIds.add(playerId)
    this.closePlayerModal()
  }

  getTeamStyle(team: string | undefined) {
    if (!team) return { backgroundColor: '#2a2a2a', border: '2px solid #444' }

    const colors = TEAM_COLORS[team.toLowerCase()]
    if (!colors) return { backgroundColor: '#2a2a2a', border: '2px solid #444' }

    return {
      background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
      color: '#fff',
    }
  }

  getTeamButtonStyle(team: string | undefined) {
    if (!team) return { background: '#444', color: '#fff' }

    const colors = TEAM_COLORS[team.toLowerCase()]
    if (!colors) return { background: '#444', color: '#fff' }

    return {
      backgroundColor: colors.primary,
      color: '#fff',
      border: 'none',
      borderRadius: '20px',
      padding: '6px 14px',
      fontWeight: 'bold',
      cursor: 'pointer',
    }
  }
  // Rebuild cached groupings (called once after data loads)
  rebuildGroupCaches() {
    // By Round
    const rounds = [
      ...new Set(this.taxiPlayers.map((p) => p.draftRound ?? -1)),
    ].sort((a, b) => {
      if (a === -1) return 1
      if (b === -1) return -1
      return a - b
    })
    this.cachedByRound = rounds.map((r) => ({
      round: r,
      players: this.taxiPlayers.filter((p) => (p.draftRound ?? -1) === r),
    }))

    // By Position
    const order = ['QB', 'RB', 'WR', 'TE']
    this.cachedByPosition = order.map((pos) => ({
      position: pos,
      players: this.taxiPlayers.filter((p) => p.position === pos),
    }))

    // By Owner
    const owners = [...new Set(this.taxiPlayers.map((p) => p.ownerDisplayName))]
    this.cachedByOwner = owners.map((owner) => ({
      ownerDisplayName: owner,
      ownerTeamName: this.taxiPlayers.find((p) => p.ownerDisplayName === owner)
        ?.ownerTeamName,
      players: this.taxiPlayers.filter((p) => p.ownerDisplayName === owner),
    }))
  }

  trackByPlayerId(index: number, player: TaxiSquadPlayerModel): string {
    return player.player_id
  }
}
