import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  EVALUATOR_MODEL,
  EVALUATOR_MAX_TOKENS,
  EVALUATOR_SYSTEM_PROMPT,
  buildEvaluatorMessage,
  parseEvaluatorResponse,
} from './api/_evaluatorCore.js'
import {
  mapFrictionCaseToPMGraphRequest,
  type HEQFrictionCaseSubmission,
} from './src/integrations/pmGraph/mapper.js'
import {
  buildChatSystemPrompt,
  buildGenerationPrompt,
  evaluateReadiness,
  stripAreasTag,
  deriveSessionTitle,
} from './src/services/validatorPrompts.js'

// ── Dev middleware: handles /api/evaluate-taste locally (npm run dev) ──────────
// In production this is served by api/evaluate-taste.ts (Vercel function).
// The Vite proxy can't handle this route because it requires body transformation,
// so we use a configureServer middleware instead.

function evaluateTasteDevPlugin(evaluatorKey: string): Plugin {
  return {
    name: 'heq-evaluate-taste-dev',
    configureServer(server) {
      server.middlewares.use(
        '/api/evaluate-taste',
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          // Read request body
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          let body: Record<string, unknown>
          try {
            body = JSON.parse(Buffer.concat(chunks).toString())
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid JSON body.' }))
            return
          }

          // Validate input
          const productName = typeof body.productName === 'string' ? body.productName.trim() : ''
          if (!productName) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'productName is required.' }))
            return
          }

          const productContext = typeof body.productContext === 'string'
            ? body.productContext.trim().slice(0, 500)
            : ''

          const rawAnswers = (body.answers && typeof body.answers === 'object')
            ? body.answers as Record<string, unknown>
            : {}

          const answers = {
            q1: String(rawAnswers.q1 ?? '').trim().slice(0, 2000),
            q2: String(rawAnswers.q2 ?? '').trim().slice(0, 2000),
            q3: String(rawAnswers.q3 ?? '').trim().slice(0, 2000),
            q4: String(rawAnswers.q4 ?? '').trim().slice(0, 2000),
            q5: String(rawAnswers.q5 ?? '').trim().slice(0, 2000),
            q6: String(rawAnswers.q6 ?? '').trim().slice(0, 2000),
          }

          if (!Object.values(answers).some(a => a.length > 0)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'At least one answer is required.' }))
            return
          }

          // Call Anthropic directly with the evaluator key
          const userMessage = buildEvaluatorMessage(productName, productContext, answers)
          try {
            const upstream = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type':      'application/json',
                'x-api-key':         evaluatorKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model:       EVALUATOR_MODEL,
                max_tokens:  EVALUATOR_MAX_TOKENS,
                temperature: 0,
                system:      EVALUATOR_SYSTEM_PROMPT,
                messages:    [{ role: 'user', content: userMessage }],
              }),
            })

            if (!upstream.ok) {
              const errText = await upstream.text()
              console.error('[HEQ] evaluate-taste dev: Anthropic error', upstream.status, errText.slice(0, 200))
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Evaluator upstream error. Please try again.' }))
              return
            }

            const responseBody = await upstream.json() as {
              content?: Array<{ type: string; text: string }>
            }
            const rawText = responseBody.content?.[0]?.text ?? ''

            let result: ReturnType<typeof parseEvaluatorResponse>
            try {
              result = parseEvaluatorResponse(rawText)
            } catch (parseErr) {
              const msg = parseErr instanceof Error ? parseErr.message : 'Parse failed'
              console.error('[HEQ] evaluate-taste dev: JSON parse error —', msg)
              res.statusCode = 422
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Evaluator returned an unexpected response. Please try again.' }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))

          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            console.error('[HEQ] evaluate-taste dev: fetch error —', message)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Evaluator network error. Please try again.' }))
          }
        },
      )
    },
  }
}

// ── Dev middleware: handles /api/pm-graph/evaluate-friction-case locally ───────
// In production this is served by api/pm-graph/evaluate-friction-case.ts (Vercel function).
// Mirrors the Vercel handler: validates input, maps via mapper, calls PM Graph,
// and returns a degraded response on failure — so the UI fallback path is testable.
// Only mounted when PM_GRAPH_BASE_URL and PM_GRAPH_SERVICE_TOKEN are set.

