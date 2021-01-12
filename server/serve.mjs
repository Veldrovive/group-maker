const PORT = 80

import history from 'connect-history-api-fallback'
import express from 'express'
import socketIO from 'socket.io'
import http from 'http'

import Log from './logger.mjs'
import { BaseUser } from './MatcherInfo.mjs'

function getCookie(name, cookie) {
    const value = `; ${cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

class SocketHandler extends BaseUser {
    constructor (socket) {
        super()
        this.loggedIn = false
        this.setSocket(socket)

        this.subjects = {}
        this.subscriptions = []  // Stores references to the observables created from subject.subscribe so they can be removed on disconnect.

        Log.info('New Socket Connection:')
        Log.info(`   ip: ${this.ip}`)
        Log.info(`   connection time: ${this.creationTime}`)
        Log.info(`   Handler Id: ${this.handlerId}`)
    }

    static getSocketHandlerId (socket) {
        const headers = socket.handshake.headers
        return getCookie('handler', headers.cookie)
    }

    setSocket (socket) {
        this.lastConnected = null
        this.socket = socket
        this.ip = this.socket.handshake.address
        this.creationTime = new Date(this.socket.handshake.time)
        this.headers = this.socket.handshake.headers
        this.handlerId = getCookie('handler', this.headers.cookie)

        socket.on('disconnect', () => {
            this.lastConnected = new Date()
            socket.removeAllListeners()
            socket.disconnect(true)
            Log.debug(`Handler ${this.handlerId} with socket ${socket.id} disconnected from ${this.ip}`)
        })

        socket.on('login', (meta, ack) => {
            const { email } = meta
            if (email != null) {
                this.updateEmail(email)
                this.loggedIn = true
                socket.emit('loggedIn', { success: true })
                if (ack) {
                    ack({ success: true })
                }
            } else {
                socket.emit('loggedIn', { success: false, reason: 'No Email' })
                if (ack) {
                    ack({ success: false, reason: 'No Email' })
                }
            }
        })

        socket.on('getData', (meta, ack) => {
            const { course, group } = meta
            if (!this.loggedIn) {
                socket.emit('updateUserData', { success: false, reason: 'Not logged in', course, group })
                if (ack) {
                    ack({ success: false, reason: 'Not logged in', course, group })
                }
                return
            }
            try {
                const data = {success: true, group: {course, group}, ...this.getData(course, group)}
                socket.emit('updateUserData', data)
                if (ack) {
                    ack(data)
                }
            } catch (err) {
                socket.emit('updateUserData', { success: false, reason: 'Not in group', course, group })
                if (ack) {
                    ack({ success: false, reason: 'Not in group', course, group })
                }
            }
        })

        socket.on('joinGroup', (meta, ack) => {
            const { course, group, name, timezone, bio, sellYourself, onMatchMessage } = meta
            if (!this.loggedIn) {
                socket.emit('joinedGroup', { success: false, reason: 'Not logged in', course, group })
                if (ack) {
                    ack({ success: false, reason: 'Not logged in', course, group })
                }
                return
            }
            try {
                this.joinGroup(course, group, { name, timezone, bio, sellYourself, onMatchMessage })
                socket.emit('joinedGroup', { success: true, course, group })
                if (ack) {
                    ack({ success: true, course, group })
                }
            } catch (err) {
                socket.emit('joinedGroup', { success: false, reason: err, course, group })
                if (ack) {
                    ack({ success: false, reason: err, course, group })
                }
            }
        })

        socket.on('swipe', (meta, ack) => {
            const { course, group, uuid, rightSwipe } = meta
            if (!this.loggedIn) {
                socket.emit('swiped', { success: false, reason: 'Not logged in', course, group })
                if (ack) {
                    ack({ success: false, reason: 'Not logged in', course, group })
                }
                return
            }
            try {
                this.swipe(course, group, uuid, rightSwipe)
                socket.emit('swiped', { success: true, course, group })
                if (ack) {
                    ack({ success: true, course, group })
                }
            } catch (err) {
                socket.emit('swiped', { success: false, reason: err, course, group })
                if (ack) {
                    ack({ success: false, reason: err, course, group })
                }
            }
        })

        socket.on('acceptMatch', (meta, ack) => {
            const { course, group, uuid } = meta
            if (!this.loggedIn) {
                socket.emit('acceptedMatch', { success: false, reason: 'Not logged in', course, group })
                if (ack) {
                    ack({ success: false, reason: 'Not logged in', course, group })
                }
                return
            }
            try {
                this.acceptMatch(course, group, uuid)
                socket.emit('acceptedMatch', { success: true, course, group })
                if (ack) {
                    ack({ success: true, course, group })
                }
            } catch (err) {
                socket.emit('acceptedMatch', { success: false, reason: err, course, group })
                if (ack) {
                    ack({ success: false, reason: err, course, group })
                }
            }
        })

        socket.on('rejectMatch', (meta, ack) => {
            const { course, group, uuid } = meta
            if (!this.loggedIn) {
                socket.emit('rejectedMatch', { success: false, reason: 'Not logged in', course, group })
                if (ack) {
                    ack({ success: false, reason: 'Not logged in', course, group })
                }
                return
            }
            try {
                this.rejectMatch(course, group, uuid)
                socket.emit('rejectedMatch', { success: true, course, group })
                if (ack) {
                    ack({ success: true, course, group })
                }
            } catch (err) {
                socket.emit('rejectedMatch', { success: false, reason: err, course, group })
                if (ack) {
                    ack({ success: false, reason: err, course, group })
                }
            }
        })

        socket.on('chat', (meta, ack) => {
            const { course, group, uuid, message } = meta
            if (!this.loggedIn) {
                socket.emit('sentChat', { success: false, reason: 'Not logged in', course, group })
                if (ack) {
                    ack({ success: false, reason: 'Not logged in', course, group })
                }
                return
            }
            try {
                this.chat(course, group, uuid, message)
                socket.emit('sentChat', { success: true, course, group })
                if (ack) {
                    ack({ success: true, course, group })
                }
            } catch (err) {
                socket.emit('sentChat', { success: false, reason: err, course, group })
                if (ack) {
                    ack({ success: false, reason: err, course, group })
                }
            }
        })
    }

    onMatch (data) {
        Log.debug(`${this.email} has a new match`)
        data = {success: true, ...data}
        this.socket.emit('updateUserData', data)
    }

    onMatchConfirmed (data) {
        Log.debug(`${this.email} has a new confirmed match`)
        data = {success: true, ...data}
        this.socket.emit('updateUserData', data)
    }

    onNewReviewQueue (data) {
        Log.debug(`${this.email} has a new reviewQueue`)
        data = {success: true, ...data}
        this.socket.emit('updateUserData', data)
    }

    onChat (data) {
        Log.debug(`${this.email} has a new chat`)
        data = {success: true, ...data}
        this.socket.emit('updateUserData', data)
    }
}

const handlers = {}
function createSocketHandler (socket) {
    const handlerId = SocketHandler.getSocketHandlerId(socket)
    if (handlerId in handlers) {
        Log.info(`Attaching ${socket.handshake.address} to ${handlerId}`)

        const oldHandler = handlers[handlerId]
        oldHandler.setSocket(socket)
    } else {
        const handler = new SocketHandler(socket)
        Log.debug(`Creating new handler for ${handler.ip} with id ${handler.handlerId}`)

        handlers[handler.handlerId] = handler
    }
}

async function main() {
    const app = express()
    const server = http.createServer(app)
    const io = socketIO(server)
    app.use(history())
    app.use(express.static("./dist"))

    io.on('connect', createSocketHandler)

    server.listen(PORT, () => {
        Log.info(`Server started at: ${PORT}`)
    });
}

main()