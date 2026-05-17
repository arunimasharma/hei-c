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
  buildChatSystemPrompt,
  buildGenerationPrompt,
  evaluateReadiness,
  stripAreasTag,
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

// ── Dev middleware: handles /api/validator locally (npm run dev) ──────────────
//
// Stateless mirror of api/validator.ts for the Vite dev server. The Validator
// is unauthenticated; sessions/messages are persisted client-side in
// localStorage (see src/services/validatorClient.ts). This middleware just
// proxies to Anthropic for `chat` and `generate`.

const VALIDATOR_DEV_CHAT_MODEL          = 'claude-sonnet-4-20250514'
const VALIDATOR_DEV_CHAT_MAX_TOKENS     = 800
const VALIDATOR_DEV_GENERATE_MAX_TOKENS = 4096

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

          if (!apiKey) {
            send(500, { error: 'ANTHROPIC_API_KEY not set in .env' })
            return
          }

          const op       = body.op
          const mode     = body.mode === 'quick_prototype' || body.mode === 'strategic_bet' ? body.mode : null
          const messages = Array.isArray(body.messages)
            ? body.messages as Array<{ role: 'user' | 'assistant'; content: string }>
            : null

          if (op !== 'chat' && op !== 'generate') {
            send(400, { error: 'Unknown op. Expected "chat" or "generate".' })
            return
          }
          if (!mode) {
            send(400, { error: 'mode must be "quick_prototype" or "strategic_bet".' })
            return
          }
          if (!messages?.length) {
            send(400, { error: 'messages must be a non-empty array.' })
            return
          }

          if (op === 'chat') {
            const last = messages[messages.length - 1]
            if (last.role !== 'user' || !last.content?.trim()) {
              send(400, { error: 'Last message must be a non-empty user message.' })
              return
            }

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
            send(200, { message: assistantText, readiness })
            return
          }

          // op === 'generate'
          const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
          const readiness = lastAssistant ? evaluateReadiness(lastAssistant.content) : null
          const generateAnyway = body.generateAnyway === true || !readiness || !readiness.ready

          const prompt = buildGenerationPrompt({ mode, chatHistory: messages, generateAnyway })
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
          send(200, { doc })
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

  if (!env.ANTHROPIC_EVALUATOR_API_KEY && evaluatorKey) {
    console.warn('[HEQ] ANTHROPIC_EVALUATOR_API_KEY not set — using ANTHROPIC_API_KEY for evaluator dev middleware.')
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Evaluator dev middleware — mounted whenever any key is available
      evaluatorKey ? evaluateTasteDevPlugin(evaluatorKey) : null,
      // Idea Validator dev middleware — stateless Anthropic proxy (no auth)
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