const VALID_THEMES_DEV = ['pricing', 'ux', 'onboarding', 'value', 'trust'] as const
type FrictionThemeDev = typeof VALID_THEMES_DEV[number]

function pmGraphFrictionCaseDevPlugin(baseUrl: string, serviceToken: string): Plugin {
  return {
    name: 'heq-pm-graph-friction-case-dev',
    configureServer(server) {
      server.middlewares.use(
        '/api/pm-graph/evaluate-friction-case',
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          const sessionId = req.headers['x-session-id']
          if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'X-Session-Id header is required.' }))
            return
          }

          const incomingId = req.headers['x-request-id']
          const requestId = (typeof incomingId === 'string' && incomingId.trim())
            ? incomingId.trim()
            : `heq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`

          const degraded = (reason: string) => ({
            degraded: true, reason, score: null,
            dimension_scores: null, provenance: null, reasoning: null,
            request_id: requestId,
          })

          // Read body
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          let body: Record<string, unknown>
          try {
            body = JSON.parse(Buffer.concat(chunks).toString())
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid JSON body.' }))
            return
          }

          // Validate required fields (mirrors Vercel handler validation)
          const caseId = typeof body.caseId === 'string' ? body.caseId.trim() : ''
          if (!caseId) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'caseId is required.' }))
            return
          }

          if (!VALID_THEMES_DEV.includes(body.theme as FrictionThemeDev)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `theme must be one of: ${VALID_THEMES_DEV.join(', ')}.` }))
            return
          }
          const theme = body.theme as FrictionThemeDev

          const context     = typeof body.context     === 'string' ? body.context.trim()     : ''
          const narrative   = typeof body.narrative   === 'string' ? body.narrative.trim()   : ''
          const rawResponse = typeof body.rawResponse === 'string' ? body.rawResponse.trim() : ''
          if (!context || !narrative || !rawResponse) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'context, narrative, and rawResponse are required.' }))
            return
          }

          const rootIssueOptions = Array.isArray(body.rootIssueOptions) &&
            body.rootIssueOptions.every((o) => typeof o === 'string')
              ? (body.rootIssueOptions as string[]) : null
          if (!rootIssueOptions || rootIssueOptions.length === 0) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'rootIssueOptions must be a non-empty string array.' }))
            return
          }

          const rootAnswerIndex = typeof body.rootAnswerIndex === 'number'
            ? Math.floor(body.rootAnswerIndex) : -1
          if (rootAnswerIndex < 0 || rootAnswerIndex >= rootIssueOptions.length) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'rootAnswerIndex is out of bounds.' }))
            return
          }

          const fixOptions = Array.isArray(body.fixOptions) &&
            body.fixOptions.every((o) => typeof o === 'string')
              ? (body.fixOptions as string[]) : null
          if (!fixOptions || fixOptions.length === 0) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'fixOptions must be a non-empty string array.' }))
            return
          }

          const fixAnswerIndex = typeof body.fixAnswerIndex === 'number'
            ? Math.floor(body.fixAnswerIndex) : -1
          if (fixAnswerIndex < 0 || fixAnswerIndex >= fixOptions.length) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'fixAnswerIndex is out of bounds.' }))
            return
          }

          // Guard: env vars missing → return degraded immediately
          if (!baseUrl || !serviceToken) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(degraded('pm_graph_unavailable')))
            return
          }

          const submission: HEQFrictionCaseSubmission = {
            caseId,
            submissionId:   typeof body.submissionId   === 'string' ? body.submissionId.trim()   : undefined,
            theme,
            context:        context.slice(0, 1000),
            narrative:      narrative.slice(0, 2000),
            rawResponse:    rawResponse.slice(0, 500),
            rootIssueOptions,
            rootAnswerIndex,
            fixOptions,
            fixAnswerIndex,
            reflectionText: typeof body.reflectionText === 'string'
              ? body.reflectionText.trim().slice(0, 3000) : undefined,
            productName:    typeof body.productName    === 'string'
              ? body.productName.trim().slice(0, 200)    : undefined,
            productContext: typeof body.productContext  === 'string'
              ? body.productContext.trim().slice(0, 500) : undefined,
          }

          const pmGraphRequest = mapFrictionCaseToPMGraphRequest(submission)

          // Call PM Graph
          try {
            const url = `${baseUrl.replace(/\/$/, '')}/evaluate`
            const controller = new AbortController()
            const timeoutHandle = setTimeout(() => controller.abort(), 10_000)
            let pmRes: Response
            try {
              pmRes = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type':  'application/json',
                  'Authorization': `Bearer ${serviceToken}`,
                  'X-Request-Id':  requestId,
                },
                body: JSON.stringify(pmGraphRequest),
                signal: controller.signal,
              })
            } finally {
              clearTimeout(timeoutHandle)
            }

            if (!pmRes.ok) {
              const reason = (pmRes.status === 401 || pmRes.status === 403)
                ? 'pm_graph_auth_error' : 'pm_graph_unavailable'
              console.warn(`[HEQ] pm-graph dev: HTTP ${pmRes.status} — returning degraded`)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(degraded(reason)))
              return
            }

            const data = await pmRes.json() as Record<string, unknown>
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ...data, request_id: requestId }))
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            console.warn('[HEQ] pm-graph dev: error —', msg)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(degraded('pm_graph_unavailable')))
          }
        },
      )
    },
  }
}

