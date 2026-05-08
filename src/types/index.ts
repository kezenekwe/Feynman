export type Plan = 'free' | 'pro'

export interface Profile {
  id: string
  plan: Plan
  sessions_this_month: number
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  topic: string
  started_at: string
  ended_at: string | null
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ReviewReport {
  topic: string
  overallClarity: 'clear' | 'partial' | 'unclear'
  conceptsExplainedWell: string[]
  gaps: Array<{ concept: string; detail: string }>
  jargonUsed: Array<{ term: string; explanation: string | null }>
  questionsNotAnswered: string[]
  suggestionsToReview: string[]
}

export interface Review {
  id: string
  session_id: string
  report: ReviewReport
  created_at: string
}

export const PLAN_LIMITS: Record<Plan, number | null> = {
  free: 3,
  pro: null,
}
