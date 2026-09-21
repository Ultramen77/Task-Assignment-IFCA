import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:3001',
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [adminClient()],
})

export type AuthSession = typeof authClient.$Infer.Session