// ── Dev middleware: handles /api/validator locally (npm run dev) ──────────────
//
// TEMP local-testing helper. The production handler lives at api/validator.ts
// and requires a Supabase JWT + RLS-protected Postgres. For `npm run dev` this
// middleware bypasses auth entirely and stores sessions/messages in an
// in-memory Map (reset on dev-server restart). The client side has a matching
// BYPASS_AUTH flag in src/services/validatorClient.ts. To re-enable the real
// auth path, flip both flags back to false and remove this middleware from the
// plugins list below.

interface DevValidatorMessage {
  id:        string
  sessionId: string
  role:      'user' | 'assistant'
  content:   string
  createdAt: string
}
interface DevValidatorSession {
  id:              string
  userId:          string
  mode:            'quick_prototype' | 'strategic_bet'
  title:           string | null
  generatedDoc:    string | null
  docGeneratedAt:  string | null
  createdAt:       string
  updatedAt:       string
  deletedAt:       string | null
}
interface DevSessionRow {
  id:                string
  user_id:           string
  mode:              'quick_prototype' | 'strategic_bet'
  title:             string | null
  generated_doc:     string | null
  doc_generated_at:  string | null
  created_at:        string
  updated_at:        string
}
interface DevMessageRow {
  id:         string
  session_id: string
  role:       'user' | 'assistant'
  content:    string
  created_at: string
}

const VALIDATOR_DEV_USER_ID = '00000000-0000-0000-0000-000000000000'
const VALIDATOR_DEV_CHAT_MODEL      = 'claude-sonnet-4-20250514'
const VALIDATOR_DEV_CHAT_MAX_TOKENS     = 800
const VALIDATOR_DEV_GENERATE_MAX_TOKENS = 4096

function devNewId(): string {
  // Random hex; matches the look of UUIDs but doesn't need to be one.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`
}

function toSessionRow(s: DevValidatorSession): DevSessionRow {
  return {
    id:                s.id,
    user_id:           s.userId,
    mode:              s.mode,
    title:             s.title,
    generated_doc:     s.generatedDoc,
    doc_generated_at:  s.docGeneratedAt,
    created_at:        s.createdAt,
    updated_at:        s.updatedAt,
  }
}

function toMessageRow(m: DevValidatorMessage): DevMessageRow {
  return {
    id:         m.id,
    session_id: m.sessionId,
    role:       m.role,
    content:    m.content,
    created_at: m.createdAt,
  }
}

async function callAnthropicDev(
  apiKey: string,
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Promise<string> {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      VALIDATOR_DEV_CHAT_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  })
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    throw new Error(`Anthropic ${upstream.status}: ${text || 'request failed'}`)
  }
  const body = await upstream.json() as { content?: Array<{ type: string; text: string }> }
  const text = body.content?.find(b => b.type === 'text')?.text
  if (!text) throw new Error('Anthropic returned no text content')
  return text
}

