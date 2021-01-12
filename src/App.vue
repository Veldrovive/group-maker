<template>
  <v-app>
    <div class='app'>
      <router-view/>
      <!-- <div class='card-container'>
        <draggable-card></draggable-card>
      </div> -->
    </div>
  </v-app>
</template>

<script>
// import DraggableCard from '@/components/DraggableCard'

export default {
  name: 'App',
  components: {
    // DraggableCard
  }
}
</script>

<style lang='scss'>
.app {
  display: flex;
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
