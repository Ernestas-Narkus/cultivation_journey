const SAVE_KEY = 'cultivationJourneySave'
const LEGACY_KEY = 'gameDataSave'
const SAVE_VERSION = 1
const RENAMES = {}

var resetting = false

function reportStatus(message) {
    if (typeof showStatus === "function") {
        showStatus(message)
    } else {
        console.warn(message)
    }
}

function resolveName(name) {
    return Object.prototype.hasOwnProperty.call(RENAMES, name) ? RENAMES[name] : name
}

function isPlainObject(x) {
    return x !== null && typeof x === "object" && !Array.isArray(x)
}

function isValidNumber(x) {
    return typeof x === "number" && isFinite(x) && x >= 0
}

function isValidInteger(x) {
    return isValidNumber(x) && Math.floor(x) === x
}

function getLadderMaxIndex(ladder) {
    if (ladder === undefined || ladder === null) return -1
    var length = typeof ladder.length === "number" ? ladder.length : Object.keys(ladder).length
    return length - 1
}

function utf8ToBase64(text) {
    var bytes = new TextEncoder().encode(text)
    var binary = ""
    for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
}

function base64ToUtf8(base64) {
    var binary = window.atob(base64.trim())
    var bytes = new Uint8Array(binary.length)
    for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return new TextDecoder("utf-8", {fatal: true}).decode(bytes)
}

function replaceContents(target, source) {
    for (var k in target) {
        delete target[k]
    }
    for (var s in source) {
        target[s] = source[s]
    }
}

// Obsolete after the rewrite; kept as no-ops so existing callers do not break.
function assignMethods() {}
function replaceSaveDict(dict, saveDict) {}

function buildSaveObject() {
    var tasks = {}
    for (var name in gameData.taskData) {
        var task = gameData.taskData[name]
        tasks[name] = {level: task.level, maxLevel: task.maxLevel, xp: task.xp}
    }

    var unlocked = []
    for (var key in requirements) {
        if (requirements[key].completed === true) unlocked.push(key)
    }

    var misc = []
    if (Array.isArray(gameData.currentMisc)) {
        for (var i = 0; i < gameData.currentMisc.length; i++) {
            misc.push(gameData.currentMisc[i].name)
        }
    }

    return {
        v: SAVE_VERSION,
        coins: gameData.coins,
        days: gameData.days,
        evil: gameData.evil,
        paused: gameData.paused,
        timeWarpingEnabled: gameData.timeWarpingEnabled,
        speedMultiplier: gameData.speedMultiplier,
        martialRank: gameData.martialRank,
        cultivationRank: gameData.cultivationRank,
        rebirthOneCount: gameData.rebirthOneCount,
        rebirthTwoCount: gameData.rebirthTwoCount,
        settings: JSON.parse(JSON.stringify(gameData.settings)),
        loadouts: JSON.parse(JSON.stringify(gameData.loadouts)),
        collapsedCategories: JSON.parse(JSON.stringify(gameData.collapsedCategories)),
        skippedSkills: JSON.parse(JSON.stringify(gameData.skippedSkills)),
        tasks: tasks,
        unlocked: unlocked,
        current: {
            job: gameData.currentJob ? gameData.currentJob.name : "Beggar",
            skill: gameData.currentSkill ? gameData.currentSkill.name : "Concentration",
            property: gameData.currentProperty ? gameData.currentProperty.name : "Homeless",
            misc: misc
        }
    }
}

