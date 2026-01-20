import { Injectable } from '@angular/core'
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js'
import { BehaviorSubject, Observable, from, map } from 'rxjs'
import { environment } from 'src/environments/environment.prod'

export interface Profile {
  id: string
  email: string
  sleeper_user_id: string | null
  sleeper_username: string | null
  sleeper_avatar: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface WhitelistedLeague {
  id: string
  league_id: string
  league_name: string
  season: string
  is_active: boolean
  is_dynasty: boolean
  has_taxi: boolean
  divisions: number
  size: number
  features: Record<string, any>
}

export interface UserLeagueAccess {
  id: string
  user_id: string
  league_id: string
  role: 'member' | 'admin' | 'owner'
  granted_at: string
}

export interface WorldCupStanding {
  id: string
  league_id: string
  roster_id: number
  sleeper_user_id: string | null
  team_name: string | null
  division: string | null
  year_2021_wins: number
  year_2021_losses: number
  year_2022_wins: number
  year_2022_losses: number
  year_2023_wins: number
  year_2023_losses: number
  year_2024_wins: number
  year_2024_losses: number
  total_division_wins: number
  seed: number | null
  eliminated: boolean
}

export interface WorldCupBracket {
  id: string
  league_id: string
  season: string
  round: number
  match_id: number
  team1_roster_id: number | null
  team2_roster_id: number | null
  team1_score: number | null
  team2_score: number | null
  winner_roster_id: number | null
  match_week: number | null
  status: 'pending' | 'in_progress' | 'complete'
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient
  private _session = new BehaviorSubject<Session | null>(null)
  private _user = new BehaviorSubject<User | null>(null)

  session$ = this._session.asObservable()
  user$ = this._user.asObservable()

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    )

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event)
      this._session.next(session)
      this._user.next(session?.user ?? null)
    })

    // Check initial session
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this._session.next(session)
      this._user.next(session?.user ?? null)
    })
  }

  // =============================================
  // AUTHENTICATION
  // =============================================

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    
    return { user: data.user, error: error as Error | null }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    })
    
    return { user: data.user, error: error as Error | null }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    await this.supabase.auth.signOut()
  }

  /**
   * Get current user
   */
  get currentUser(): User | null {
    return this._user.value
  }

  /**
   * Get current session
   */
  get currentSession(): Session | null {
    return this._session.value
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated(): boolean {
    return !!this._session.value
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    return { error: error as Error | null }
  }

  // =============================================
  // PROFILE
  // =============================================

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }
    
    return data
  }

  /**
   * Update user profile (link Sleeper account)
   */
  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ error: Error | null }> {
    const { error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
    
    return { error: error as Error | null }
  }

  /**
   * Link Sleeper account to profile
   */
  async linkSleeperAccount(
    userId: string,
    sleeperUserId: string,
    sleeperUsername: string,
    sleeperAvatar?: string
  ): Promise<{ error: Error | null }> {
    return this.updateProfile(userId, {
      sleeper_user_id: sleeperUserId,
      sleeper_username: sleeperUsername,
      sleeper_avatar: sleeperAvatar || null
    })
  }

  // =============================================
  // WHITELISTED LEAGUES
  // =============================================

  /**
   * Get all whitelisted leagues
   */
  async getWhitelistedLeagues(): Promise<WhitelistedLeague[]> {
    const { data, error } = await this.supabase
      .from('whitelisted_leagues')
      .select('*')
      .eq('is_active', true)
    
    if (error) {
      console.error('Error fetching whitelisted leagues:', error)
      return []
    }
    
    return data || []
  }

  /**
   * Check if a league is whitelisted
   */
  async isLeagueWhitelisted(leagueId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('whitelisted_leagues')
      .select('id')
      .eq('league_id', leagueId)
      .eq('is_active', true)
      .single()
    
    return !error && !!data
  }

  // =============================================
  // USER LEAGUE ACCESS
  // =============================================

  /**
   * Get user's league access
   */
  async getUserLeagueAccess(userId: string): Promise<UserLeagueAccess[]> {
    const { data, error } = await this.supabase
      .from('user_league_access')
      .select('*')
      .eq('user_id', userId)
    
    if (error) {
      console.error('Error fetching user league access:', error)
      return []
    }
    
    return data || []
  }

  /**
   * Check if user has access to a whitelisted league
   */
  async hasLeagueAccess(userId: string, leagueId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('user_league_access')
      .select('id')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .single()
    
    return !error && !!data
  }

  /**
   * Grant league access to user
   */
  async grantLeagueAccess(
    userId: string,
    leagueId: string,
    role: 'member' | 'admin' | 'owner' = 'member'
  ): Promise<{ error: Error | null }> {
    const { error } = await this.supabase
      .from('user_league_access')
      .upsert({
        user_id: userId,
        league_id: leagueId,
        role
      })
    
    return { error: error as Error | null }
  }

  // =============================================
  // WORLD CUP
  // =============================================

  /**
   * Get World Cup standings for a league
   */
  async getWorldCupStandings(leagueId: string): Promise<WorldCupStanding[]> {
    const { data, error } = await this.supabase
      .from('world_cup_standings')
      .select('*')
      .eq('league_id', leagueId)
      .order('total_division_wins', { ascending: false })
    
    if (error) {
      console.error('Error fetching World Cup standings:', error)
      return []
    }
    
    return data || []
  }

  /**
   * Get World Cup bracket for a league
   */
  async getWorldCupBracket(leagueId: string, season: string = '2025'): Promise<WorldCupBracket[]> {
    const { data, error } = await this.supabase
      .from('world_cup_brackets')
      .select('*')
      .eq('league_id', leagueId)
      .eq('season', season)
      .order('round', { ascending: true })
      .order('match_id', { ascending: true })
    
    if (error) {
      console.error('Error fetching World Cup bracket:', error)
      return []
    }
    
    return data || []
  }

  /**
   * Update World Cup bracket match
   */
  async updateBracketMatch(
    matchId: string,
    updates: Partial<WorldCupBracket>
  ): Promise<{ error: Error | null }> {
    const { error } = await this.supabase
      .from('world_cup_brackets')
      .update(updates)
      .eq('id', matchId)
    
    return { error: error as Error | null }
  }

  // =============================================
  // LEAGUE CONFIGS
  // =============================================

  /**
   * Get league config
   */
  async getLeagueConfig<T = any>(leagueId: string, configKey: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from('league_configs')
      .select('config_value')
      .eq('league_id', leagueId)
      .eq('config_key', configKey)
      .single()
    
    if (error) {
      console.error('Error fetching league config:', error)
      return null
    }
    
    return data?.config_value as T
  }

  /**
   * Set league config
   */
  async setLeagueConfig(
    leagueId: string,
    configKey: string,
    configValue: any
  ): Promise<{ error: Error | null }> {
    const { error } = await this.supabase
      .from('league_configs')
      .upsert({
        league_id: leagueId,
        config_key: configKey,
        config_value: configValue
      })
    
    return { error: error as Error | null }
  }
}
