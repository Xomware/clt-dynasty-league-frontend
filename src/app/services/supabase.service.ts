import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface WhitelistedUser {
  id: string;
  email: string;
  sleeper_username: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private currentUser = new BehaviorSubject<User | null>(null);
  private initialized = new BehaviorSubject<boolean>(false);

  currentUser$ = this.currentUser.asObservable();
  initialized$ = this.initialized.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    );

    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      this.currentUser.next(session?.user ?? null);
      
      if (!this.initialized.value) {
        this.initialized.next(true);
      }
    });

    this.initSession();
  }

  private async initSession() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      this.currentUser.next(session?.user ?? null);
    } catch (err) {
      console.error('Session init error:', err);
    } finally {
      this.initialized.next(true);
    }
  }

  // Sign in with Google
  signInWithGoogle(): Observable<boolean> {
    return from(
      this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${environment.baseCallbackUrl}/home`
        }
      })
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false))
    );
  }

  // Sign out
  signOut(): Observable<boolean> {
    return from(this.supabase.auth.signOut()).pipe(
      map(({ error }) => {
        if (!error) {
          this.currentUser.next(null);
        }
        return !error;
      }),
      catchError(() => of(false))
    );
  }

  /**
   * Get whitelisted user data including sleeper_username
   * Returns null if user is not whitelisted
   */
  getWhitelistedUser(): Observable<WhitelistedUser | null> {
    const user = this.currentUser.value;
    if (!user?.email) return of(null);

    return from(
      this.supabase
        .from('whitelisted_users')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .eq('is_active', true)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          console.log('User not whitelisted:', user.email);
          return null;
        }
        return data as WhitelistedUser;
      }),
      catchError(() => of(null))
    );
  }

  // Simple check if whitelisted (no data returned)
  isUserWhitelisted(): Observable<boolean> {
    return this.getWhitelistedUser().pipe(
      map(user => !!user)
    );
  }

  // Getters
  isAuthenticated(): boolean {
    return !!this.currentUser.value;
  }

  getUser(): User | null {
    return this.currentUser.value;
  }

  isInitialized(): boolean {
    return this.initialized.value;
  }
}
