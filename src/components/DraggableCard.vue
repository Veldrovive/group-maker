<template>
  <div v-if='hasUserData' class='draggable-card' :style='{height, width}'>
    <!-- <div class='card'>

    </div> -->
    <v-sheet v-if='nextReviewObject == null' class='card undercard'>
      <v-skeleton-loader
        class="mx-auto"
        type="card"
      >
      </v-skeleton-loader>
    </v-sheet>
    <person-card :person='nextReviewObject' class='undercard'>
    </person-card>
    <Vue2InteractDraggable
      v-if='draggableVisible && currentReviewObject != null'
      class='card'
      @draggedRight='right'
      @draggedLeft='left'
      interact-lock-y-axis
      :interact-out-of-sight-x-coordinate="sWidth/2 + 15"
      :interact-out-of-sight-y-coordinate="sHeight/2 + 15"
      :interact-max-rotation="15"
      :interact-x-threshold="sWidth/6"
      :interact-y-threshold="sHeight/6"
    >
      <person-card :person='currentReviewObject'>
      </person-card>
    </Vue2InteractDraggable>
    <person-card v-else-if='draggableVisible'>
    </person-card>
  </div>
</template>

<script>
import PersonCard from '@/components/PersonCard'
import { Vue2InteractDraggable } from 'vue2-interact'
import { mapGetters } from 'vuex'

export default {
  name: 'DraggableCard',
  props: ['height', 'width'],
  components: {
    Vue2InteractDraggable,
    PersonCard
  },
  data: () => ({
    draggableVisible: true
    // reviewQueue: {
    //   '4d887823-c12e-55b3-8cb3-cfe07b457548': {
    //     name: 'Test Person One',
    //     timezone: 't1',
    //     bio: 'A Human...',
    //     sellYourself: '$20',
    //     email: 'test1@mail.com',
    //     uuid: '4d887823-c12e-55b3-8cb3-cfe07b457548'
    //   },
    //   'f8c60daf-e344-5236-9a96-c89e92134ce0': {
    //     name: 'Test Person Three',
    //     timezone: 't2',
    //     bio: 'Kinda Human...',
    //     sellYourself: '$10',
    //     email: 'test3@mail.com',
    //     uuid: 'f8c60daf-e344-5236-9a96-c89e92134ce0'
    //   }
    // }
  }),
  watch: {
    reviewQueue () {
      this.draggableVisible = true
    },
    user () {
      this.draggableVisible = true
    }
  },
  methods: {
    right () {
      setTimeout(() => { this.draggableVisible = false }, 50)
      setTimeout(() => {
        // this.$delete(this.reviewQueue, this.currentReviewObject.uuid)
        // this.$store.commit('user/popReview', this.currentReviewObject.uuid)
        this.draggableVisible = true
      }, 100)

      console.log(this.currentReviewObject.uuid, 'was dragged right')
      this.$socket.emit('swipe', { course: this.group.course, group: this.group.group, uuid: this.currentReviewObject.uuid, rightSwipe: true }, res => {
        console.log('Swipe success:', res.success)
      })
    },
    left () {
      setTimeout(() => { this.draggableVisible = false }, 50)
      setTimeout(() => {
        // this.$delete(this.reviewQueue, this.currentReviewObject.uuid)
        // this.$store.commit('user/popReview', this.currentReviewObject.uuid)
        this.draggableVisible = true
      }, 100)

      console.log(this.currentReviewObject.uuid, 'was dragged left')
      this.$socket.emit('swipe', { course: this.group.course, group: this.group.group, uuid: this.currentReviewObject.uuid, rightSwipe: false }, res => {
        console.log('Swipe success:', res.success)
      })
    }
  },
  computed: {
    ...mapGetters('user', ['reviewQueue', 'hasUserData', 'user', 'group']),
    toReviewIds () {
      return Object.keys(this.reviewQueue)
    },
    currentReviewObject () {
      if (this.toReviewIds[0] != null) {
        return this.reviewQueue[this.toReviewIds[0]]
      } else {
        return null
      }
    },
    nextReviewObject () {
      if (this.toReviewIds[1] != null) {
        return this.reviewQueue[this.toReviewIds[1]]
      } else {
        return null
      }
    },
    sWidth () {
      return window.innerWidth
    },
    sHeight () {
      return window.innerHeight
    }
  }
}
</script>

<style lang="scss" scoped>
.draggable-card {
  position: relative;
  width: 100%;
  height: 100%;
  .card {
    // background: red;
    position: absolute;
    width: 100%;
    height: 100%;
    overflow: scroll;
  }
  .undercard {
    top: 2px;
    left: 2px;
    z-index: -1;
  }
}
</style>