function validateSave(obj) {
    var errors = []
    if (!isPlainObject(obj)) {
        return {ok: false, errors: ["Save data is not an object"]}
    }
    if (obj.v !== SAVE_VERSION) errors.push("Unsupported save version: " + obj.v)

    var numberFields = ["coins", "days", "evil", "speedMultiplier"]
    for (var i = 0; i < numberFields.length; i++) {
        var nf = numberFields[i]
        if (nf in obj && !isValidNumber(obj[nf])) errors.push(nf + " must be a finite number >= 0")
    }

    var integerFields = ["rebirthOneCount", "rebirthTwoCount"]
    for (var j = 0; j < integerFields.length; j++) {
        var inf = integerFields[j]
        if (inf in obj && !isValidInteger(obj[inf])) errors.push(inf + " must be an integer >= 0")
    }

    var booleanFields = ["paused", "timeWarpingEnabled"]
    for (var b = 0; b < booleanFields.length; b++) {
        var bf = booleanFields[b]
        if (bf in obj && typeof obj[bf] !== "boolean") errors.push(bf + " must be a boolean")
    }

    var rankFields = [["martialRank", typeof martialArtsRanks !== "undefined" ? martialArtsRanks : null],
                      ["cultivationRank", typeof cultivationRanks !== "undefined" ? cultivationRanks : null]]
    for (var r = 0; r < rankFields.length; r++) {
        var rf = rankFields[r][0]
        if (rf in obj) {
            var maxIndex = getLadderMaxIndex(rankFields[r][1])
            if (typeof obj[rf] !== "number" || Math.floor(obj[rf]) !== obj[rf] || obj[rf] < -1 || obj[rf] > maxIndex) {
                errors.push(rf + " must be an integer from -1 to " + maxIndex)
            }
        }
    }

    var objectFields = ["settings", "loadouts", "collapsedCategories", "skippedSkills", "tasks", "current"]
    for (var o = 0; o < objectFields.length; o++) {
        var of = objectFields[o]
        if (of in obj && !isPlainObject(obj[of])) errors.push(of + " must be an object")
    }

    if (isPlainObject(obj.skippedSkills)) {
        for (var sk in obj.skippedSkills) {
            if (obj.skippedSkills[sk] !== true) {
                errors.push("skippedSkills." + sk + " must be true")
            }
        }
    }

    if (isPlainObject(obj.tasks)) {
        for (var name in obj.tasks) {
            var t = obj.tasks[name]
            if (!isPlainObject(t)) {
                errors.push("tasks." + name + " must be an object")
                continue
            }
            if ("level" in t && !isValidInteger(t.level)) errors.push("tasks." + name + ".level must be an integer >= 0")
            if ("maxLevel" in t && !isValidInteger(t.maxLevel)) errors.push("tasks." + name + ".maxLevel must be an integer >= 0")
            if ("xp" in t && !isValidNumber(t.xp)) errors.push("tasks." + name + ".xp must be a finite number >= 0")
        }
    }

    if ("unlocked" in obj) {
        if (!Array.isArray(obj.unlocked)) {
            errors.push("unlocked must be an array")
        } else {
            for (var u = 0; u < obj.unlocked.length; u++) {
                if (typeof obj.unlocked[u] !== "string") {
                    errors.push("unlocked must contain only strings")
                    break
                }
            }
        }
    }

    if (isPlainObject(obj.current)) {
        var c = obj.current
        if ("misc" in c && !Array.isArray(c.misc)) errors.push("current.misc must be an array")
        var nameFields = ["job", "skill", "property"]
        for (var n = 0; n < nameFields.length; n++) {
            if (nameFields[n] in c && typeof c[nameFields[n]] !== "string") errors.push("current." + nameFields[n] + " must be a string")
        }
    }

    return {ok: errors.length === 0, errors: errors}
}

function migrateSave(obj) {
    if (!isPlainObject(obj)) return obj

    // Legacy format: the whole gameData object serialized as JSON.
    if (obj.v === undefined && isPlainObject(obj.taskData)) {
        var tasks = {}
        for (var name in obj.taskData) {
            var t = obj.taskData[name]
            if (isPlainObject(t)) tasks[name] = {level: t.level, maxLevel: t.maxLevel, xp: t.xp}
        }

        var unlocked = []
        if (isPlainObject(obj.requirements)) {
            for (var key in obj.requirements) {
                if (isPlainObject(obj.requirements[key]) && obj.requirements[key].completed === true) unlocked.push(key)
            }
        }

        var misc = []
        if (Array.isArray(obj.currentMisc)) {
            for (var i = 0; i < obj.currentMisc.length; i++) {
                if (obj.currentMisc[i] && typeof obj.currentMisc[i].name === "string") misc.push(obj.currentMisc[i].name)
            }
        }

        var migrated = {
            v: SAVE_VERSION,
            tasks: tasks,
            unlocked: unlocked,
            current: {
                job: obj.currentJob ? obj.currentJob.name : undefined,
                skill: obj.currentSkill ? obj.currentSkill.name : undefined,
                property: obj.currentProperty ? obj.currentProperty.name : undefined,
                misc: misc
            }
        }
        var copied = ["coins", "days", "evil", "paused", "timeWarpingEnabled", "speedMultiplier",
                      "martialRank", "cultivationRank", "rebirthOneCount", "rebirthTwoCount",
                      "settings", "loadouts", "collapsedCategories"]
        for (var c = 0; c < copied.length; c++) {
            if (copied[c] in obj) migrated[copied[c]] = obj[copied[c]]
        }
        return migrated
    }

    return obj
}

