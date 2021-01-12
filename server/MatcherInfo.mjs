import { group } from 'console';
import fs from 'fs'
import { fileURLToPath } from 'url';
import uuid from 'uuid-by-string'

import Log from './logger.mjs'

const DATA_PATH = './server/data'

class MatcherInfo {
    /**
     * Stores user info that is used for matching.
     * Nobody has any swipes 
     * -> randomly place a person in everybody's reviewQueue
     * -> push the queue to all users
     * -> once a response is recieved, remove the original from the review queue and place it in rightSwipes or leftSwipes accordingly. 
     * -> Whenever a queue is empty, choose a person who is not in the rightSwipes or leftSwipes and who has taken set to false and put them in the reviewQueue
     *      Choosing a new person should be done via a rank system. Having the same timezone is positive, having less people in reviewQueue is positive, having more people in rightSwipes is positive.
     * -> Everybody who was swiped right on has the person that swiped right on them placed into their reviewQueue
     * -> Whenever a new right swipe is made, check if that person has the swiper in their rightSwipes. If they are there, these two are matched and we should push a notification to both that leads to a simple text chain.
     * -> If both people choose to be in the group, the taken flag is set to the uuid of the other for each.
     */
    constructor () {
        this.data = {} // Stores data as { COURSE_NAME: { GROUP_NAME: { courses: COURSE_NAME, group: GROUP_NAME, chats: {uuid1!uuid2: { hidden: boolean, participants: [uuid1, uuid2], accepted: [?uuid1, ?uuid2], chats: [] } } users: { UUID: { name, timezone, bio, sellYourself, rightSwipes, leftSwipes, matches, taken, email, reviewQueue, chats } } } } }
        this.load()
        this.startSaveCycle()

        this.callbacks = {
            onMatch: {},
            onMatchConfirmed: {},
            onNewReviewQueue: {},
            onChat: {}
        }
    }

    on (event, callback, uuid) {
        // Registers a callback on a certain event for a certain user.
        if (!(event in this.callbacks)) {
            throw 'Callback does not exist'
        } else {
            this.callbacks[event][uuid] = callback
        }
    }

    removeCallbacks (uuid) {
        // Removes all callbacks for a userr
        for (const event of Object.keys(this.callbacks)) {
            this.callbacks[event][uuid] = undefined
        }
    }

    spawnCallback (event, uuid, groupObj) {
        // Calls the correct callback for the supplied uuid. Supplied data is ({ group, course }, userObject, chatsList)
        const callback = this.callbacks[event][uuid]
        if (callback == null) {
            return false
        }
        const group = { group: groupObj.group, course: groupObj.course }
        const [user, chats] = this.getUserData(groupObj, uuid)

        callback({ group, user, chats })
        return true
    }

    getUserData (groupObj, uuid) {
        // Gets the userObject and non-hidden chats for a user in a group.
        const user = { ...groupObj.users[uuid] } // Clone it so that chaning matches does not edit the actual object.

        const matchObjects = user.matches.map(matchId => {
            const match = groupObj.users[matchId]
            return {
                name: match.name,
                timezone: match.timezone,
                bio: match.bio,
                sellYourself: match.sellYourself,
                email: match.email,
                uuid: match.uuid
            }
        })
        const matches = {}
        matchObjects.forEach(match => matches[match.uuid] = match)
        user.matches = matches

        const reviewQueueObjects = user.reviewQueue.map(matchId => {
            const match = groupObj.users[matchId]
            return {
                name: match.name,
                timezone: match.timezone,
                bio: match.bio,
                sellYourself: match.sellYourself,
                email: match.email,
                uuid: match.uuid
            }
        })
        const reviewQueue = {}
        reviewQueueObjects.forEach(obj => reviewQueue[obj.uuid] = obj)
        user.reviewQueue = reviewQueue

        const chats = user.chats.map(chatId => groupObj.chats[chatId]).filter(chat => !chat.hidden)
        user.chats = undefined // Remove chats from the user so they can't access hidden ones.
        return [user, chats]
    }

    addGroup (course, group) {
        course = MatcherInfo.toValidPath(course)
        group = MatcherInfo.toValidPath(group)

        if (!(course in this.data)) {
            this.data[course] = {}
        }
        if (!(group in this.data[course])) {
            this.data[course][group] = {users: {}, chats: {}, course, group}
        }

        return this.data[course][group]
    }

