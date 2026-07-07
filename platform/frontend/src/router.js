import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Layout from './views/Layout.vue';
import { homeRouteForRole } from './roles';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login },
    {
      path: '/',
      component: Layout,
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', component: () => import('./views/Dashboard.vue') },
        { path: 'ledger', component: () => import('./views/Ledger.vue') },
        { path: 'projects/:id', component: () => import('./views/ProjectDetail.vue') },
        { path: 'risks', component: () => import('./views/Risks.vue') },
        { path: 'outcomes', component: () => import('./views/Outcomes.vue') },
        { path: 'partners', component: () => import('./views/Partners.vue') },
        { path: 'todos', component: () => import('./views/Todos.vue') },
        { path: 'approvals', component: () => import('./views/Approvals.vue') },
        { path: 'apply', component: () => import('./views/Apply.vue') },
        { path: 'ai', component: () => import('./views/AiAssistant.vue') },
        { path: 'board', component: () => import('./views/Board.vue') },
        { path: 'admin', component: () => import('./views/Admin.vue') },
        { path: 'roles', component: () => import('./views/RolesDoc.vue') },
        { path: 'channels', component: () => import('./views/ChannelFlows.vue') },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('keyan_token');
  if (to.path !== '/login' && !token) return '/login';
  if (to.path === '/login' && token) {
    const user = JSON.parse(localStorage.getItem('keyan_user') || '{}');
    return homeRouteForRole(user.role);
  }
});

export default router;
