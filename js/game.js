"use strict"

// Missing-requirement names already warned about (one console.warn per name)
var warnedMissingRequirements = Object.create(null)

function isRequirementCompleted(name) {
    var requirement = requirements[name]
    if (!requirement) {
        if (!warnedMissingRequirements[name]) {
            warnedMissingRequirements[name] = true
            console.warn("Missing requirement for '" + name + "'; treating as locked")
        }
        return false
    }
    return requirement.isCompleted()
}

function setMartialRank(index) {
    gameData.martialRank = Math.max(-1, Math.min(index, martialArtsRanks.length - 1))
}

function setCultivationRank(index) {
    gameData.cultivationRank = Math.max(-1, Math.min(index, cultivationRanks.length - 1))
}

function getBaseLog(x, y) {
    return Math.log(y) / Math.log(x);
}
  
function getBindedTaskEffect(taskName) {
    var task = gameData.taskData[taskName]
    return task.getEffect.bind(task)
}

function getBindedItemEffect(itemName) {
    var item = gameData.itemData[itemName]
    return item.getEffect.bind(item)
}

function addMultipliers() {
    for (var taskName in gameData.taskData) {
        var task = gameData.taskData[taskName]

        task.xpMultipliers = []
        if (task instanceof Job) task.incomeMultipliers = []

        task.xpMultipliers.push(task.getMaxLevelMultiplier.bind(task))
        task.xpMultipliers.push(getHappiness)
        task.xpMultipliers.push(getBindedTaskEffect("Dark influence"))
        task.xpMultipliers.push(getBindedTaskEffect("Demon training"))

        if (task instanceof Job) {
            task.incomeMultipliers.push(task.getLevelMultiplier.bind(task))
            task.incomeMultipliers.push(getBindedTaskEffect("Demon's wealth"))
            task.xpMultipliers.push(getBindedTaskEffect("Productivity"))
            task.xpMultipliers.push(getBindedTaskEffect("Strategy"))
            task.xpMultipliers.push(getBindedItemEffect("Personal squire"))    
        } else if (task instanceof Skill) {
            task.xpMultipliers.push(getBindedTaskEffect("Concentration"))
            task.xpMultipliers.push(getBindedItemEffect("Book"))
            task.xpMultipliers.push(getBindedItemEffect("Study desk"))
            task.xpMultipliers.push(getBindedItemEffect("Library"))
        }

        if (jobCategories["Martial Arts Hall"].includes(task.name)) {
            task.incomeMultipliers.push(getBindedTaskEffect("Conditioning"))
            task.xpMultipliers.push(getBindedItemEffect("Steel longsword"))
        } else if (task.name == "Conditioning") {
            task.xpMultipliers.push(getBindedTaskEffect("Muscle Memory"))
            task.xpMultipliers.push(getBindedItemEffect("Dumbbells"))
        } else if (skillCategories["Qi"].includes(task.name)) {
            task.xpMultipliers.push(getBindedItemEffect("Sapphire charm"))
        } else if (jobCategories["Sect"].includes(task.name)) {
            task.xpMultipliers.push(getBindedTaskEffect("Qi Control"))
        } else if (skillCategories["Dark magic"].includes(task.name)) {
            task.xpMultipliers.push(getEvil)
        }
    }

    for (var itemName in gameData.itemData) {
        var item = gameData.itemData[itemName]
        item.expenseMultipliers = []
        item.expenseMultipliers.push(getBindedTaskEffect("Bargaining"))
        item.expenseMultipliers.push(getBindedTaskEffect("Intimidation"))
    }
}

// Shared by Bargaining and Intimidation
function getCostReductionMultiplier(task) {
    var multiplier = 1 - getBaseLog(7, task.level + 1) / 10
    if (multiplier < 0.1) {multiplier = 0.1}
    return multiplier
}

function setCustomEffects() {
    var bargaining = gameData.taskData["Bargaining"]
    bargaining.getEffect = function() {
        return getCostReductionMultiplier(bargaining)
    }

    var intimidation = gameData.taskData["Intimidation"]
    intimidation.getEffect = function() {
        return getCostReductionMultiplier(intimidation)
    }

    var timeWarping = gameData.taskData["Time warping"]
    timeWarping.getEffect = function() {
        var multiplier = 1 + getBaseLog(13, timeWarping.level + 1) 
        return multiplier
    }
}

