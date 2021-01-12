import Vue from 'vue'
import VueRouter from 'vue-router'

import Login from '@/views/Login'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Login',
    component: Login
  },
  {
    path: '/chats',
    name: 'Chats',
    component: () => import('../views/Chats.vue')
  },
  {
    path: '/swiper',
    name: 'Swiper',
    component: () => import('../views/Swiper.vue')
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
