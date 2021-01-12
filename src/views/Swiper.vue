<template>
  <div id='swiper'>
    <router-link :to='{name: "Chats"}'>Go to chats</router-link>
    <div class='card-container'>
      <draggable-card></draggable-card>
    </div>
  </div>
</template>

<script>
import DraggableCard from '@/components/DraggableCard'
import { mapGetters } from 'vuex'

export default {
  name: 'Swiper',
  components: {
    DraggableCard
  },
  mounted () {
    // If the user is not logged in, push them to login
    if (!this.loggedIn) {
      this.$router.replace({ name: 'Login' })
    }
  },
  computed: {
    ...mapGetters('user', ['loggedIn', 'hasUserData'])
  }
}
</script>

<style lang="scss" scoped>
#swiper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  width: 100%;
  height: 100%;
  .card-container {
    width: 40vw;
    height: 40vh;
  }
}
</style>