    getGroup (course, group) {
        course = MatcherInfo.toValidPath(course)
        group = MatcherInfo.toValidPath(group)

        let groupObj = null
        try {
            groupObj = this.data[course][group]
        } catch (err) {
            throw 'No such course'
        }
        if (groupObj == null) {
            throw 'No such group'
        }
        Log.debug(`Retrieved group ${course}/${group} by name`)

        return groupObj
    }

    static getUUID (email) {
        return uuid(email)
    }

    addUser (groupObj, email, params) {
        const { name, timezone, bio, sellYourself, onMatchMessage } = params
        const group = groupObj.users

        for (const user of Object.values(group)) {
            if (email === user.email) {
                return 'User already created'
            }
        }

        const uuid = MatcherInfo.getUUID(email)
        group[uuid] = { name, timezone, bio, sellYourself, onMatchMessage, uuid, rightSwipes: [], leftSwipes: [], matches: [], tags: [], taken: null, email, reviewQueue: [], chats: [] }
        Log.debug(`Added new user ${uuid} with email ${email}`, group[uuid])

        this.checkAllUsersQueue(groupObj) // A new person joining means that it is possible that a person has nobody in their reviewQueue. We fix that.

        return uuid
    }

    rankUsers (groupObj, senderUuid) {
        // Uses the current user uuid and finds the best match.
        const sender = groupObj.users[senderUuid]
        let bestScore = -1 * Infinity
        let bestMatch = null
        for (const [uuid, params] of Object.entries(groupObj.users)) {
            let score = 0
            if (params.taken != null || uuid === senderUuid) {
                // This person is already matched. Just move on... DEBORA!!! I STILL LOVE YOU!!!
                continue
            }
            if (sender.rightSwipes.includes(uuid) || sender.leftSwipes.includes(uuid) || sender.reviewQueue.includes(uuid)) {
                // Then this person is already being reviewed by our sender. They are disquailified.
                continue
            }
            score += params.timezone === sender.timezone ? 10 : -5 // 10 points for having the same timezone and -5 for having different ones
            score += -2 * params.reviewQueue.length // Remove two points for each person in the potentials reviewQueue
            score += 1 * params.rightSwipes.length // Having lots of people in your rightSwipes but no match

            if (score > bestScore) {
                bestScore = score
                bestMatch = uuid
            }
        }
        return bestMatch
    }

    fillUserQueue (groupObj, uuid) {
        const group = groupObj.users
        const user = group[uuid]
        if (user == null) {
            throw 'No such user'
        }
        if (user.reviewQueue.length > 0) {
            Log.debug(`Upon filling ${uuid} queue, we found it already has a user.`)
            return // The queue already has a member, don't add another until they've processed that one.
        }

        const toReview = this.rankUsers(groupObj, uuid)
        if (toReview != null) {
            Log.debug(`Found ${toReview} to add to the reviewQueue of ${uuid}`)
            this.addToReviewQueue(groupObj, uuid, toReview)
            return true
        } else {
            // Then no potential was found. Out of luck.
            Log.debug(`Nobody was found to be reviewed by ${uuid}`)
            return false
        }
    }

    checkAllUsersQueue (groupObj) {
        // Used to refresh all users to make sure everybody has at least one person in their queue.
        for (const uuid of Object.keys(groupObj.users)) {
            this.fillUserQueue(groupObj, uuid)
        }
    } 

    addToReviewQueue (groupObj, uuid, toReviewUuid) {
        const group = groupObj.users
        const target = group[uuid]
        const toReview = group[toReviewUuid]
        if (target == null || toReview == null) {
            throw 'Swiper or swipee does not exist'
        }
        const reviewQueue = target.reviewQueue
        const leftSwipes = target.leftSwipes
        const rightSwipes = target.rightSwipes
        if (leftSwipes.includes(toReviewUuid) || rightSwipes.includes(toReviewUuid) || reviewQueue.includes(toReviewUuid)) {
            // Then the user has already been reviewed or is already queued to review. In either case, no need to review them again.
            Log.debug(`Tried to add ${toReviewUuid} to reviewQueue of ${uuid}, but they have already been reviewed or are being reviewed`)
            return false
        } else {
            // Then this user has not yet been reviewed by our target. We will add them to the queue
            reviewQueue.push(toReviewUuid)
            Log.debug(`Added ${toReviewUuid} to reviewQueue of ${uuid}. Now ${reviewQueue}`)
            this.spawnCallback('onNewReviewQueue', uuid, groupObj)
            return true
        }
    }

