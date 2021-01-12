<template>
  <section>
    <v-card class='card' v-if='person != null'>
      <v-card-title>{{ name }}</v-card-title>
      <v-card-text>Timezone: {{ timezone }}</v-card-text>
      <v-card-text>Bio: {{ bio }}</v-card-text>
    </v-card>
    <v-card class='card' v-else>
      <v-card-title>No People to Review.</v-card-title>
      <v-card-text>Just sit back and wait for a match</v-card-text>
    </v-card>
  </section>
</template>

<script>
export default {
  name: 'PersonCard',
  props: ['person'],
  computed: {
    name () {
      return this.person.name
    },
    timezone () {
      return this.person.timezone
    },
    bio () {
      return this.person.bio
    },
    sellYouself () {
      return this.person.sellYouself
    },
    email () {
      return this.person.email
    },
    uuid () {
      return this.person.uuid
    }
  }
}
</script>

<style lang="scss" scoped>
.card {
  // background: red;
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: scroll;
}
</style>
