import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HomeComponent } from './pages/home/home.component';
import { SearchComponent } from './pages/search/search.component';
import { MyLeagueComponent } from './pages/my-league/my-league.component';
import { LeagueComponent } from './pages/league/league.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AuthGuard } from './guards/auth.guard';
import { MyTeamComponent } from './pages/my-team/my-team.component';
import { SelectedTeamComponent } from './pages/selected-team/selected-team.component';
import { TaxiSquadComponent } from './pages/taxi-squad/taxi-squad.component';

const routes: Routes = [
  // Public routes
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'search', component: SearchComponent },
  
  // Guest-accessible routes (view other users/leagues)
  { path: 'selected-profile', component: ProfileComponent },
  { path: 'selected-league', component: LeagueComponent },
  { path: 'selected-team', component: SelectedTeamComponent },
  
  // Authenticated routes
  { path: 'my-profile', component: MyProfileComponent, canActivate: [AuthGuard] },
  { path: 'my-league', component: MyLeagueComponent, canActivate: [AuthGuard] },
  { path: 'my-team', component: MyTeamComponent, canActivate: [AuthGuard] },
  { path: 'taxi-squad', component: TaxiSquadComponent, canActivate: [AuthGuard] },
  
  // Catch-all
  { path: '**', redirectTo: '/home' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
