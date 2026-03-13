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

// ── Vite config ───────────────────────────────────────────────────────────────

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey          = env.ANTHROPIC_API_KEY
  const evaluatorKey    = env.ANTHROPIC_EVALUATOR_API_KEY

  if (!evaluatorKey) {
    // No evaluator key — dev middleware not mounted; the client receives a
    // network error which triggers the fallback to legacy /api/claude analysis.
    console.warn('[HEQ] ANTHROPIC_EVALUATOR_API_KEY not set — evaluator dev middleware disabled, falling back to legacy analysis.')
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Evaluator dev middleware — only mounted when key is available
      evaluatorKey ? evaluateTasteDevPlugin(evaluatorKey) : null,
    ],
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
