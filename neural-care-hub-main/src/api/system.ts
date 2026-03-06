import client from './client'
import type { SystemInfo } from '../types'

export const getSystemInfo = async (): Promise<SystemInfo> => {
    const { data } = await client.get('/api/system/info')
    return data
}
