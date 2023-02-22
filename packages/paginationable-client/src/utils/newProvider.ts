import { Provider } from '@/types'
export const newProvider = <T>(v?: Partial<Provider<T>>): Provider<T> => {
  return {
    page: v?.page || 1,
    perPage: v?.perPage || 10,
    total: v?.total || 0,
    data: v?.data || [],
  }
}
