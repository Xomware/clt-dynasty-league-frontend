import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LandingComponent } from './pages/landing/landing.component';
import { LinkSleeperComponent } from './pages/link-sleeper/link-sleeper.component';
import { SearchComponent } from './pages/search/search.component';
import { MyLeagueComponent } from './pages/my-league/my-league.component';
import { LeagueComponent } from './pages/league/league.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { HomeComponent } from './pages/home/home.component';
import { AuthGuard } from './guards/auth.guard';
import { MyTeamComponent } from './pages/my-team/my-team.component';
import { SelectedTeamComponent } from './pages/selected-team/selected-team.component';
import { TaxiSquadComponent } from './pages/taxi-squad/taxi-squad.component';

const routes: Routes = [
  // Landing/Auth routes (public)
  { path: '', component: LandingComponent },
  { path: 'link-sleeper', component: LinkSleeperComponent },
  
  // Legacy home route (redirects to landing)
  { path: 'home/:leagueName', component: HomeComponent },
  { path: 'home', redirectTo: '/', pathMatch: 'full' },
  
  // Guest-accessible routes (no auth guard)
  { path: 'search', component: SearchComponent },
  { path: 'selected-profile', component: ProfileComponent },
  { path: 'selected-league', component: LeagueComponent },
  { path: 'selected-team', component: SelectedTeamComponent },
  
  // Authenticated routes
  { path: 'my-league', component: MyLeagueComponent, canActivate: [AuthGuard] },
  { path: 'my-profile', component: MyProfileComponent, canActivate: [AuthGuard] },
  { path: 'my-team', component: MyTeamComponent, canActivate: [AuthGuard] },
  { path: 'taxi-squad', component: TaxiSquadComponent, canActivate: [AuthGuard] },
  
  // Catch-all redirect
  { path: '**', redirectTo: '/' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