    static getChatId (uuid1, uuid2) {
        return [uuid1, uuid2].sort().join('!')
    }

    acceptMatch (groupObj, accepterUuid, otherUuid) {
        const chatId = MatcherInfo.getChatId(accepterUuid, otherUuid)
        const chat = groupObj.chats[chatId]
        chat.accepted.push(accepterUuid)
        this.checkMatchConfirmed(groupObj, accepterUuid, otherUuid)
        this.spawnCallback('onChat', otherUuid, groupObj)
        this.spawnCallback('onChat', accepterUuid, groupObj)
    }

    rejectMatch (groupObj, rejecterUuid, otherUuid) {
        const chatId = MatcherInfo.getChatId(rejecterUuid, otherUuid)
        const chat = groupObj.chats[chatId]
        chat.hidden = true
        this.spawnCallback('onChat', otherUuid, groupObj)
        this.spawnCallback('onChat', rejecterUuid, groupObj)
    }

    checkMatchConfirmed (groupObj, uuid1, uuid2) {
        const chatId = MatcherInfo.getChatId(uuid1, uuid2)
        const chat = groupObj.chats[chatId]
        if (chat == null) {
            return false
        }
        let confirmed = true
        for (const uuid of Object.keys(chat.participants)) {
            if (!chat.accepted.includes(uuid)) {
                confirmed = false
            }
        }
        if (confirmed) {
            this.onMatchConfirmed(groupObj, uuid1, uuid2)
            return true
        } else {
            return false
        }
    }

    onMatchConfirmed (groupObj, uuid1, uuid2) {
        // Confirms the match between uuid1 and uuid2. Sets both to taken and removes them from all other's reviewQueue.
        const users = groupObj.users
        const u1 = users[uuid1]
        const u2 = users[uuid2]
        u1.taken = uuid2
        u2.taken = uuid1
        for (const user of Object.values(users)) {
            // Remove both users from all other's reviewQueues
            user.reviewQueue = user.reviewQueue.filter(id => id !== uuid1 && id !== uuid2)
        }
        this.spawnCallback('onMatchConfirmed', uuid1, groupObj)
        this.spawnCallback('onMatchConfirmed', uuid2, groupObj)
    }

    sendChat (groupObj, fromUuid, toUuid, message) {
        const chatId = MatcherInfo.getChatId(fromUuid, toUuid)
        const chat = groupObj.chats[chatId]
        if (chat == null) {
            return
        }
        chat.chats.push({ date: new Date(), sender: fromUuid, message: message })
        this.spawnCallback('onChat', fromUuid, groupObj)
        this.spawnCallback('onChat', toUuid, groupObj)
    }

    spawnChat (groupObj, uuid1, uuid2) {
        // Creates a new chat between uuid1 and uuid2
        const chatId = MatcherInfo.getChatId(uuid1, uuid2)
        const users = groupObj.users
        const u1 = users[uuid1]
        const u2 = users[uuid2]
        const u1Message = u1.onMatchMessage || `Hi, I'm ${u1.name}.`
        const u2Message = u2.onMatchMessage || `Hi, I'm ${u2.name}.`
        const chats = []
        groupObj.chats[chatId] = { hidden: false, participants: {}, accepted: [], chats }
        groupObj.chats[chatId].participants[uuid1] = u1.name
        groupObj.chats[chatId].participants[uuid2] = u2.name
        u1.chats.push(chatId)
        u2.chats.push(chatId)

        this.sendChat(groupObj, uuid1, uuid2, u1Message)
        this.sendChat(groupObj, uuid2, uuid1, u2Message)
    }

    checkMatch (groupObj, uuid1, uuid2) {
        // Checks if both uuid1 and uui2 have eachother in their rightSwipes. If so, add the other to the matches array and spawns a new chat.
        const users = groupObj.users
        const u1 = users[uuid1]
        const u2 = users[uuid2]
        if (u1.rightSwipes.includes(uuid2) && u2.rightSwipes.includes(uuid1)) {
            // Then this is a match
            if (!u1.matches.includes(uuid2)) {
                u1.matches.push(uuid2)
            }
            if (!u2.matches.includes(uuid1)) {
                u2.matches.push(uuid1)
            }
            this.spawnChat(groupObj, uuid1, uuid2)
            this.spawnCallback('onMatch', uuid1, groupObj)
            this.spawnCallback('onMatch', uuid2, groupObj)
        }
    }

