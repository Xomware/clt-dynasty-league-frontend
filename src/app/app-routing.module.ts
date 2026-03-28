import { NgModule } from '@angular/core'
import { Routes, RouterModule } from '@angular/router'

import { HomeComponent } from './pages/home/home.component'
import { SearchComponent } from './pages/search/search.component'
import { MyLeagueComponent } from './pages/my-league/my-league.component'
import { LeagueComponent } from './pages/league/league.component'
import { MyProfileComponent } from './pages/my-profile/my-profile.component'
import { ProfileComponent } from './pages/profile/profile.component'
import { AuthGuard } from './guards/auth.guard'
import { MyTeamComponent } from './pages/my-team/my-team.component'
import { SelectedTeamComponent } from './pages/selected-team/selected-team.component'
import { TaxiSquadComponent } from './pages/taxi-squad/taxi-squad.component'
import { DraftHistoryComponent } from './pages/draft-history/draft-history.component'
import { MatchupHistoryComponent } from './pages/matchup-history/matchup-history.component'

import { LinkSleeperComponent } from './pages/link-sleeper/link-sleeper.component'

const routes: Routes = [
  // Public
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'search', component: SearchComponent },

  // Guest accessible (view others)
  { path: 'selected-profile', component: ProfileComponent },
  { path: 'selected-league', component: LeagueComponent },
  { path: 'selected-team', component: SelectedTeamComponent },

  // Authenticated - MY routes (whitelisted league)
  { path: 'my-profile', component: MyProfileComponent, canActivate: [AuthGuard] },
  { path: 'my-league', component: MyLeagueComponent, canActivate: [AuthGuard] },
  { path: 'my-team', component: MyTeamComponent, canActivate: [AuthGuard] },
  { path: 'taxi-squad', component: TaxiSquadComponent, canActivate: [AuthGuard] },

  // Account setup (authenticated)
  { path: 'link-sleeper', component: LinkSleeperComponent, canActivate: [AuthGuard] },

  // League History (authenticated)
  { path: 'draft-history', component: DraftHistoryComponent, canActivate: [AuthGuard] },
  { path: 'matchup-history', component: MatchupHistoryComponent, canActivate: [AuthGuard] },

  // Catch-all
  { path: '**', redirectTo: '/home' },
]

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
