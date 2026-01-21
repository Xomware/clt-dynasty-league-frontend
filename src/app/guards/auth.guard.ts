import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  canActivate(): boolean {
    // Check Supabase auth OR legacy auth
    if (this.supabaseService.isAuthenticated() || this.authService.isLoggedIn()) {
      return true;
    }

    // Not authenticated - redirect to home
    this.router.navigate(['/home']);
    return false;
  }
}
