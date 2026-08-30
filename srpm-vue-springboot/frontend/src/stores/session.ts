import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '../api/http'

export type SessionUser = {
  empNo: string
  name: string
  role: string
  scope: string
  title?: string
  canFormMaintain?: boolean
}

export const useSession = defineStore('session', () => {
  const token = ref(localStorage.getItem('srpm.user') || '')
  const user = ref<SessionUser | null>(null)

  const canForm = computed(() => !!user.value && (user.value.role === 'admin' || !!user.value.canFormMaintain))

  async function login(username: string, password: string) {
    const { data } = await api.post('/login', { username, password })
    token.value = data.sessionToken
    localStorage.setItem('srpm.user', data.sessionToken)
    user.value = {
      empNo: data.empNo || data.emp_no,
      name: data.name,
      role: data.role,
      scope: data.scope,
      title: data.title,
      canFormMaintain: data.canFormMaintain,
    }
  }

  async function restore() {
    if (!token.value) return
    const { data } = await api.get('/session')
    user.value = {
      empNo: data.empNo || data.emp_no,
      name: data.name,
      role: data.role,
      scope: data.scope,
      title: data.title,
      canFormMaintain: data.canFormMaintain,
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('srpm.user')
  }

  return { token, user, canForm, login, restore, logout }
})
