import { Component, OnDestroy } from '@angular/core'
import { LeagueService } from './services/league.service'
import { UserService } from './services/user.service'
import { TeamService } from './services/team.service'
import { PlayerService } from './services/player.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnDestroy {
  title = 'XOMPER'

  constructor(
    private leagueService: LeagueService,
    private userService: UserService,
    private teamService: TeamService,
    private playerService: PlayerService,
  ) {}

  ngOnDestroy(): void {
    this.leagueService.reset()
    this.userService.reset()
    this.teamService.reset()
    this.playerService.reset()
  }
}
