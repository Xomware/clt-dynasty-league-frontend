import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
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

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Check both legacy auth and Supabase auth
    const isLegacyAuth = this.authService.isLoggedIn();
    const isSupabaseAuth = this.supabaseService.isAuthenticated();

    if (isLegacyAuth || isSupabaseAuth) {
      return true;
    }

    // Check if this is a guest accessing an allowed route
    const guestAllowedRoutes = ['selected-profile', 'selected-league', 'selected-team', 'search'];
    const currentPath = state.url.split('?')[0].replace('/', '');
    
    if (guestAllowedRoutes.includes(currentPath)) {
      return true;
    }

    // Not authenticated, redirect to landing
    this.router.navigate(['/']);
    return false;
  }
}