function validatorDevPlugin(apiKey: string): Plugin {
  // Module-scoped store: sessionId -> {session, messages[]}
  const store = new Map<string, { session: DevValidatorSession; messages: DevValidatorMessage[] }>()

  return {
    name: 'heq-validator-dev',
    configureServer(server) {
      server.middlewares.use(
        '/api/validator',
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          // Read body
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          let body: Record<string, unknown>
          try {
            body = JSON.parse(Buffer.concat(chunks).toString())
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid JSON body.' }))
            return
          }

          const send = (status: number, payload: unknown) => {
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          }

          const op = body.op
          const userId = VALIDATOR_DEV_USER_ID

          // ── op: list ──
          if (op === 'list') {
            const sessions = Array.from(store.values())
              .filter(({ session }) => session.deletedAt === null)
              .sort((a, b) => b.session.createdAt.localeCompare(a.session.createdAt))
              .map(({ session }) => toSessionRow(session))
            send(200, { sessions })
            return
          }

          // ── op: get ──
          if (op === 'get') {
            const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
            const entry = store.get(sessionId)
            if (!entry || entry.session.deletedAt !== null) {
              send(404, { error: 'Session not found.' })
              return
            }
            send(200, {
              session:  toSessionRow(entry.session),
              messages: entry.messages.map(toMessageRow),
            })
            return
          }

          // ── op: delete (soft) ──
          if (op === 'delete') {
            const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
            const entry = store.get(sessionId)
            if (!entry) { send(404, { error: 'Session not found.' }); return }
            entry.session.deletedAt = new Date().toISOString()
            entry.session.updatedAt = entry.session.deletedAt
            send(200, { ok: true })
            return
          }

          // ── op: chat ──
          if (op === 'chat') {
            if (!apiKey) { send(500, { error: 'ANTHROPIC_API_KEY not set in .env' }); return }

            const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
            const mode      = body.mode === 'quick_prototype' || body.mode === 'strategic_bet' ? body.mode : null
            const messages  = Array.isArray(body.messages) ? body.messages as Array<{ role: 'user' | 'assistant'; content: string }> : null
            if (!sessionId)         { send(400, { error: 'sessionId is required.' });  return }
            if (!mode)              { send(400, { error: 'mode must be "quick_prototype" or "strategic_bet".' }); return }
            if (!messages?.length)  { send(400, { error: 'messages must be a non-empty array.' }); return }

            const last = messages[messages.length - 1]
            if (last.role !== 'user' || !last.content?.trim()) {
              send(400, { error: 'Last message must be a non-empty user message.' })
              return
            }

            // Ensure session exists (in-memory)
            let entry = store.get(sessionId)
            if (!entry) {
              const now = new Date().toISOString()
              entry = {
                session: {
                  id: sessionId, userId, mode,
                  title: deriveSessionTitle(last.content.trim()),
                  generatedDoc: null, docGeneratedAt: null,
                  createdAt: now, updatedAt: now, deletedAt: null,
                },
                messages: [],
              }
              store.set(sessionId, entry)
            } else if (entry.session.mode !== mode) {
              send(409, { error: 'Mode mismatch on existing session.' })
              return
            }

            // Persist user turn
            entry.messages.push({
              id: devNewId(), sessionId, role: 'user',
              content: last.content.trim(), createdAt: new Date().toISOString(),
            })

            let rawAssistantText: string
            try {
              rawAssistantText = await callAnthropicDev(
                apiKey,
                buildChatSystemPrompt(mode),
                messages,
                VALIDATOR_DEV_CHAT_MAX_TOKENS,
              )
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown upstream error'
              send(502, { error: msg })
              return
            }

            const readiness = evaluateReadiness(rawAssistantText)
            const assistantText = stripAreasTag(rawAssistantText)

            entry.messages.push({
              id: devNewId(), sessionId, role: 'assistant',
              content: assistantText, createdAt: new Date().toISOString(),
            })
            entry.session.updatedAt = new Date().toISOString()

            send(200, { message: assistantText, readiness })
            return
          }

          // ── op: generate ──
          if (op === 'generate') {
            if (!apiKey) { send(500, { error: 'ANTHROPIC_API_KEY not set in .env' }); return }

            const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
            const entry = store.get(sessionId)
            if (!entry) { send(404, { error: 'Session not found.' }); return }

            const chatHistory = entry.messages.map(m => ({ role: m.role, content: m.content }))
            if (!chatHistory.length) { send(400, { error: 'Cannot generate from an empty chat.' }); return }

            const lastAssistant = [...chatHistory].reverse().find(m => m.role === 'assistant')
            const readiness = lastAssistant ? evaluateReadiness(lastAssistant.content) : null
            const generateAnyway = body.generateAnyway === true || !readiness || !readiness.ready

            const prompt = buildGenerationPrompt({ mode: entry.session.mode, chatHistory, generateAnyway })
            let doc: string
            try {
              doc = await callAnthropicDev(
                apiKey,
                'You are an exceptional product leader. Respond with markdown only — no preamble, no code fences.',
                [{ role: 'user', content: prompt }],
                VALIDATOR_DEV_GENERATE_MAX_TOKENS,
              )
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown upstream error'
              send(502, { error: msg })
              return
            }

            const now = new Date().toISOString()
            entry.session.generatedDoc    = doc
            entry.session.docGeneratedAt  = now
            entry.session.updatedAt       = now
            send(200, { doc })
            return
          }

          send(400, { error: 'Unknown op. Expected chat | generate | list | get | delete.' })
        },
      )
    },
  }
}

