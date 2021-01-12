<template>
  <div id='chats'>
    <div id='chat-list'>
      <v-list>
        <v-list-item v-for='(chat, index) in chats' :key='index' @click='openChat(index)'>
          <v-list-item-content>
            To: {{ getOtherParticipant(chat) }}
            <v-divider></v-divider>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </div>
    <div id='chat'>
      <div id='chat-area'>
        <v-list v-if='this.currentChat != null'>
          <v-list-item v-for='(message, index) in openMessages' :key='index'>
            <v-list-item-content>
              <p :class='{ "own-message": isOwnMessage(message) }'>
                {{ message.message }}
              </p>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </div>
      <v-footer>
        <v-text-field v-model='currentMessage' class='mr-3' placeholder='Message'>

        </v-text-field>
        <v-btn @click='sendMessage' class='mr-1'>
          Send
        </v-btn>
        <v-btn @click='acceptMatch'>
          {{ matched ? 'Match Accepted' : 'Accept Match' }}
        </v-btn>
      </v-footer>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Chats',
  mounted () {
    // If the user is not logged in, push them to login
    if (!this.loggedIn) {
      this.$router.replace({ name: 'Login' })
    }
  },
  data: () => ({
    currentChatIndex: -1,

    currentMessage: ''
  }),
  computed: {
    ...mapGetters('user', ['loggedIn', 'chats', 'uuid', 'group', 'user', 'hasUserData']),
    currentChat () {
      return this.chats[this.currentChatIndex]
    },
    openMessages () {
      if (this.currentChat != null) {
        return this.currentChat.chats
      }
      return []
    },
    matched () {
      if (this.currentChat != null) {
        const otherUuid = this.getOtherParticipantUuid(this.currentChat)
        return this.user.taken === otherUuid
      }
      return false
    }
  },
  methods: {
    getOtherParticipant (chat) {
      const participants = chat.participants
      const otherUuid = Object.keys(participants).filter(id => id !== this.uuid)[0]
      return participants[otherUuid]
    },
    getOtherParticipantUuid (chat) {
      const participants = chat.participants
      const otherUuid = Object.keys(participants).filter(id => id !== this.uuid)[0]
      return otherUuid
    },
    openChat (chatIndex) {
      this.currentChatIndex = chatIndex
    },
    isOwnMessage (message) {
      console.log(message.sender, this.uuid, message.sender === this.uuid)
      return message.sender === this.uuid
    },

    sendMessage () {
      const otherUuid = this.getOtherParticipantUuid(this.currentChat)
      console.log('Sending:', this.currentMessage, 'to', otherUuid)
      this.$socket.emit('chat', { course: this.group.course, group: this.group.group, uuid: otherUuid, message: this.currentMessage }, res => {
        if (res.success) {
          this.currentMessage = ''
        }
      })
    },
    acceptMatch () {
      const otherUuid = this.getOtherParticipantUuid(this.currentChat)
      console.log('Accepting match with', otherUuid)
      this.$socket.emit('acceptMatch', { course: this.group.course, group: this.group.group, uuid: otherUuid }, res => {
        if (res.success) {
          console.log('Accepting match')
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
#chats {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: row;

  #chat-list {
    height: 100%;
    width: 50%
  }

  #chat {
    height: 100%;
    width: 50%;
    display: flex;
    flex-direction: column;

    #chat-area {
      flex: 1 0 auto;
      overflow: scroll;

      .own-message {
        text-align: right;
      }
    }
  }
}
</style>
