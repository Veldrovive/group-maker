import Vue from 'vue'

const state = () => ({
  loggedIn: false,
  currGroup: { course: null, group: null },
  user: {},
  chats: []
})

const getters = {
  group (state) {
    return state.currGroup
  },
  loggedIn (state) {
    return state.loggedIn
  },
  hasUserData (state) {
    return state.user.uuid != null
  },
  user (state) {
    return state.user
  },
  uuid (state) {
    return state.user.uuid
  },
  reviewQueue (state) {
    return state.user.reviewQueue
  },
  chats (state) {
    return state.chats
  }
}

const mutations = {
  setCurrGroup (state, groupData) {
    state.currGroup.course = groupData.course
    state.currGroup.group = groupData.group
  },
  setUserData (state, userData) {
    state.currGroup.course = userData.group.course
    state.currGroup.group = userData.group.group

    state.user = userData.user
    state.chats = userData.chats
  },
  logIn (state) {
    state.loggedIn = true
  },
  popReview (state, uuid) {
    if (state.user.uuid != null) {
      console.log('Deleting', uuid, 'from', state.user.reviewQueue, 'so', state.user.reviewQueue[uuid])
      Vue.delete(state.user.reviewQueue, uuid)
    }
  }
}

const actions = {
  'SOCKET_updateUserData' ({ commit }, userData) {
    if (userData.success) {
      commit('setUserData', userData)
    }
  },
  'SOCKET_loggedIn' ({ commit }, res) {
    if (res.success) {
      commit('logIn')
    }
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
