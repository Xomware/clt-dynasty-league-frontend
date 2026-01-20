import { Injectable } from '@angular/core'
import {
  createClient,
  SupabaseClient,
  User,
  Session,
} from '@supabase/supabase-js'
import { BehaviorSubject, Observable, from, of } from 'rxjs'
import { map, catchError, switchMap } from 'rxjs/operators'
import { environment } from 'src/environments/environment.dev'

export interface Profile {
  id: string
  email: string
  sleeper_user_id?: string
  sleeper_username?: string
  sleeper_avatar?: string
  display_name?: string
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

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient
  private currentUser = new BehaviorSubject<User | null>(null)
  private currentSession = new BehaviorSubject<Session | null>(null)
  private profile = new BehaviorSubject<Profile | null>(null)

  currentUser$ = this.currentUser.asObservable()
  currentSession$ = this.currentSession.asObservable()
  profile$ = this.profile.asObservable()

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
    )

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      this.currentSession.next(session)
      this.currentUser.next(session?.user ?? null)

      if (session?.user) {
        this.loadProfile(session.user.id)
      } else {
        this.profile.next(null)
      }
    })

    // Check for existing session on init
    this.initSession()
  }

  private async initSession() {
    const {
      data: { session },
    } = await this.supabase.auth.getSession()
    this.currentSession.next(session)
    this.currentUser.next(session?.user ?? null)

    if (session?.user) {
      this.loadProfile(session.user.id)
    }
  }

  private async loadProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) {
      this.profile.next(data as Profile)
    }
  }

  // ==========================================
  // AUTH METHODS
  // ==========================================

  /**
   * Sign in with Google OAuth
   */
  signInWithGoogle(): Observable<boolean> {
    return from(
      this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/home`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      }),
    ).pipe(
      map(({ error }) => {
        if (error) {
          console.error('Google sign-in error:', error)
          return false
        }
        return true
      }),
      catchError((err) => {
        console.error('Google sign-in exception:', err)
        return of(false)
      }),
    )
  }

  /**
   * Sign out current user
   */
  signOut(): Observable<boolean> {
    return from(this.supabase.auth.signOut()).pipe(
      map(({ error }) => {
        if (error) {
          console.error('Sign out error:', error)
          return false
        }
        this.currentUser.next(null)
        this.currentSession.next(null)
        this.profile.next(null)
        return true
      }),
      catchError((err) => {
        console.error('Sign out exception:', err)
        return of(false)
      }),
    )
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentUser.value
  }

  /**
   * Get current user synchronously
   */
  getUser(): User | null {
    return this.currentUser.value
  }

  /**
   * Get current profile synchronously
   */
  getProfile(): Profile | null {
    return this.profile.value
  }

  // ==========================================
  // WHITELIST METHODS
  // ==========================================

  /**
   * Check if the current user's email is whitelisted
   */
  isUserWhitelisted(): Observable<boolean> {
    const user = this.currentUser.value
    if (!user?.email) return of(false)

    return from(
      this.supabase
        .from('whitelisted_users')
        .select('id')
        .eq('email', user.email.toLowerCase())
        .eq('is_active', true)
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          console.log('User not whitelisted:', user.email)
          return false
        }
        return true
      }),
      catchError(() => of(false)),
    )
  }

  /**
   * Get all whitelisted leagues
   */
  getWhitelistedLeagues(): Observable<WhitelistedLeague[]> {
    return from(
      this.supabase
        .from('whitelisted_leagues')
        .select('*')
        .eq('is_active', true),
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching whitelisted leagues:', error)
          return []
        }
        return data as WhitelistedLeague[]
      }),
      catchError(() => of([])),
    )
  }

  /**
   * Check if a league is whitelisted
   */
  isLeagueWhitelisted(leagueId: string): Observable<boolean> {
    return from(
      this.supabase
        .from('whitelisted_leagues')
        .select('id')
        .eq('league_id', leagueId)
        .eq('is_active', true)
        .single(),
    ).pipe(
      map(({ data, error }) => !error && !!data),
      catchError(() => of(false)),
    )
  }

  // ==========================================
  // PROFILE METHODS
  // ==========================================

  /**
   * Update profile with Sleeper account info
   */
  linkSleeperAccount(
    sleeperUserId: string,
    sleeperUsername: string,
    sleeperAvatar?: string,
  ): Observable<boolean> {
    const user = this.currentUser.value
    if (!user) return of(false)

    return from(
      this.supabase
        .from('profiles')
        .update({
          sleeper_user_id: sleeperUserId,
          sleeper_username: sleeperUsername,
          sleeper_avatar: sleeperAvatar,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id),
    ).pipe(
      map(({ error }) => {
        if (error) {
          console.error('Error linking Sleeper account:', error)
          return false
        }
        // Refresh profile
        this.loadProfile(user.id)
        return true
      }),
      catchError(() => of(false)),
    )
  }

  /**
   * Grant user access to a league (called after login verification)
   */
  grantLeagueAccess(leagueId: string): Observable<boolean> {
    const user = this.currentUser.value
    if (!user) return of(false)

    return from(
      this.supabase.from('user_league_access').upsert(
        {
          user_id: user.id,
          league_id: leagueId,
          role: 'member',
          granted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,league_id' },
      ),
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false)),
    )
  }

  /**
   * Get leagues the user has access to
   */
  getUserLeagueAccess(): Observable<string[]> {
    const user = this.currentUser.value
    if (!user) return of([])

    return from(
      this.supabase
        .from('user_league_access')
        .select('league_id')
        .eq('user_id', user.id),
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return []
        return data.map((d) => d.league_id)
      }),
      catchError(() => of([])),
    )
  }

  // ==========================================
  // UTILITY
  // ==========================================

  /**
   * Get raw Supabase client for advanced queries
   */
  getClient(): SupabaseClient {
    return this.supabase
  }
}