    onUserSwiped (groupObj, swiperUuid, swipeeUuid, rightSwipe) {
        const group = groupObj.users
        const swiper = group[swiperUuid]
        const swipee = group[swipeeUuid]
        if (swiper == null || swipee == null) {
            throw 'Swiper or swipee does not exist'
        }
        swiper.reviewQueue = swiper.reviewQueue.filter(id => id !== swipeeUuid)
        if (rightSwipe) {
            // Then our swiper has swiped right on them. We will put them in the swipers rightSwipes list so that they can be matched later
            // and put the swiper in the swipee's reviewQueue so that they can be matched as soon as possible
            Log.debug(`User ${swiperUuid} swiped right on ${swipeeUuid}`)
            swiper.rightSwipes.push(swipeeUuid)
            this.checkMatch(groupObj, swiperUuid, swipeeUuid)
            this.addToReviewQueue(groupObj, swipeeUuid, swiperUuid)
            this.spawnCallback('onNewReviewQueue', swiperUuid, groupObj)
        } else {
            // Then our swiper has swiped left on the swipee. We will put them in the swipers leftSwipes list so that they can not be re-added to the reviewQueue
            Log.debug(`User ${swiperUuid} swiped left on ${swipeeUuid}`)
            swiper.leftSwipes.push(swipeeUuid)
            this.spawnCallback('onNewReviewQueue', swiperUuid, groupObj)
            // return false
        }
        this.fillUserQueue(groupObj, swiperUuid)
    }

