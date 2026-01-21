import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, filter, take } from 'rxjs/operators';
import { SupabaseService } from 'src/app/services/supabase.service';
import { ToastService } from 'src/app/services/toast.service';
import { AuthService } from 'src/app/services/auth.service';

type AuthMode = 'landing' | 'guest-search';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {
  mode: AuthMode = 'landing';
  loading = false;
  checkingAuth = true;

  // Guest search fields
  searchType: 'league' | 'user' = 'league';
  searchTerm = '';

  private destroy$ = new Subject<void>();

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Wait for Supabase to initialize, then check if user is already logged in
    this.supabaseService.initialized$
      .pipe(
        filter(initialized => initialized),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.checkingAuth = false;
        const user = this.supabaseService.getUser();
        
        if (user) {
          console.log('User already logged in:', user.email);
          this.handleAuthenticatedUser();
        }
      });

    // Fallback timeout in case initialization takes too long
    setTimeout(() => {
      if (this.checkingAuth) {
        console.log('Init timeout - showing landing page');
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
    this.supabaseService.isUserWhitelisted()
      .pipe(takeUntil(this.destroy$))
      .subscribe(isWhitelisted => {
        this.loading = false;
        if (isWhitelisted) {
          // Full access - check if Sleeper is linked
          const profile = this.supabaseService.getProfile();
          if (profile?.sleeper_user_id) {
            this.authService.toggleAuthentication();
            this.router.navigate(['/my-profile'], {
              queryParams: { userId: profile.sleeper_user_id }
            });
          } else {
            // Need to link Sleeper account
            this.router.navigate(['/link-sleeper']);
          }
        } else {
          // Not whitelisted - sign them out and show error
          this.toastService.showNegativeToast('Your account is not authorized. Contact an admin for access.');
          this.supabaseService.signOut().subscribe();
        }
      });
  }

  // ==========================================
  // SIGN IN METHODS
  // ==========================================

  signInWithGoogle(): void {
    this.loading = true;
    this.supabaseService.signInWithGoogle()
      .pipe(takeUntil(this.destroy$))
      .subscribe(success => {
        if (!success) {
          this.loading = false;
          this.toastService.showNegativeToast('Failed to start Google sign-in');
        }
        // On success, the OAuth redirect will handle the rest
      });
  }

  // ==========================================
  // GUEST MODE METHODS
  // ==========================================

  enterGuestMode(): void {
    this.mode = 'guest-search';
  }

  backToLanding(): void {
    this.mode = 'landing';
    this.searchTerm = '';
  }

  setSearchType(type: 'league' | 'user'): void {
    this.searchType = type;
    this.searchTerm = '';
  }

  searchGuest(): void {
    if (!this.searchTerm.trim()) {
      this.toastService.showNegativeToast('Please enter a search term');
      return;
    }

    this.loading = true;

    if (this.searchType === 'league') {
      // Navigate to league view as guest
      this.router.navigate(['/selected-league'], {
        queryParams: { 
          leagueId: this.searchTerm.trim(),
          view: 'league',
          guest: true
        }
      });
    } else {
      // Navigate to user profile view as guest
      this.router.navigate(['/selected-profile'], {
        queryParams: { 
          userId: this.searchTerm.trim(),
          guest: true
        }
      });
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.searchGuest();
    }
  }
}
