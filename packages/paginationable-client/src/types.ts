export type Provider<T> = {
  page: number
  perPage: number
  total: number
  data: T[]
}
