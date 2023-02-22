import Vue from 'vue'

// import { $api } from '@/axios'
import { usePendingable } from './usePendingable'
import { omitEmpties, toFormData } from 'vuelpers'
import { Provider } from '@/types'
import { newProvider } from '@/utils/newProvider'

const paginationables = Vue.observable({})

/**
 *
 * @param {import('vuelpers').Pagination} provider
 */
const toPaginated = (provider) => {
  return {
    ...provider,
    data:
      (provider.dataCache || {})[`${provider.currentPage}-${provider.perPage}`]
        ?.data || [],
  }
}

/**
 *
 * @param {import('vuelpers').Pagination} provider
 * @param {*} params
 */
const canPaginateInstantly = (provider, params) => {
  const perPage = params.perPage || provider.perPage
  const currentPage = params.page || provider.currentPage

  if (`${currentPage}-${perPage}` in (provider.dataCache || {})) {
    return { perPage, currentPage }
  }

  return false
}

type Options<T> = {
  id: string | ((vm: Vue) => string)
  persisted: boolean

  //
  loader: string
  provider: string
  providerInitialValue?: Provider<T>

  /**
   * v-model bindable search property name
   * common search property to search any property
   */
  search: string
  searchInitialValue?: string
  searchProvider: string
  searchProviderInitialValue?: Provider<T>
  searchLoader: string
  searchTypingTimeout?: number

  /**
   * Callable method name to fetch the data
   */
  method: string
  endpoint: string

  onResponse: <T extends Response>(res: T) => Provider<T>
  beforeFetch?: (params: Record<string, any>, vm: Vue) => Record<string, any>
  beforeSearch?: (params: Record<string, any>, vm: Vue) => Record<string, any>
}

const createPaginationable = <T extends unknown>(options: Options<T>) => {
  const {
    id,
    loader,
    provider,
    providerInitialValue,

    search = `search${id}`,
    searchInitialValue = '',
    searchLoader = `search${loader}`,
    searchProvider = `search${provider}`,
    searchProviderInitialValue,
    searchTypingTimeout = 500,

    method,
    endpoint,
    onResponse,
    beforeFetch = (params) => params,
    beforeSearch = (params) => params,
    persisted = false,
  } = options

  let typingTimeout
  let initialState = () => {
    return Vue.observable({
      [provider]: providerInitialValue,
      [search]: searchInitialValue,
      [searchProvider]: searchProviderInitialValue,
    })
  }
  let state = initialState()

  return {
    name: 'PaginationableMixin',
    mixins: [usePendingable(loader, searchLoader)],
    computed: {
      [provider]: {
        get() {
          if (state[search]) return state[searchProvider]
          return toPaginated(state[provider])
        },
        set(updatedProvider) {
          const path = state[search] ? searchProvider : provider
          state[path] = {
            ...state[path],
            ...updatedProvider,
            dataCache: {
              ...state[path].dataCache,
              [`${updatedProvider.currentPage}-${updatedProvider.perPage}`]:
                updatedProvider,
            },
          }
        },
      },
      [search]: {
        get: () => state[search],
        set(v) {
          state[search] = v
          clearTimeout(typingTimeout)
          typingTimeout = setTimeout(
            () => {
              if (state[search]) {
                return this[method]()
              }
              state[searchProvider] = {
                ...state[provider],
                data: state[provider].data.slice(0, state[provider].perPage),
              }
            },
            //
            searchTypingTimeout
          )
        },
      },
      [searchProvider]() {
        return state[searchProvider]
      },
    },
    methods: {
      [method](params = {}) {
        const isSearching = !!state[search]

        const path = isSearching ? searchProvider : provider
        const before = isSearching ? beforeSearch : beforeFetch
        const loaderName = isSearching ? searchLoader : loader

        return this.onPending(
          async (v) => {
            if (!isSearching) {
              const possible = canPaginateInstantly(state[provider], v)
              if (possible) {
                state[provider] = {
                  ...state[provider],
                  perPage: possible.perPage,
                  currentPage: possible.currentPage,
                }
              }
            }

            const [err, res] = await $api.get(
              endpoint +
                '?' +
                new URLSearchParams(
                  toFormData(v, { convertCase: 'snake_case' })
                ).toString()
            )

            if (err) {
              console.log('PaginationableMixin:err', {
                isError: err,
                meta: { endpoint, params: v },
                error: res,
              })
              return [err, res]
            }

            const resProvider = onResponse(res)
            if (isSearching) {
              state[provider].currentPage = resProvider.currentPage
              state[searchProvider] = {
                ...state[searchProvider],
                ...resProvider,
              }
              return [err, res]
            }

            state[provider] = {
              ...state[provider],
              ...resProvider,
              isLoaded: true,
              isLoading: false,
              isRefetching: false,
              perPage: +resProvider.perPage,
              dataCache: {
                ...(state[provider].dataCache || {}),
                [`${resProvider.currentPage}-${resProvider.perPage}`]:
                  resProvider,
              },
              // data: deepMerge(state[provider].data, resProvider.data, {
              // 	match: 'id',
              // 	clone: true,
              // 	method: 'push',
              // }),
            }

            return [err, res]
          },
          omitEmpties(
            before(
              {
                [search]: state[search],
                perPage: state[path].perPage,
                page: isSearching ? 1 : state[provider].currentPage,
                ...params,
              },
              this
            )
          ),
          loaderName
        )
      },
    },
    created() {
      let _id = typeof id === 'function' ? id(this) : id
      if (persisted && _id in paginationables) {
        state = Vue.observable(paginationables[_id])
      }
    },
    beforeDestroy() {
      if (persisted) {
        let _id = typeof id === 'function' ? id(this) : id
        paginationables[_id] = state
      }
      state = initialState()
    },
  }
}

export { createPaginationable }
