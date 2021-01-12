import Vue from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'

import { v4 as uuidv4 } from 'uuid'
import VueSocketIO from 'vue-socket.io'
import SocketIO from 'socket.io-client'

import store from './store'
import router from './router'

// Set a cookie if it does not exist
const cookieName = 'handler'
const cookieMaxAge = 60 * 60 * 24 * 10 // This is stored in number of seconds so this is ten days.
if (document.cookie.indexOf(`${cookieName}=`) === -1) {
  const cookieValue = uuidv4()
  document.cookie = `${cookieName}=${cookieValue}; max-age=${cookieMaxAge}`
}

Vue.use(new VueSocketIO({
  debug: process.env.NODE_ENV === 'development',
  connection: SocketIO(process.env.NODE_ENV === 'development' ? 'http://localhost:8081' : '/', { reconnection: false }),
  vuex: {
    store,
    actionPrefix: 'SOCKET_'
  },
  options: {
    reconnection: false
  }
}))

Vue.config.productionTip = false

new Vue({
  router,
  vuetify,
  store,
  render: h => h(App)
}).$mount('#app')