function getHappiness() {
    var meditationEffect = getBindedTaskEffect("Meditation")
    var butlerEffect = getBindedItemEffect("Butler")
    var happiness = meditationEffect() * butlerEffect() * gameData.currentProperty.getEffect()
    return happiness
}

function getEvil() {
    return gameData.evil
}

// TODO(design): rounding of the final value here is intentionally unchanged
function applyMultipliers(value, multipliers) {
    var finalMultiplier = 1
    multipliers.forEach(function(multiplierFunction) {
        var multiplier = multiplierFunction()
        finalMultiplier *= multiplier
    })
    var finalValue = Math.round(value * finalMultiplier)
    return finalValue
}

function applySpeed(value) {
    var finalValue = value * getGameSpeed() / updateSpeed
    return finalValue
}

function getEvilGain() {
    var evilControl = gameData.taskData["Evil control"]
    var bloodMeditation = gameData.taskData["Blood meditation"]
    var evil = evilControl.getEffect() * bloodMeditation.getEffect()
    return evil
}

function getGameSpeed() {
    var timeWarping = gameData.taskData["Time warping"]
    var timeWarpingSpeed = gameData.timeWarpingEnabled ? timeWarping.getEffect() : 1
    var gameSpeed = baseGameSpeed * +!gameData.paused * +isAlive() * timeWarpingSpeed * gameData.speedMultiplier
    return gameSpeed
}

function applyExpenses() {
    var coins = applySpeed(getExpense())
    gameData.coins -= coins
    if (gameData.coins < 0) {    
        goBankrupt()
    }
}

function getExpense() {
    var expense = 0
    expense += gameData.currentProperty.getExpense()
    for (var misc of gameData.currentMisc) {
        expense += misc.getExpense()
    }
    return expense
}

function goBankrupt() {
    gameData.coins = 0
    gameData.currentProperty = gameData.itemData["Homeless"]
    gameData.currentMisc = []
}

function setPause() {
    gameData.paused = !gameData.paused
}

// Clicking the active speed button again returns to x1
function setSpeedMultiplier(multiplier) {
    gameData.speedMultiplier = gameData.speedMultiplier == multiplier ? 1 : multiplier
}

function isUnlocked(name) {
    var requirement = requirements[name]
    return !requirement || requirement.isCompleted()
}

function setTimeWarping() {
    gameData.timeWarpingEnabled = !gameData.timeWarpingEnabled
}

function setTask(taskName) {
    var task = gameData.taskData[taskName]
    task instanceof Job ? gameData.currentJob = task : gameData.currentSkill = task
}

function setProperty(propertyName) {
    var property = gameData.itemData[propertyName]
    gameData.currentProperty = property
}

function setMisc(miscName) {
    var misc = gameData.itemData[miscName]
    if (gameData.currentMisc.includes(misc)) {
        for (var i = 0; i < gameData.currentMisc.length; i++) {
            if (gameData.currentMisc[i] == misc) {
                gameData.currentMisc.splice(i, 1)
            }
        }
    } else {
        gameData.currentMisc.push(misc)
    }
}

function createData(data, baseData) {
    for (var key in baseData) {
        var entity = baseData[key]
        createEntity(data, entity)
    }
}

function createEntity(data, entity) {
    if ("income" in entity) {data[entity.name] = new Job(entity)}
    else if ("maxXp" in entity) {data[entity.name] = new Skill(entity)}
    else {data[entity.name] = new Item(entity)}
    data[entity.name].id = "row " + entity.name
}

function doCurrentTask(task) {
    task.increaseXp()
    if (task instanceof Job) {
        increaseCoins()
    }
}

function getIncome() {
    var income = 0
    income += gameData.currentJob.getIncome()
    return income
}

function increaseCoins() {
    var coins = applySpeed(getIncome())
    gameData.coins += coins
}

function daysToYears(days) {
    var years = Math.floor(days / 365)
    return years
}

function yearsToDays(years) {
    var days = years * 365
    return days
}
 
function getDay() {
    var day = Math.floor(gameData.days - daysToYears(gameData.days) * 365)
    return day
}

