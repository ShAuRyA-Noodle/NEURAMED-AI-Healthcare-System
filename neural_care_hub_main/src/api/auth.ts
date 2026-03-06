import api from './client'
import { AuthToken, LoginCredentials, RegisterData, User } from '../types'

export const login = async (credentials: LoginCredentials): Promise<AuthToken> => {
  const { data } = await api.post('/api/auth/login', credentials)
  return data
}

export const register = async (userData: RegisterData): Promise<AuthToken> => {
  const { data } = await api.post('/api/auth/register', userData)
  return data
}

export const getMe = async (): Promise<User> => {
  const { data } = await api.get('/api/auth/me')
  return data
}
