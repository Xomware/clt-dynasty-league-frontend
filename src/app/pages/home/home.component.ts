import { Component, OnInit, OnDestroy } from '@angular/core'
import { Router } from '@angular/router'
import { Subject, forkJoin } from 'rxjs'
import { takeUntil, filter, take, switchMap } from 'rxjs/operators'
import { SupabaseService } from 'src/app/services/supabase.service'
import { UserService } from 'src/app/services/user.service'
import { LeagueService } from 'src/app/services/league.service'
import { AuthService } from 'src/app/services/auth.service'
import { TeamService } from 'src/app/services/team.service'
import { StandingsService } from 'src/app/services/standings.service'
import { ToastService } from 'src/app/services/toast.service'
import { UserModel } from 'src/app/models/user.model'
import { RosterModel } from 'src/app/models/roster.model'
import { StandingsTeamModel } from 'src/app/models/standings.model'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  loading = false
  checkingAuth = true

  // Auth UI state
  authMode: 'options' | 'email' = 'options'
  emailMode: 'signin' | 'signup' = 'signin'
  email = ''
  password = ''
  confirmPassword = ''
  authError = ''

  private destroy$ = new Subject<void>()

  constructor(
    private supabaseService: SupabaseService,
    private userService: UserService,
    private leagueService: LeagueService,
    private authService: AuthService,
    private teamService: TeamService,
    private standingsService: StandingsService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Wait for Supabase to initialize
    this.supabaseService.initialized$
      .pipe(
        filter(init => init),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        const user = this.supabaseService.getUser()
        this.checkingAuth = false

        if (user) {
          this.handleAuthenticatedUser()
        }
      })

    // Fallback timeout
    setTimeout(() => {
      if (this.checkingAuth) {
        this.checkingAuth = false
      }
    }, 3000)
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private handleAuthenticatedUser(): void {
    this.loading = true

    // Get whitelisted user data (includes sleeper_username)
    this.supabaseService.getWhitelistedUser()
      .pipe(take(1))
      .subscribe(whitelistedUser => {
        if (whitelistedUser && whitelistedUser.sleeper_username) {
          // Look up Sleeper user by username
          this.userService.searchUser(whitelistedUser.sleeper_username)
            .pipe(take(1))
            .subscribe({
              next: (sleeperUser) => {
                if (sleeperUser) {
                  this.userService.setMyUser(sleeperUser)
                  this.authService.toggleAuthentication()
                  
                  // Load the whitelisted league as "My League"
                  this.loadMyLeague(sleeperUser.user_id)
                } else {
                  this.toastService.showNegativeToast('Sleeper user not found')
                  this.supabaseService.signOut().subscribe()
                  this.loading = false
                }
              },
              error: (err) => {
                console.error('Error loading Sleeper user:', err)
                this.toastService.showNegativeToast('Error loading profile')
                this.supabaseService.signOut().subscribe()
                this.loading = false
              }
            })
        } else if (whitelistedUser && !whitelistedUser.sleeper_username) {
          // Whitelisted but no Sleeper username set
          this.toastService.showNegativeToast('Sleeper username not configured. Contact admin.')
          this.supabaseService.signOut().subscribe()
          this.loading = false
        } else {
          // Not whitelisted
          this.toastService.showNegativeToast('Your email is not authorized.')
          this.supabaseService.signOut().subscribe()
          this.loading = false
        }
      })
  }

  /**
   * Load the whitelisted league and set up My Team
   */
  private loadMyLeague(userId: string): void {
    const whitelistedLeagueId = this.leagueService.getWhitelistedLeagueId()
    
    // Load league, users, and rosters in parallel
    this.leagueService.loadWhitelistedLeague()
      .pipe(
        take(1),
        switchMap(league => {
          this.leagueService.setMyLeague(league)
          league.setDivisions()

          // Load users and rosters
          return forkJoin({
            users: this.leagueService.findLeagueUsers(whitelistedLeagueId),
            rosters: this.leagueService.findLeagueRosters(whitelistedLeagueId),
            nflState: this.leagueService.getLeagueState()
          })
        })
      )
      .subscribe({
        next: ({ users, rosters, nflState }) => {
          const league = this.leagueService.getMyLeague()!
          
          // Set NFL state
          this.leagueService.setNflState(nflState)
          
          // Set users
          const userModels = users.map(user => new UserModel(user))
          league.setUsers(userModels)
          
          // Set rosters
          const rosterModels = rosters.map(roster => new RosterModel(roster))
          league.setRosters(rosterModels)

          // Build standings
          const standings = this.buildStandings(league, userModels, rosterModels)
          league.setStandingsTeams(standings)
          
          // Find and set My Team
          const myUser = this.userService.getMyUser()
          const myTeam = standings.find(team => team.user?.user_id === myUser?.getUserId())
          
          if (myTeam) {
            this.teamService.setMyTeam(myTeam)
          }

          // Update league in service
          this.leagueService.setMyLeague(league)

          this.toastService.showPositiveToast('Welcome back!')
          this.loading = false

          // Navigate to My Profile
          this.router.navigate(['/my-profile'], {
            queryParams: { userId: userId }
          })
        },
        error: (err) => {
          console.error('Error loading league:', err)
          this.toastService.showNegativeToast('Error loading league data')
          this.loading = false
          
          // Still navigate to profile even if league fails
          this.router.navigate(['/my-profile'], {
            queryParams: { userId: userId }
          })
        }
      })
  }

  /**
   * Build standings from rosters and users
   */
  private buildStandings(league: any, users: UserModel[], rosters: RosterModel[]): StandingsTeamModel[] {
    const standings = rosters.map(roster => {
      const user = users.find(u => u.user_id === roster.owner_id)

      // Parse streak from metadata
      let streakTotal = 0
      let streakType: '' | 'win' | 'loss' = ''
      if (roster.metadata?.streak) {
        const match = roster.metadata.streak.match(/(\d+)([WL])/)
        if (match) {
          streakTotal = parseInt(match[1], 10)
          streakType = match[2] === 'W' ? 'win' : 'loss'
        }
      }

      // Get division info
      const divisionIndex = roster.settings?.division != null
        ? `division_${roster.settings.division}`
        : null
      const divisionName = divisionIndex
        ? (league.metadata?.[divisionIndex] ?? 'Unknown Division')
        : 'Unknown Division'
      const divisionAvatar = divisionIndex
        ? (league.metadata?.[`${divisionIndex}_avatar`] ?? 'assets/img/nfl.png')
        : 'assets/img/nfl.png'

      return new StandingsTeamModel({
        roster,
        players: [],
        user: user ? new UserModel(user) : null!,
        league: league,
        teamName: user?.metadata?.team_name || `${user?.display_name}'s Team`,
        userName: user?.display_name || 'Unknown User',
        avatar: user?.avatar
          ? this.userService.buildAvatar(user.avatar)
          : 'assets/img/nfl.png',
        wins: roster.settings?.wins ?? 0,
        losses: roster.settings?.losses ?? 0,
        fpts: (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100,
        fptsAgainst: (roster.settings?.fpts_against ?? 0) + (roster.settings?.fpts_against_decimal ?? 0) / 100,
        streak: { type: streakType, total: streakTotal },
        divisionName,
        divisionAvatar,
        leagueRank: -1,
        divisionRank: -1,
      })
    })

    // Sort and assign ranks
    return this.standingsService.buildStandings(standings)
  }

  signInWithGoogle(): void {
    this.loading = true
    this.supabaseService.signInWithGoogle()
      .pipe(take(1))
      .subscribe(success => {
        if (!success) {
          this.loading = false
          this.toastService.showNegativeToast('Failed to start sign in')
        }
      })
  }

  showEmailForm(): void {
    this.authMode = 'email'
    this.emailMode = 'signin'
    this.authError = ''
    this.email = ''
    this.password = ''
    this.confirmPassword = ''
  }

  backToOptions(): void {
    this.authMode = 'options'
    this.authError = ''
  }

  toggleEmailMode(): void {
    this.emailMode = this.emailMode === 'signin' ? 'signup' : 'signin'
    this.authError = ''
    this.password = ''
    this.confirmPassword = ''
  }

  submitEmailAuth(): void {
    this.authError = ''

    if (!this.email.trim() || !this.password) {
      this.authError = 'Email and password are required.'
      return
    }

    if (this.emailMode === 'signup') {
      if (this.password.length < 6) {
        this.authError = 'Password must be at least 6 characters.'
        return
      }
      if (this.password !== this.confirmPassword) {
        this.authError = 'Passwords do not match.'
        return
      }

      this.loading = true
      this.supabaseService.signUpWithEmail(this.email.trim(), this.password)
        .pipe(take(1))
        .subscribe(result => {
          this.loading = false
          if (result.success) {
            this.toastService.showPositiveToast(result.message)
            if (result.message.includes('Check your email')) {
              // Email confirmation required - stay on the form
              this.emailMode = 'signin'
              this.password = ''
              this.confirmPassword = ''
            }
          } else {
            this.authError = result.message
          }
        })
    } else {
      this.loading = true
      this.supabaseService.signInWithEmail(this.email.trim(), this.password)
        .pipe(take(1))
        .subscribe(result => {
          if (result.success) {
            // Auth state change listener will trigger handleAuthenticatedUser
            this.handleAuthenticatedUser()
          } else {
            this.loading = false
            this.authError = result.message
          }
        })
    }
  }

  onEmailKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.submitEmailAuth()
    }
  }

  goToGuestSearch(): void {
    this.router.navigate(['/search'])
  }
}
