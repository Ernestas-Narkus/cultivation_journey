var gameData = {
    taskData: {},
    itemData: {},

    coins: 0,
    collapsedCategories: {},
    days: 365 * 14,
    evil: 0,
    paused: false,
    timeWarpingEnabled: true,
    speedMultiplier: 1,

    skippedSkills: {},

    loadouts: {},
    settings: {
        stickySidebar: false,
        autoPause: false,
    },

    martialRank: -1,
    cultivationRank: -1,

    rebirthOneCount: 0,
    rebirthTwoCount: 0,

    currentJob: null,
    currentSkill: null,
    currentProperty: null,
    currentMisc: null,
}

var skillWithLowestMaxXp = null

const autoPromoteElement = document.getElementById("autoPromote")
const autoLearnElement = document.getElementById("autoLearn")

const jobTabButton = document.getElementById("jobTabButton")

//Init

createAllRows(jobCategories, "jobTable")
createAllRows(skillCategories, "skillTable")
createAllRows(itemCategories, "itemTable") 
runSafely(function() { createRankList("martialRankList", martialArtsRanks) })
runSafely(function() { createRankList("cultivationRankList", cultivationRanks) })

createData(gameData.taskData, jobBaseData)
createData(gameData.taskData, skillBaseData)
createData(gameData.itemData, itemBaseData) 

gameData.currentJob = gameData.taskData["Beggar"]
gameData.currentSkill = gameData.taskData["Concentration"]
gameData.currentProperty = gameData.itemData["Homeless"]
gameData.currentMisc = []

requirements = buildRequirements()

loadGameData()
runSafely(applyCollapsedCategories)
runSafely(function() {
    initUI()
    if (typeof validateContent === "function") validateContent()
})

setCustomEffects()
addMultipliers()

document.getElementById("body").classList.add("dark")

setTab(jobTabButton, "jobs")

//Multi-tab guard: once locked, every save in this tab is skipped.

var saveLocked = false
var saveGameDataRaw = saveGameData

saveGameData = function() {
    if (saveLocked) return
    saveGameDataRaw()
}

window.addEventListener("storage", function(e) {
    if (saveLocked) return
    if (e.key !== null && e.key !== SAVE_KEY) return
    saveLocked = true
    showStatus("Game was changed in another tab - reload to continue")
})

//Simulation loop

var SIM_STEP_MS = 1000 / updateSpeed
var MAX_STEPS_PER_TICK = 200
var RENDER_INTERVAL_MS = 50

var lastTickTime = performance.now()
var lastRenderTime = lastTickTime
var stepAccumulator = 0

function tick() {
    var now = performance.now()
    var elapsed = now - lastTickTime
    lastTickTime = now
    if (elapsed < 0) elapsed = 0
    stepAccumulator += elapsed

    var steps = 0
    while (stepAccumulator >= SIM_STEP_MS && steps < MAX_STEPS_PER_TICK) {
        simulateStep()
        stepAccumulator -= SIM_STEP_MS
        steps += 1
    }
    if (stepAccumulator >= SIM_STEP_MS) {
        stepAccumulator = 0
    }

    if (!document.hidden && now - lastRenderTime >= RENDER_INTERVAL_MS - 10) {
        updateUI()
        lastRenderTime = now
    }
}

document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
        saveGameData()
    } else {
        updateUI()
        lastRenderTime = performance.now()
    }
})

window.addEventListener("pagehide", function() {
    saveGameData()
})

update()
lastTickTime = performance.now()
lastRenderTime = lastTickTime

setInterval(tick, 50)
setInterval(function() { saveGameData() }, 3000)
setInterval(setSkillWithLowestMaxXp, 1000)