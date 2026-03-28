import { Injectable } from '@angular/core'
import { Observable, from, of, forkJoin } from 'rxjs'
import { map, switchMap, catchError } from 'rxjs/operators'
import { SupabaseService } from './supabase.service'

export interface RuleProposal {
  id: string
  league_id: string
  proposed_by: string
  proposed_by_username: string
  title: string
  description: string
  status: 'open' | 'approved' | 'rejected' | 'closed'
  yes_count: number
  no_count: number
  my_vote: 'yes' | 'no' | null
  created_at: string
}

interface SupabaseProposalRow {
  id: string
  league_id: string
  proposed_by: string
  title: string
  description: string
  status: string
  created_at: string
  profiles?: { display_name?: string; sleeper_username?: string; email?: string }
}

interface SupabaseVoteRow {
  proposal_id: string
  vote?: string
}

interface SupabaseEmailRow {
  email: string
  display_name: string
}

interface SupabaseVoteWithProfileRow {
  vote: string
  profiles?: { display_name?: string; sleeper_username?: string; email?: string }
}

@Injectable({
  providedIn: 'root'
})
export class RulesService {
  private get supabase() {
    return this.supabaseService.getClient()
  }

  constructor(private supabaseService: SupabaseService) {}

  getProposals(leagueId: string): Observable<RuleProposal[]> {
    const userId = this.supabaseService.getUser()?.id

    return from(
      this.supabase
        .from('rule_proposals')
        .select(`
          *,
          profiles:proposed_by ( sleeper_username, display_name, email )
        `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })
    ).pipe(
      switchMap(({ data, error }) => {
        if (error || !data) return of([])

        const proposals = data as SupabaseProposalRow[]
        if (proposals.length === 0) return of([])

        // Get vote counts for all proposals
        const proposalIds = proposals.map(p => p.id)
        return forkJoin({
          yesCounts: this.getVoteCounts(proposalIds, 'yes'),
          noCounts: this.getVoteCounts(proposalIds, 'no'),
          myVotes: userId ? this.getMyVotes(proposalIds, userId) : of({} as Record<string, string>)
        }).pipe(
          map(({ yesCounts, noCounts, myVotes }) => {
            return proposals.map(p => ({
              id: p.id,
              league_id: p.league_id,
              proposed_by: p.proposed_by,
              proposed_by_username: p.profiles?.display_name || p.profiles?.sleeper_username || p.profiles?.email?.split('@')[0] || 'Unknown',
              title: p.title,
              description: p.description || '',
              status: p.status,
              yes_count: yesCounts[p.id] || 0,
              no_count: noCounts[p.id] || 0,
              my_vote: myVotes[p.id] || null,
              created_at: p.created_at
            })) as RuleProposal[]
          })
        )
      }),
      // Sort: open first, then by date
      map(proposals => proposals.sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1
        if (a.status !== 'open' && b.status === 'open') return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })),
      catchError(() => of([]))
    )
  }

  private getVoteCounts(proposalIds: string[], vote: string): Observable<Record<string, number>> {
    return from(
      this.supabase
        .from('rule_votes')
        .select('proposal_id')
        .in('proposal_id', proposalIds)
        .eq('vote', vote)
    ).pipe(
      map(({ data }) => {
        const counts: Record<string, number> = {}
        ;((data || []) as SupabaseVoteRow[]).forEach((v) => {
          counts[v.proposal_id] = (counts[v.proposal_id] || 0) + 1
        })
        return counts
      }),
      catchError(() => of({}))
    )
  }

  private getMyVotes(proposalIds: string[], userId: string): Observable<Record<string, string>> {
    return from(
      this.supabase
        .from('rule_votes')
        .select('proposal_id, vote')
        .in('proposal_id', proposalIds)
        .eq('user_id', userId)
    ).pipe(
      map(({ data }) => {
        const votes: Record<string, string> = {}
        ;((data || []) as SupabaseVoteRow[]).forEach((v) => {
          if (v.vote) votes[v.proposal_id] = v.vote
        })
        return votes
      }),
      catchError(() => of({}))
    )
  }

  createProposal(leagueId: string, title: string, description: string): Observable<boolean> {
    const userId = this.supabaseService.getUser()?.id
    if (!userId) return of(false)

    return from(
      this.supabase
        .from('rule_proposals')
        .insert({
          league_id: leagueId,
          proposed_by: userId,
          title,
          description
        })
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false))
    )
  }

  deleteProposal(proposalId: string): Observable<boolean> {
    return from(
      this.supabase
        .from('rule_proposals')
        .delete()
        .eq('id', proposalId)
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false))
    )
  }

  castVote(proposalId: string, vote: 'yes' | 'no'): Observable<boolean> {
    const userId = this.supabaseService.getUser()?.id
    if (!userId) return of(false)

    return from(
      this.supabase
        .from('rule_votes')
        .upsert({
          proposal_id: proposalId,
          user_id: userId,
          vote
        }, { onConflict: 'proposal_id,user_id' })
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false))
    )
  }

  updateProposalStatus(proposalId: string, status: 'open' | 'approved' | 'rejected' | 'closed'): Observable<boolean> {
    return from(
      this.supabase
        .from('rule_proposals')
        .update({ status })
        .eq('id', proposalId)
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false))
    )
  }

  getVoterNames(proposalId: string): Observable<{ approved_by: string[]; rejected_by: string[] }> {
    return from(
      this.supabase
        .from('rule_votes')
        .select(`
          vote,
          profiles:user_id ( display_name, sleeper_username, email )
        `)
        .eq('proposal_id', proposalId)
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return { approved_by: [], rejected_by: [] }
        const approved_by: string[] = []
        const rejected_by: string[] = []
        ;(data as SupabaseVoteWithProfileRow[]).forEach((v) => {
          const name = v.profiles?.display_name || v.profiles?.sleeper_username || v.profiles?.email?.split('@')[0] || 'Unknown'
          if (v.vote === 'yes') approved_by.push(name)
          else rejected_by.push(name)
        })
        return { approved_by, rejected_by }
      }),
      catchError(() => of({ approved_by: [] as string[], rejected_by: [] as string[] }))
    )
  }

  getOwnerEmailByUsername(sleeperUsername: string): Observable<{ email: string; display_name: string } | null> {
    return from(
      this.supabase
        .from('whitelisted_users')
        .select('email, display_name')
        .eq('sleeper_username', sleeperUsername)
        .eq('is_active', true)
        .limit(1)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null
        const row = data as SupabaseEmailRow
        return { email: row.email, display_name: row.display_name }
      }),
      catchError(() => of(null))
    )
  }

  getLeagueMemberEmails(): Observable<string[]> {
    return from(
      this.supabase
        .from('whitelisted_users')
        .select('email')
        .eq('is_active', true)
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return []
        return (data as { email: string }[]).map((u) => u.email).filter(Boolean)
      }),
      catchError(() => of([]))
    )
  }
}
