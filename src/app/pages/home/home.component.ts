import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter, take, switchMap } from 'rxjs/operators';
import { SupabaseService } from 'src/app/services/supabase.service';
import { UserService } from 'src/app/services/user.service';
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
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Wait for Supabase to initialize, then check if user is logged in
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
          // User just came back from OAuth or already logged in
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

    this.supabaseService.isUserWhitelisted()
      .pipe(take(1))
      .subscribe(isWhitelisted => {
        if (isWhitelisted) {
          const user = this.supabaseService.getUser();
          
          // Get Sleeper user by email or username
          // For now, we'll use the email prefix as username lookup
          // You may want to store sleeper_user_id in Supabase profiles table
          this.toastService.showPositiveToast('Login successful!');
          this.authService.toggleAuthentication();
          
          // Navigate to my-profile
          // Note: You'll need to get the Sleeper user ID somehow
          // Option 1: Store it in Supabase profiles table
          // Option 2: Look it up by username/email
          this.router.navigate(['/my-profile'], {
            queryParams: { userId: user?.id }
          });
          
          this.loading = false;
        } else {
          this.toastService.showNegativeToast('Your email is not authorized. Contact an admin.');
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
        // If success, browser redirects to Google
      });
  }

  goToGuestSearch(): void {
    this.router.navigate(['/search']);
  }
}
