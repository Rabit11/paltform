import { createRouter, createWebHistory } from 'vue-router'
import { useSession } from '../stores/session'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('../views/LoginView.vue') },
    {
      path: '/',
      component: () => import('../views/AppLayout.vue'),
      children: [
        { path: '', redirect: '/cockpit' },
        { path: 'cockpit', component: () => import('../views/CockpitView.vue') },
        { path: 'projects', component: () => import('../views/ProjectsView.vue') },
        { path: 'ledger', component: () => import('../views/LedgerView.vue') },
        { path: 'admin/members', component: () => import('../views/MembersView.vue') },
        { path: 'admin/people', component: () => import('../views/PeopleView.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const s = useSession()
  if (to.path !== '/login' && !s.token) return '/login'
  if (to.path === '/login' && s.token) return '/cockpit'
})

export default router
