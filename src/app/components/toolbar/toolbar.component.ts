import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
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
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private leagueService: LeagueService,
    private userService: UserService,
    private teamService: TeamService,
    private authService: AuthService,
    private supabaseService: SupabaseService
  ) {
    this.checkIfMobile();
    window.addEventListener('resize', this.checkIfMobile.bind(this));
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDropdown(): void {
    this.dropdownVisible = !this.dropdownVisible;
  }

  selectItem(route: string): void {
    this.dropdownVisible = false;
    this.router.navigate([route]);
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown') && !target.closest('.dropdown-button')) {
      this.dropdownVisible = false;
    }
  }

  checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  isSelected(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  get leagueId(): string {
    return this.leagueService.getMyLeague()?.getId();
  }

  get userId(): string {
    return this.userService.getMyUser()?.getUserId();
  }

  get teamUserName(): string {
    return this.teamService.getMyTeam()?.getUserName();
  }

  get teamLeagueId(): string {
    return this.teamService.getMyTeam()?.getLeague()?.getId();
  }

  isLoggedIn(): boolean {
    return this.supabaseService.isAuthenticated() || this.authService.isLoggedIn();
  }

  signOut(): void {
    this.supabaseService.signOut().subscribe(() => {
      if (this.authService.isLoggedIn()) {
        this.authService.toggleAuthentication();
      }
      
      this.leagueService.reset();
      this.userService.reset();
      this.teamService.reset();
      
      this.router.navigate(['/home']);
    });
    
    this.dropdownVisible = false;
  }

  goHome(): void {
    this.dropdownVisible = false;
    this.router.navigate(['/home']);
  }
}