// ── Vite config ───────────────────────────────────────────────────────────────

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.ANTHROPIC_API_KEY
  // Prefer dedicated evaluator key; fall back to shared key so a single-key
  // local setup still runs the rich evaluator dev middleware.
  const evaluatorKey   = env.ANTHROPIC_EVALUATOR_API_KEY || env.ANTHROPIC_API_KEY
  const pmGraphBaseUrl = env.PM_GRAPH_BASE_URL?.trim()
  const pmGraphToken   = env.PM_GRAPH_SERVICE_TOKEN?.trim()

  if (!env.ANTHROPIC_EVALUATOR_API_KEY && evaluatorKey) {
    console.warn('[HEQ] ANTHROPIC_EVALUATOR_API_KEY not set — using ANTHROPIC_API_KEY for evaluator dev middleware.')
  }
  if (!pmGraphBaseUrl || !pmGraphToken) {
    console.warn('[HEQ] PM_GRAPH_BASE_URL or PM_GRAPH_SERVICE_TOKEN not set — pm-graph dev middleware will return degraded responses.')
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Evaluator dev middleware — mounted whenever any key is available
      evaluatorKey ? evaluateTasteDevPlugin(evaluatorKey) : null,
      // PM Graph friction-case dev middleware — always mounted; returns degraded if env vars absent
      pmGraphFrictionCaseDevPlugin(pmGraphBaseUrl ?? '', pmGraphToken ?? ''),
      // Validator dev middleware — TEMP, bypasses auth and uses in-memory storage
      validatorDevPlugin(apiKey ?? ''),
    ],
    resolve: {
      // Force a single React instance — prevents "Invalid hook call" when
      // packages like @supabase/supabase-js cause Vite to bundle a second copy.
      dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    optimizeDeps: {
      // Pre-bundle all React-using packages together so esbuild shares one React copy.
      include: ['react', 'react-dom', 'react/jsx-runtime', '@supabase/supabase-js', 'recharts'],
    },
    server: {
      proxy: {
        '/api/claude': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/claude/, '/v1/messages'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Strip browser CORS headers so Anthropic treats this as a server-side request.
              proxyReq.removeHeader('origin')
              proxyReq.removeHeader('referer')
              proxyReq.removeHeader('authorization')
              if (apiKey) {
                proxyReq.setHeader('x-api-key', apiKey)
                proxyReq.setHeader('anthropic-version', '2023-06-01')
              }
            })
          },
        },
      },
    },
  }
})
