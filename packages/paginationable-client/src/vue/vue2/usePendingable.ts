import { isExactSame } from '@/utils/isExactSame'
const usePendingable = (...loaderNames) => {
  const defaultLoaderName = 'isLoading'
  if (!loaderNames.length) loaderNames = [defaultLoaderName]

  const data = {}
  const loaders = loaderNames.reduce((loaders, loaderName) => {
    data[loaderName] = false
    loaders[loaderName] = {
      lastParams: null,
    }
    return loaders
  }, {})

  return {
    name: 'PendingableMixin',
    data: () => ({ ...data }),
    methods: {
      async onPending(callback, params, loaderName = loaderNames[0]) {
        const loader = loaders[loaderName] || this[loaderName]
        if (params === loader.lastParams) return

        loader.lastParams = params
        if (this[loaderName]) return

        this[loaderName] = true
        const response = await callback(params)
        this[loaderName] = false

        if (!isExactSame(params, loader.lastParams)) {
          params = loader.lastParams
          loader.lastParams = null

          return this.onPending(callback, params, loaderName)
        }
        return response
      },
    },
  }
}

export { usePendingable }
