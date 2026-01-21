import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter, take, switchMap } from 'rxjs/operators';
import { SupabaseService } from 'src/app/services/supabase.service';
import { UserService } from 'src/app/services/user.service';
import { LeagueService } from 'src/app/services/league.service';
import { AuthService } from 'src/app/services/auth.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  loading = false;
  checkingAuth = true;

  private destroy$ = new Subject<void>();

  constructor(
    private supabaseService: SupabaseService,
    private userService: UserService,
    private leagueService: LeagueService,
    private authService: AuthService,
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
        const user = this.supabaseService.getUser();
        this.checkingAuth = false;

        if (user) {
          this.handleAuthenticatedUser();
        }
      });

    // Fallback timeout
    setTimeout(() => {
      if (this.checkingAuth) {
        this.checkingAuth = false;
      }
    }, 3000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private handleAuthenticatedUser(): void {
    this.loading = true;

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
                  this.userService.setMyUser(sleeperUser);
                  this.authService.toggleAuthentication();
                  this.toastService.showPositiveToast('Welcome back!');
                  
                  this.router.navigate(['/my-profile'], {
                    queryParams: { userId: sleeperUser.user_id }
                  });
                } else {
                  this.toastService.showNegativeToast('Sleeper user not found');
                  this.supabaseService.signOut().subscribe();
                }
                this.loading = false;
              },
              error: (err) => {
                console.error('Error loading Sleeper user:', err);
                this.toastService.showNegativeToast('Error loading profile');
                this.supabaseService.signOut().subscribe();
                this.loading = false;
              }
            });
        } else if (whitelistedUser && !whitelistedUser.sleeper_username) {
          // Whitelisted but no Sleeper username set
          this.toastService.showNegativeToast('Sleeper username not configured. Contact admin.');
          this.supabaseService.signOut().subscribe();
          this.loading = false;
        } else {
          // Not whitelisted
          this.toastService.showNegativeToast('Your email is not authorized.');
          this.supabaseService.signOut().subscribe();
          this.loading = false;
        }
      });
  }

  signInWithGoogle(): void {
    this.loading = true;
    this.supabaseService.signInWithGoogle()
      .pipe(take(1))
      .subscribe(success => {
        if (!success) {
          this.loading = false;
          this.toastService.showNegativeToast('Failed to start sign in');
        }
      });
  }

  goToGuestSearch(): void {
    this.router.navigate(['/search']);
  }
}
