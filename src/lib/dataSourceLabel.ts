const source = import.meta.env.VITE_DATA_SOURCE

export const DATA_SOURCE_LABEL = source === 'postgres'
  ? 'PostgreSQL API'
  : source === 'supabase'
    ? 'Supabase'
    : 'Mock data'
