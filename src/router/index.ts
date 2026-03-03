import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/form',
      name: 'form',
      component: () => import('@/views/FormView.vue'),
    },
    {
      path: '/roster',
      name: 'roster',
      component: () => import('@/views/RosterView.vue'),
    },
    {
      path: '/heatmap',
      name: 'heatmap',
      component: () => import('@/views/HeatmapView.vue'),
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('@/views/AnalyticsView.vue'),
    },
    {
      path: '/raids',
      name: 'raids',
      component: () => import('@/views/RaidsView.vue'),
    },
    {
      path: '/raids/:id',
      name: 'raid-detail',
      component: () => import('@/views/RaidDetailView.vue'),
    },
    {
      path: '/kara',
      name: 'kara',
      component: () => import('@/views/KaraView.vue'),
    },
    {
      path: '/dkp',
      name: 'dkp',
      component: () => import('@/views/DkpView.vue'),
    },
    {
      path: '/dkp/player/:name',
      name: 'dkp-player',
      component: () => import('@/views/DkpPlayerDetailView.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
})

export default router
