import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('srpm.user') || ''
  if (token) {
    cfg.headers['x-session'] = token
    cfg.headers.Authorization = `Bearer ${token}`
  }
  return cfg
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !String(err.config?.url || '').includes('/login')) {
      localStorage.removeItem('srpm.user')
      location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default api
