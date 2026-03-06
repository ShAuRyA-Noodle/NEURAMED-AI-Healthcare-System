import client from './client'
import type { SearchResults } from '../types'

export const globalSearch = async (query: string): Promise<SearchResults> => {
    const { data } = await client.get('/api/search', { params: { q: query } })
    return data
}