    static toValidPath (str) {
        return str.replace(/[ &\/\\#,+()$~%.'":*?<>{}]/g, "")
    }

    save () {
        Log.debug('Saving')
        for (const [courseName, course] of Object.entries(this.data)) {
            Log.debug(`Saving course: ${courseName}`)
            if (!fs.existsSync(`${DATA_PATH}/${courseName}`)){
                fs.mkdirSync(`${DATA_PATH}/${courseName}`);
            }
            for (const [groupName, group] of Object.entries(course)) {
                Log.debug(`Saving group: ${groupName} of course: ${courseName}`)
                const groupPath = groupName + '.json'
                const data = JSON.stringify(group)
                fs.writeFileSync(`${DATA_PATH}/${courseName}/${groupPath}`, data)
            }
        }
    }

    startSaveCycle () {
        setInterval(this.save.bind(this), 30*1000)
    }

    load () {
        for (const courseName of fs.readdirSync(DATA_PATH)) {
            Log.debug(`Loading course: ${courseName}`)
            for (const groupName of fs.readdirSync(`${DATA_PATH}/${courseName}`)) {
                Log.debug(`Loading group: ${groupName} of course: ${courseName}`)
                this.addGroup(courseName, groupName.split('.')[0])
                this.data[courseName][groupName.split('.')[0]] = JSON.parse(fs.readFileSync(`${DATA_PATH}/${courseName}/${groupName}`))
            }
        }
    }
}

const info = new MatcherInfo()

export class BaseUser {
    constructor (email) {
        this.updateEmail(email)
        this.info = info // So that superclasses can easily access info if they need to
    }

    updateEmail (email) {
        if (this.uuid != null) {
            info.removeCallbacks(this.uuid)
        }
        if (email != null) {
            this.email = email
            this.uuid = MatcherInfo.getUUID(email)

            info.on('onMatch', this.onMatch.bind(this), this.uuid)
            info.on('onMatchConfirmed', this.onMatchConfirmed.bind(this), this.uuid)
            info.on('onNewReviewQueue', this.onNewReviewQueue.bind(this), this.uuid)
            info.on('onChat', this.onChat.bind(this), this.uuid)
        }
    }

    joinGroup (course, group, params) {
        if (params.name != null && this.email != null) {
            const groupObj = info.addGroup(course, group)
            info.addUser(groupObj, this.email, params)
        }
    }

    clean () {
        info.removeCallbacks(this.uuid)
    }

    swipe (course, group, uuid, rightSwipe) {
        const groupObj = info.getGroup(course, group)
        info.onUserSwiped(groupObj, this.uuid, uuid, rightSwipe)
    }

    chat (course, group, uuid, message) {
        const groupObj = info.getGroup(course, group)
        info.sendChat(groupObj, this.uuid, uuid, message)
    }

    acceptMatch (course, group, uuid) {
        const groupObj = info.getGroup(course, group)
        info.acceptMatch(groupObj, this.uuid, uuid)
    }

    rejectMatch (course, group, uuid) {
        const groupObj = info.getGroup(course, group)
        info.rejectMatch(groupObj, this.uuid, uuid)
    }

    refreshQueue (course, group) {
        const groupObj = info.getGroup(course, group)
        info.fillUserQueue(groupObj, this.uuid)
    }

    getData (course, group) {
        const groupObj = info.getGroup(course, group)
        const [userData, chats] = info.getUserData(groupObj, this.uuid)
        return { groupData: { course, group }, user: userData, chats }
    }

    onMatch (data) {
        Log.debug(`Should be overwritten - onMatch for ${data.user.name}:`, data)
    }

    onMatchConfirmed (data) {
        Log.debug(`Should be overwritten - onMatchConfirmed for ${data.user.name}:`, data)
    }

    onNewReviewQueue (data) {
        Log.debug(`Should be overwritten - onNewReviewQueue for ${data.user.name}:`, data)
    }

    onChat (data) {
        Log.debug(`Should be overwritten - onChat for ${data.user.name}:`, data)
    }
}

function createTestData (matcher) {
    // matcher.addGroup('TEST_COURSE', 'TEST_GROUP')
    const u1 = new BaseUser('test1@mail.com')
    const u2 = new BaseUser('test2@mail.com')
    const u3 = new BaseUser('test3@mail.com')

    u1.joinGroup('TEST_COURSE', 'TEST_GROUP', { name: 'Test Person One', timezone: 't1', bio: 'A Human...', sellYourself: '$20' })
    u2.joinGroup('TEST_COURSE', 'TEST_GROUP', { name: 'Test Person Two', timezone: 't1', bio: 'A Human Also...', sellYourself: '$20.01' })
    u3.joinGroup('TEST_COURSE', 'TEST_GROUP', { name: 'Test Person Three', timezone: 't2', bio: 'Kinda Human...', sellYourself: '$10' })

    u1.swipe('TEST_COURSE', 'TEST_GROUP', u2.uuid, true)
    u1.swipe('TEST_COURSE', 'TEST_GROUP', u3.uuid, false)
    u3.swipe('TEST_COURSE', 'TEST_GROUP', u1.uuid, false)
    // u3.swipe('TEST_COURSE', 'TEST_GROUP', u2.uuid, true)
    u2.swipe('TEST_COURSE', 'TEST_GROUP', u1.uuid, true)

    u1.chat('TEST_COURSE', 'TEST_GROUP', u2.uuid, 'You are a human as well, correct?')
    u2.chat('TEST_COURSE', 'TEST_GROUP', u1.uuid, 'Affirmative!!')

    u1.acceptMatch('TEST_COURSE', 'TEST_GROUP', u2.uuid)
    u2.acceptMatch('TEST_COURSE', 'TEST_GROUP', u1.uuid)

    u1.chat('TEST_COURSE', 'TEST_GROUP', u2.uuid, 'I am glad of your acceptance!')
    u2.chat('TEST_COURSE', 'TEST_GROUP', u1.uuid, 'I hope that we can communicate effectively.')

    // u1.rejectMatch('TEST_COURSE', 'TEST_GROUP', u2.uuid)

    // u3.swipe('TEST_COURSE', 'TEST_GROUP', u1.uuid, false)
    // u2.swipe('TEST_COURSE', 'TEST_GROUP', u1.uuid, true)


    // const group = matcher.getGroup('TEST_COURSE', 'TEST_GROUP')
    // const u1 = matcher.addUser(group, 'test1@mail.com', { name: 'Test Person One', timezone: 't1', bio: 'A Human...', sellYourself: '$20' })
    // const u2 = matcher.addUser(group, 'test2@mail.com', { name: 'Test Person Two', timezone: 't1', bio: 'A Human Also...', sellYourself: '$20.01' })
    // const u3 = matcher.addUser(group, 'test3@mail.com', { name: 'Test Person Three', timezone: 't2', bio: 'Kinda Human...', sellYourself: '$10' })

    // matcher.onUserSwiped(group, u1, u2, true)
    // matcher.onUserSwiped(group, u3, u1, false)
    // matcher.onUserSwiped(group, u2, u1, true)
    Log.debug('End Group:', info.getGroup('TEST_COURSE', 'TEST_GROUP'))
    Log.debug('Non-group:', u2.getData('TEST_COURSE','TEST_GROUP'))
}

function testMatcher () {
    createTestData(info)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    Log.debug('Running Matcher Tests')
    testMatcher()
} 
export default info