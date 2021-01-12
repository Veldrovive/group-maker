<template>
  <section>
    <v-form v-if='joiningGroup'>
      <v-text-field v-model='name' label='Name' required></v-text-field>
      <v-text-field v-model='timezone' label='Timezone' required></v-text-field>
      <v-text-field v-model='bio' label='Bio' required></v-text-field>
      <v-text-field v-model='onMatchMessage' label='On Match Message'></v-text-field>
      <v-btn
        :disabled="!valid"
        color="success"
        class="mr-4"
        @click="tryJoinGroup"
      >
        Join Group
      </v-btn>
    </v-form>
    <v-form v-else v-model='valid'>
      <v-text-field v-model='email' label='Email' required></v-text-field>
      <v-text-field v-model='course' label='Course' required></v-text-field>
      <v-text-field v-model='group' label='Group' required></v-text-field>
      <v-btn
        :disabled="!valid"
        color="success"
        class="mr-4"
        @click="login"
      >
        Log In
      </v-btn>
    </v-form>
  </section>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Login',
  data: () => ({
    valid: true,
    email: '',
    course: '',
    group: '',

    joiningGroup: false,
    name: '',
    timezone: '',
    bio: '',
    onMatchMessage: ''
  }),
  mounted () {
    this.recallLoginInfo()
  },
  computed: {
    ...mapGetters('user', { currGroup: 'group' })
  },
  methods: {
    async login () {
      if (this.email && this.course && this.group) {
        console.log('Logging in with:', this.email, this.course, this.group)
        this.saveLoginInfo()
        const loginSuccessful = await this.tryLogin()
        if (loginSuccessful) {
          this.$store.commit('user/setCurrGroup', { course: this.course, group: this.group })
          const [getDataSuccessful, reason] = await this.tryGetUserData()
          if (!getDataSuccessful && reason === 'Not in group') {
            this.joiningGroup = true
          }
        }
      }
    },
    async tryLogin () {
      return new Promise(resolve => {
        this.$socket.emit('login', { email: this.email }, res => {
          resolve(res.success)
        })
      })
    },
    async tryGetUserData () {
      return new Promise(resolve => {
        if (this.currGroup.course == null || this.currGroup.group == null) {
          return resolve(null)
        }
        this.$socket.emit('getData', this.currGroup, res => {
          resolve([res.success, res.reason])
          if (res.success) {
            this.$router.push({ name: 'Swiper' })
          }
        })
      })
    },
    async tryJoinGroup () {
      return new Promise(resolve => {
        this.$socket.emit('joinGroup', { course: this.currGroup.course, group: this.currGroup.group, name: this.name, timezone: this.timezone, bio: this.bio, onMatchMessage: this.onMatchMessage }, res => {
          resolve(res.success)
          this.tryGetUserData()
        })
      })
    },
    saveLoginInfo () {
      localStorage.setItem('email', this.email)
      localStorage.setItem('course', this.course)
      localStorage.setItem('group', this.group)
    },
    recallLoginInfo () {
      this.email = localStorage.getItem('email') || ''
      this.course = localStorage.getItem('course') || ''
      this.group = localStorage.getItem('group') || ''
    }
  }
}
</script>

<style lang="scss" scoped>

</style>
