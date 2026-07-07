import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Layout from './views/Layout.vue';

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
        { path: 'apply', component: () => import('./views/Apply.vue') },
        { path: 'ai', component: () => import('./views/AiAssistant.vue') },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('keyan_token');
  if (to.path !== '/login' && !token) return '/login';
  if (to.path === '/login' && token) return '/dashboard';
});

export default router;
