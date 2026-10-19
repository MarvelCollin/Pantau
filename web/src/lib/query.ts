import { QueryClient, type Query } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { createStore, del, get, set } from 'idb-keyval'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
      retry: (count, error) => {
        if (error instanceof ApiError && (error.status === 503 || error.status === 404)) return false
        return count < 2
      },
      retryDelay: (attempt) => Math.min(30_000, 2_000 * 2 ** attempt),
      gcTime: 30 * 60_000,
    },
  },
})

const idb = createStore('pantau', 'query-cache')

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key, idb).then((v) => v ?? null),
    setItem: (key, value) => set(key, value, idb),
    removeItem: (key) => del(key, idb),
  },
  key: 'pantau-cache',
  throttleTime: 2_000,
})

export const persistOptions = {
  persister,
  maxAge: 7 * 24 * 60 * 60_000,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) => query.meta?.persist === true && query.state.status === 'success',
  },
}