function applySave(obj) {
    var numberFields = ["coins", "days", "evil", "speedMultiplier", "rebirthOneCount", "rebirthTwoCount", "paused", "timeWarpingEnabled"]
    for (var i = 0; i < numberFields.length; i++) {
        if (numberFields[i] in obj) gameData[numberFields[i]] = obj[numberFields[i]]
    }

    var rankFields = [["martialRank", typeof martialArtsRanks !== "undefined" ? martialArtsRanks : null],
                      ["cultivationRank", typeof cultivationRanks !== "undefined" ? cultivationRanks : null]]
    for (var r = 0; r < rankFields.length; r++) {
        var rf = rankFields[r][0]
        if (rf in obj && obj[rf] >= -1 && obj[rf] <= getLadderMaxIndex(rankFields[r][1])) gameData[rf] = obj[rf]
    }

    if (isPlainObject(obj.settings)) {
        for (var s in gameData.settings) {
            if (s in obj.settings && typeof obj.settings[s] === typeof gameData.settings[s]) {
                gameData.settings[s] = obj.settings[s]
            }
        }
    }
    if (isPlainObject(obj.loadouts)) replaceContents(gameData.loadouts, obj.loadouts)
    if (isPlainObject(obj.collapsedCategories)) replaceContents(gameData.collapsedCategories, obj.collapsedCategories)
    if (isPlainObject(obj.skippedSkills)) replaceContents(gameData.skippedSkills, obj.skippedSkills)

    if (isPlainObject(obj.tasks)) {
        for (var name in obj.tasks) {
            var task = gameData.taskData[resolveName(name)]
            if (!task) continue
            var saved = obj.tasks[name]
            if ("level" in saved) task.level = saved.level
            if ("maxLevel" in saved) task.maxLevel = saved.maxLevel
            if ("xp" in saved) task.xp = saved.xp
        }
    }

    var unlockedSet = {}
    if (Array.isArray(obj.unlocked)) {
        for (var u = 0; u < obj.unlocked.length; u++) {
            unlockedSet[resolveName(obj.unlocked[u])] = true
        }
    }
    for (var key in requirements) {
        requirements[key].completed = unlockedSet[key] === true
    }

    var current = isPlainObject(obj.current) ? obj.current : {}

    var job = gameData.taskData[resolveName(current.job)]
    gameData.currentJob = (job && job.baseData && job.baseData.income) ? job : gameData.taskData["Beggar"]

    var skill = gameData.taskData[resolveName(current.skill)]
    gameData.currentSkill = (skill && skill.baseData && !skill.baseData.income) ? skill : gameData.taskData["Concentration"]

    var propertyName = resolveName(current.property)
    var property = gameData.itemData[propertyName]
    var isProperty = typeof itemCategories !== "undefined" && itemCategories["Properties"] && itemCategories["Properties"].includes(propertyName)
    gameData.currentProperty = (property && isProperty) ? property : gameData.itemData["Homeless"]

    gameData.currentMisc.length = 0
    if (Array.isArray(current.misc)) {
        for (var m = 0; m < current.misc.length; m++) {
            var miscName = resolveName(current.misc[m])
            var item = gameData.itemData[miscName]
            var miscIsProperty = typeof itemCategories !== "undefined" && itemCategories["Properties"] && itemCategories["Properties"].includes(miscName)
            if (item && !miscIsProperty && gameData.currentMisc.indexOf(item) === -1) gameData.currentMisc.push(item)
        }
    }
}

function saveGameData() {
    if (resetting) return
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveObject()))
    } catch (e) {
        reportStatus("Could not save game: " + e.message)
    }
}

function loadGameData() {
    var raw = null
    try {
        raw = localStorage.getItem(SAVE_KEY)
        if (raw === null) raw = localStorage.getItem(LEGACY_KEY)
    } catch (e) {
        reportStatus("Could not read saved game: " + e.message)
        return
    }
    if (raw === null) return

    var reason = null
    try {
        var obj = migrateSave(JSON.parse(raw))
        var result = validateSave(obj)
        if (result.ok) {
            applySave(obj)
        } else {
            reason = result.errors.join("; ")
        }
    } catch (e) {
        reason = "Save could not be loaded: " + e.message
    }

    if (reason !== null) {
        try {
            localStorage.setItem(SAVE_KEY + "_corrupt_" + Date.now(), raw)
        } catch (e) {}
        reportStatus(reason)
    }
}

function resetGameData() {
    if (!confirm("Reset all progress? This cannot be undone.")) return
    resetting = true
    try {
        localStorage.removeItem(SAVE_KEY)
        localStorage.removeItem(LEGACY_KEY)
    } catch (e) {}
    location.reload()
}

function importGameData() {
    var importExportBox = document.getElementById("importExportBox")
    var obj
    try {
        obj = migrateSave(JSON.parse(base64ToUtf8(importExportBox.value)))
    } catch (e) {
        reportStatus("Import failed: " + e.message)
        return
    }

    var result = validateSave(obj)
    if (!result.ok) {
        reportStatus("Import failed: " + result.errors.join("; "))
        return
    }

    resetting = true
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(obj))
    } catch (e) {
        resetting = false
        reportStatus("Import failed: " + e.message)
        return
    }
    location.reload()
}

function exportGameData() {
    var importExportBox = document.getElementById("importExportBox")
    importExportBox.value = utf8ToBase64(JSON.stringify(buildSaveObject()))
}