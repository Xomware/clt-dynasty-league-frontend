import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { FormsModule } from '@angular/forms'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'

// Components
import { ToolbarComponent } from './components/toolbar/toolbar.component'
import { LoaderComponent } from './components/loader/loader.component'
import { ToastComponent } from './components/toast/toast.component'
import { FooterComponent } from './components/footer/footer.component'
import { PlayerModalComponent } from './components/player-modal/player-modal.component'
import { MatchupModalComponent } from './components/matchup-modal/matchup-modal.component'
import { TaxiSquadPlayerModalComponent } from './components/taxi-squad-player-modal/taxi-squad-player-modal.component'
import { AmbientBackgroundComponent } from './components/ambient-background/ambient-background.component'

// Pages
import { HomeComponent } from './pages/home/home.component'
import { SearchComponent } from './pages/search/search.component'
import { MyLeagueComponent } from './pages/my-league/my-league.component'
import { LeagueComponent } from './pages/league/league.component'
import { MyProfileComponent } from './pages/my-profile/my-profile.component'
import { ProfileComponent } from './pages/profile/profile.component'
import { SelectedProfileComponent } from './pages/selected-profile/selected-profile.component'
import { SelectedLeagueComponent } from './pages/selected-league/selected-league.component'
import { TeamComponent } from './pages/team/team.component'
import { MyTeamComponent } from './pages/my-team/my-team.component'
import { SelectedTeamComponent } from './pages/selected-team/selected-team.component'
import { TaxiSquadComponent } from './pages/taxi-squad/taxi-squad.component'
import { DraftHistoryComponent } from './pages/draft-history/draft-history.component'
import { MatchupHistoryComponent } from './pages/matchup-history/matchup-history.component'

import { LinkSleeperComponent } from './pages/link-sleeper/link-sleeper.component'

// Services
import { LeagueService } from './services/league.service'
import { UserService } from './services/user.service'
import { StandingsService } from './services/standings.service'
import { TeamService } from './services/team.service'
import { PlayerService } from './services/player.service'
import { TaxiSquadService } from './services/taxi-squad.service'
import { DraftService } from './services/draft.service'
import { SupabaseService } from './services/supabase.service'
import { LeagueHistoryService } from './services/league-history.service'

@NgModule({ declarations: [
        AppComponent,
        // Components
        ToolbarComponent,
        LoaderComponent,
        ToastComponent,
        FooterComponent,
        PlayerModalComponent,
        MatchupModalComponent,
        TaxiSquadPlayerModalComponent,
        AmbientBackgroundComponent,
        // Pages
        HomeComponent,
        SearchComponent,
        MyLeagueComponent,
        LeagueComponent,
        MyProfileComponent,
        ProfileComponent,
        SelectedProfileComponent,
        SelectedLeagueComponent,
        TeamComponent,
        MyTeamComponent,
        SelectedTeamComponent,
        TaxiSquadComponent,
        DraftHistoryComponent,
        MatchupHistoryComponent,
        LinkSleeperComponent,
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        AppRoutingModule,
        FormsModule,
        BrowserAnimationsModule], providers: [
        LeagueService,
        UserService,
        StandingsService,
        TeamService,
        PlayerService,
        TaxiSquadService,
        DraftService,
        SupabaseService,
        LeagueHistoryService,
        provideHttpClient(withInterceptorsFromDi()),
    ] })
export class AppModule {}
