/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of backend API (production: https://flight-project-production.up.railway.app) */
  readonly VITE_API_BASE: string
  /** WebSocket endpoint (wss://.../ws/notifications) */
  readonly VITE_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
