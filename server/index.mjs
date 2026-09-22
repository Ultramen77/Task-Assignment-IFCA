import express from 'express'
import cors from 'cors'
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'
import { auth } from './auth.mjs'
import { allowedOrigins } from './env.mjs'
import { dataRouter } from './data.mjs'

const app = express()
const port = Number(process.env.AUTH_PORT || 3001)
const origins = allowedOrigins()

app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error(`Origin not allowed: ${origin}`))
  },
  credentials: true,
}))

// Better Auth must receive the raw request before express.json() consumes it.
app.all('/api/auth/*splat', toNodeHandler(auth))

app.use(express.json({ limit: '10mb' }))

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'task-assignment-auth' })
})

app.get('/api/session', async (request, response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
  response.json(session)
})

async function requireSession(request, response, next) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
    if (!session) {
      response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Login required.' } })
      return
    }
    request.authSession = session
    next()
  } catch (error) {
    next(error)
  }
}

app.use('/api/data', requireSession, dataRouter)

app.use((error, _request, response, _next) => {
  console.error('[auth-server]', error)
  response.status(500).json({ error: 'Internal auth server error' })
})

app.listen(port, () => {
  console.log(`[auth-server] listening on http://localhost:${port}`)
  console.log(`[auth-server] allowed origins: ${origins.join(', ')}`)
})
