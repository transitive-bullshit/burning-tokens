import type { RetreatLounge } from './lounge'
import type { RetreatStudio } from './studio'
import type { RetreatSession } from './session'
import type { RetreatPresence } from './presence'
import type { InferenceBudget } from './inference'
export interface Env {
  CLOUDFLARE_TOKEN?: string
  ANALYTICS_ACCOUNT_ID?: string
  ANALYTICS_DATASET?: string
  INVITATIONS_DAILY_LIMIT?: string
  INVITATIONS_MINUTE_LIMIT?: string
  METRICS_ENABLED?: string
  METRICS?: AnalyticsEngineDataset
  LOUNGE: DurableObjectNamespace<RetreatLounge>
  STUDIO: DurableObjectNamespace<RetreatStudio>
  MEDIA: R2Bucket
  OPENAI_API_KEY?: string
  STUDIO_ADMIN_KEY?: string
  SESSIONS: DurableObjectNamespace<RetreatSession>
  PRESENCE: DurableObjectNamespace<RetreatPresence>
  BUDGET: DurableObjectNamespace<InferenceBudget>
  PUBLIC_ORIGIN: string
  TYPESAFE_ENABLED: string
  TYPESAFE_MODEL: string
  TYPESAFE_API_KEY?: string
  TYPESAFE_DAILY_CALL_LIMIT: string
  TYPESAFE_DAILY_INPUT_LIMIT: string
  PUBLISHING_ENABLED: string
}
