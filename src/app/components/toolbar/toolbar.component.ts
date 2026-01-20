import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { LeagueService } from 'src/app/services/league.service';
import { TeamService } from 'src/app/services/team.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
})
export class ToolbarComponent implements OnInit, OnDestroy {
  dropdownVisible = false;
  isMobile: boolean;
  userEmail: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private LeagueService: LeagueService,
    private UserService: UserService,
    private TeamService: TeamService,
    private AuthService: AuthService,
    private supabaseService: SupabaseService
  ) {
    this.checkIfMobile();
    window.addEventListener('resize', this.checkIfMobile.bind(this));
  }

  ngOnInit(): void {
    console.log("Toolbar locked n loaded.");
    
    // Subscribe to Supabase auth state
    this.supabaseService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.userEmail = user?.email ?? null;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Toggle dropdown visibility
  toggleDropdown() {
    this.dropdownVisible = !this.dropdownVisible;
  }

  // Handle item selection and close dropdown
  selectItem(route: string) {
    this.dropdownVisible = false;
    this.router.navigate([route]);
  }

  // Close dropdown if clicked outside
  @HostListener('document:click', ['$event'])
  closeDropdown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown') && !target.closest('.dropdown-button')) {
      this.dropdownVisible = false;
    }
  }

  checkIfMobile() {
    this.isMobile = window.innerWidth <= 768;
  }

  isSelected(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  get leagueId(): string {
    return this.LeagueService.getMyLeague()?.getId();
  }

  get userId(): string {
    return this.UserService.getMyUser()?.getUserId();
  }

  get teamUserName(): string {
    return this.TeamService.getMyTeam()?.getUserName();
  }

  get teamLeagueId(): string {
    return this.TeamService.getMyTeam()?.getLeague()?.getId();  
  }
  
  isLoggedIn(): boolean {
    return this.AuthService.isLoggedIn() || this.supabaseService.isAuthenticated();
  }

  signOut(): void {
    // Sign out from Supabase
    this.supabaseService.signOut().subscribe(() => {
      // Reset legacy auth
      if (this.AuthService.isLoggedIn()) {
        this.AuthService.toggleAuthentication();
      }
      
      // Reset services
      this.LeagueService.reset();
      this.UserService.reset();
      this.TeamService.reset();
      
      // Navigate to landing
      this.router.navigate(['/']);
    });
  }

  goToLanding(): void {
    this.dropdownVisible = false;
    this.router.navigate(['/']);
  }
}
