import Vue from 'vue'
import Vuex from 'vuex'

import user from './modules/user'

Vue.use(Vuex)

const debug = process.env.NODE_ENV !== 'production'

export default new Vuex.Store({
  modules: {
    user
  },
  state: {
    isConnected: false
  },
  mutations: {
    setConnected (state, connected) {
      state.isConnected = connected
    }
  },
  actions: {
    SOCKET_connect ({ commit }) {
      commit('setConnected', true)
    },
    SOCKET_disconnect ({ commit }) {
      commit('setConnected', false)
    }
  },
  strict: debug
})
