import { Component } from '@angular/core'
import { Router } from '@angular/router'
import { take } from 'rxjs'
import { ToastService } from 'src/app/services/toast.service'
import { LeagueService } from 'src/app/services/league.service'
import { UserService } from 'src/app/services/user.service'

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent {
  loading = false
  searchMode: 'user' | 'league' = 'user'
  searchTerm = ''

  constructor(
    private LeagueService: LeagueService,
    private UserService: UserService,
    private router: Router,
    private ToastService: ToastService,
  ) {}

  search(): void {
    const term = this.searchTerm.trim()
    if (!term) return

    this.loading = true

    if (this.searchMode === 'user') {
      this.UserService.searchUser(term)
        .pipe(take(1))
        .subscribe({
          next: (user) => {
            if (!user || !user.user_id) {
              this.ToastService.showNegativeToast('No user found.')
              this.loading = false
              return
            }
            this.loading = false
            this.router.navigate(['/selected-profile'], {
              queryParams: { userId: user.user_id },
            })
          },
          error: () => {
            this.ToastService.showNegativeToast('No user found.')
            this.loading = false
          },
        })
    } else {
      this.LeagueService.searchLeague(term)
        .pipe(take(1))
        .subscribe({
          next: (league) => {
            if (!league) {
              this.ToastService.showNegativeToast('No league found.')
              this.loading = false
              return
            }
            this.LeagueService.setCurrentLeague(league)
            this.loading = false
            this.router.navigate(['/selected-league'], {
              queryParams: { leagueId: league.getId(), view: 'league' },
            })
          },
          error: () => {
            this.ToastService.showNegativeToast('No league found.')
            this.loading = false
          },
        })
    }
  }
}