function increaseDays() {
    var increase = applySpeed(1)
    if (gameData.settings.autoPause && gameData.days < autoPauseDays && gameData.days + increase >= autoPauseDays) {
        gameData.paused = true
        showStatus("Auto-paused at age 1000")
    }
    gameData.days += increase
}

function getNet() {
    var net = Math.abs(getIncome() - getExpense())
    return net
}

function getCategoryFromEntityName(categoryType, entityName) {
    for (var categoryName in categoryType) {
        var category = categoryType[categoryName]
        if (category.includes(entityName)) {
            return category
        }
    }
}

function getNextEntity(data, categoryType, entityName) {
    var category = getCategoryFromEntityName(categoryType, entityName)
    if (!category) return null
    var nextIndex = category.indexOf(entityName) + 1
    if (nextIndex > category.length - 1) return null
    var nextEntityName = category[nextIndex]
    var nextEntity = data[nextEntityName]
    return nextEntity || null
}

function autoPromote() {
    if (!autoPromoteElement.checked) return
    var nextEntity = getNextEntity(gameData.taskData, jobCategories, gameData.currentJob.name)
    if (nextEntity == null) return
    if (isRequirementCompleted(nextEntity.name)) gameData.currentJob = nextEntity
}

function checkSkillSkipped(skill) {
    return gameData.skippedSkills[skill.name] === true
}

function setSkillSkipped(name, skipped) {
    if (skipped) {
        gameData.skippedSkills[name] = true
    } else {
        delete gameData.skippedSkills[name]
    }
}

function setSkillWithLowestMaxXp() {
    var best = null
    var bestTime = Infinity

    for (var skillName in gameData.taskData) {
        var skill = gameData.taskData[skillName]
        if (!(skill instanceof Skill) || !isRequirementCompleted(skillName) || checkSkillSkipped(skill)) continue

        var time = skill.getMaxXp() / skill.getXpGain()
        if (time < bestTime) {
            best = skill
            bestTime = time
        }
    }

    skillWithLowestMaxXp = best || gameData.taskData["Concentration"]
}

function autoLearn() {
    if (!autoLearnElement.checked || !skillWithLowestMaxXp) return
    gameData.currentSkill = skillWithLowestMaxXp
}

function removeSpaces(string) {
    var string = string.replace(/ /g, "")
    return string
}

function rebirthOne() {
    gameData.rebirthOneCount += 1

    rebirthReset()
    saveGameData()
}

function rebirthTwo() {
    gameData.rebirthTwoCount += 1
    gameData.evil += getEvilGain()

    rebirthReset()

    for (var taskName in gameData.taskData) {
        var task = gameData.taskData[taskName]
        task.maxLevel = 0
    }    
    saveGameData()
}

// TODO(design): rank reset policy (martialRank/cultivationRank) is intentionally unchanged
function rebirthReset() {
    setTab(jobTabButton, "jobs")

    gameData.coins = 0
    gameData.days = 365 * 14
    gameData.currentJob = gameData.taskData["Beggar"]
    gameData.currentSkill = gameData.taskData["Concentration"]
    gameData.currentProperty = gameData.itemData["Homeless"]
    gameData.currentMisc = []
    gameData.martialRank = -1
    gameData.cultivationRank = -1

    for (var taskName in gameData.taskData) {
        var task = gameData.taskData[taskName]
        if (task.level > task.maxLevel) task.maxLevel = task.level
        task.level = 0
        task.xp = 0
    }

    for (var key in requirements) {
        var requirement = requirements[key]
        if (requirement.completed && permanentUnlocks.includes(key)) continue
        requirement.completed = false
    }
}

function getLifespan() {
    // Lifespan will come purely from cultivation realms (not implemented yet), so for now it is the base value
    return baseLifespan
}

function isAlive() {
    return gameData.days < getLifespan()
}

function enforceLifespan() {
    if (!isAlive()) {
        gameData.days = getLifespan()
    }
}

function simulateStep() {
    enforceLifespan()
    increaseDays()
    autoPromote()
    autoLearn()
    doCurrentTask(gameData.currentJob)
    doCurrentTask(gameData.currentSkill)
    applyExpenses()
}

function update() {
    simulateStep()
    updateUI()
}