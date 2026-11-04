var rowCache = {}
var headerCache = {}
var requiredCache = {}

function setText(el, value) {
    if (!el) return
    var text = String(value)
    if (el.textContent !== text) el.textContent = text
}

function updateText() {
    //Sidebar
    document.getElementById("ageDisplay").textContent = daysToYears(gameData.days)
    document.getElementById("dayDisplay").textContent = getDay()
    document.getElementById("lifespanDisplay").textContent = daysToYears(getLifespan())
    document.getElementById("pauseButton").textContent = gameData.paused ? "Play" : "Pause"

    formatCoins(gameData.coins, document.getElementById("coinDisplay"))
    setSignDisplay()
    formatCoins(getNet(), document.getElementById("netDisplay"), false)
    formatCoins(getIncome(), document.getElementById("incomeDisplay"), false)
    formatCoins(getExpense(), document.getElementById("expenseDisplay"), false)

    document.getElementById("happinessDisplay").textContent = getHappiness().toFixed(1)

    document.getElementById("evilDisplay").textContent = gameData.evil.toFixed(1)
    document.getElementById("evilGainDisplay").textContent = getEvilGain().toFixed(1)

    document.getElementById("timeWarpingDisplay").textContent = "x" + gameData.taskData["Time warping"].getEffect().toFixed(2)
    document.getElementById("timeWarpingButton").textContent = gameData.timeWarpingEnabled ? "Disable warp" : "Enable warp"

    byId("speedBoostDisplay").textContent = "x" + gameData.speedMultiplier
    document.querySelectorAll(".speed-btn").forEach(function(button) {
        var active = Number(button.dataset.speed) == gameData.speedMultiplier
        button.classList.toggle("on", active)
        button.setAttribute("aria-pressed", String(active))
    })
}

function setClass(el, cls, on) {
    if (!el) return
    var want = !!on
    if (el.classList.contains(cls) !== want) el.classList.toggle(cls, want)
}

function setDisplay(el, value) {
    if (!el) return
    if (el.style.display !== value) el.style.display = value
}

function setSignDisplay() {
    var signDisplay = document.getElementById("signDisplay")
    var netDisplay = document.getElementById("netDisplay")
    if (getIncome() > getExpense()) {
        signDisplay.textContent = "+"
        signDisplay.className = "c-income"
        netDisplay.className = "c-income"
    } else if (getExpense() > getIncome()) {
        signDisplay.textContent = "-"
        signDisplay.className = "c-expense"
        netDisplay.className = "c-expense"
    } else {
        signDisplay.textContent = ""
        signDisplay.className = "muted"
        netDisplay.className = ""
    }
}

function findFirst(parent, className) {
    return parent.getElementsByClassName(className)[0] || null
}

function buildRowCache(row) {
    return {
        row: row,
        level: findFirst(row, "level"),
        xpGain: findFirst(row, "xpGain"),
        xpLeft: findFirst(row, "xpLeft"),
        maxLevel: findFirst(row, "maxLevel"),
        fill: findFirst(row, "progressFill"),
        income: findFirst(row, "income"),
        effect: findFirst(row, "effect"),
        skip: findFirst(row, "skipSkill"),
        button: findFirst(row, "button"),
        active: findFirst(row, "active"),
        expense: findFirst(row, "expense"),
        lastWidth: ""
    }
}

function createRow(templates, name, categoryName, categoryType) {
    var row = templates.row.content.firstElementChild.cloneNode(true)
    row.getElementsByClassName("name")[0].textContent = name
    row.getElementsByClassName("tooltipText")[0].textContent = tooltips[name]
    row.id = "row " + name
    row.dataset.category = categoryName
    if (categoryType != itemCategories) {
        row.getElementsByClassName("progressBar")[0].onclick = function() {setTask(name)}

        var checkbox = row.getElementsByClassName("checkbox")[0]
        if (checkbox) {
            checkbox.onchange = function() {
                setSkillSkipped(name, this.checked)
            }
        }
    } else {
        row.getElementsByClassName("button")[0].onclick = categoryName == "Properties" ? function() {setProperty(name)} : function() {setMisc(name)}
    }

    return row
}

function createAllRows(categoryType, tableId) {
    var templates = {
        headerRow: document.getElementsByClassName(categoryType == itemCategories ? "headerRowItemTemplate" : "headerRowTaskTemplate")[0],
        row: document.getElementsByClassName(categoryType == itemCategories ? "rowItemTemplate" : "rowTaskTemplate")[0],
    }

    var table = document.getElementById(tableId)
    var categoryName, headerRow, category, requiredRow

    for (categoryName in categoryType) {
        headerRow = createHeaderRow(templates, categoryType, categoryName)
        table.appendChild(headerRow)
        headerCache[categoryName] = {
            row: headerRow,
            maxLevel: findFirst(headerRow, "maxLevel"),
            skipSkill: findFirst(headerRow, "skipSkill")
        }

        category = categoryType[categoryName]
        category.forEach(function(name) {
            var row = createRow(templates, name, categoryName, categoryType)
            table.appendChild(row)
            rowCache[name] = buildRowCache(row)
        })

        requiredRow = createRequiredRow(categoryName)
        table.append(requiredRow)
        requiredCache[requiredRow.id] = {
            row: requiredRow,
            coins: findFirst(requiredRow, "coins"),
            levels: findFirst(requiredRow, "levels"),
            evil: findFirst(requiredRow, "evil")
        }
    }
}

function updateTaskRows() {
    var autoLearn = autoLearnElement.checked
    var showMax = gameData.rebirthOneCount > 0
    var key, task, c, isJob, isSkill, width

    for (key in gameData.taskData) {
        task = gameData.taskData[key]
        c = rowCache[task.name]
        if (!c) continue

        isJob = task instanceof Job
        isSkill = task instanceof Skill

        setText(c.level, task.level)
        setText(c.xpGain, format(task.getXpGain()))
        setText(c.xpLeft, format(task.getXpLeft()))

        setText(c.maxLevel, task.maxLevel)
        setClass(c.maxLevel, "hidden", !showMax)

        width = task.xp / task.getMaxXp() * 100 + "%"
        if (width !== c.lastWidth) {
            c.fill.style.width = width
            c.lastWidth = width
        }
        setClass(c.fill, "current", task == gameData.currentJob || task == gameData.currentSkill)

        setDisplay(c.income, isJob ? "" : "none")
        setDisplay(c.effect, isSkill ? "" : "none")
        setDisplay(c.skip, isSkill && autoLearn ? "table-cell" : "none")

        if (isSkill) {
            var checkbox = c.skip.getElementsByClassName("checkbox")[0]
            if (checkbox) {
                var expected = checkSkillSkipped(task)
                if (checkbox.checked !== expected) checkbox.checked = expected
            }
        }

        if (isJob) {
            formatCoins(task.getIncome(), c.income)
        } else {
            setText(c.effect, task.getEffectDescription())
        }
    }
}

function updateItemRows() {
    var key, item, c, expense, disabled

    for (key in gameData.itemData) {
        item = gameData.itemData[key]
        c = rowCache[item.name]
        if (!c) continue

        expense = item.getExpense()
        disabled = gameData.coins < expense
        if (c.button.disabled !== disabled) c.button.disabled = disabled

        setClass(c.active, "on", gameData.currentMisc.includes(item) || item == gameData.currentProperty)
        setText(c.effect, item.getEffectDescription())
        formatCoins(expense, c.expense)
    }
}

function updateHeaderRows(categories) {
    var autoLearn = autoLearnElement.checked
    var showMax = gameData.rebirthOneCount > 0
    var categoryName, c

    for (categoryName in categories) {
        c = headerCache[categoryName]
        if (!c) continue
        setClass(c.maxLevel, "hidden", !showMax)
        setDisplay(c.skipSkill, categories == skillCategories && autoLearn ? "table-cell" : "none")
    }
}

function updateRequiredRows(data, categoryType) {
    var categoryName, cache, category, nextEntity, i, entityName, entityRequirement
    var nextIndex, nextEntityName, nextEntityRequirements, requirementObject, requirementList
    var finalText, requirement, task, text, showCoins, showLevels, showEvil

    for (categoryName in categoryType) {
        cache = requiredCache[categoryName]
        if (!cache) continue
        category = categoryType[categoryName]
        if (category == null) continue
        nextEntity = null

        for (i = 0; i < category.length; i++) {
            entityName = category[i]
            if (i >= category.length - 1) break
            entityRequirement = requirements[entityName]
            if (entityRequirement && i == 0) {
                if (!entityRequirement.isCompleted()) {
                    nextEntity = data[entityName]
                    break
                }
            }

            nextIndex = i + 1
            if (nextIndex >= category.length) {break}
            nextEntityName = category[nextIndex]
            nextEntityRequirements = requirements[nextEntityName]

            if (!nextEntityRequirements.isCompleted()) {
                nextEntity = data[nextEntityName]
                break
            }
        }

        if (nextEntity == null) {
            setClass(cache.row, "hiddenTask", true)
            continue
        }

        setClass(cache.row, "hiddenTask", false)
        requirementObject = requirements[nextEntity.name]
        requirementList = requirementObject.requirements
        showCoins = false
        showLevels = false
        showEvil = false

        if (data == gameData.taskData) {
            if (requirementObject instanceof EvilRequirement) {
                showEvil = true
                setText(cache.evil, format(requirementList[0].requirement) + " evil")
            } else {
                showLevels = true
                finalText = ""
                for (requirement of requirementList) {
                    task = gameData.taskData[requirement.task]
                    if (task.level >= requirement.requirement) continue
                    text = " " + requirement.task + (task instanceof Job ? " reputation " : " level ") + format(task.level) + "/" + format(requirement.requirement) + ","
                    finalText += text
                }
                finalText = finalText.substring(0, finalText.length - 1)
                setText(cache.levels, finalText)
            }
        } else if (data == gameData.itemData) {
            showCoins = true
            formatCoins(requirementList[0].requirement, cache.coins)
        }

        setClass(cache.coins, "hiddenTask", !showCoins)
        setClass(cache.levels, "hiddenTask", !showLevels)
        setClass(cache.evil, "hiddenTask", !showEvil)
    }
}

function hideEntities() {
    var key, requirement, completed, element
    for (key in requirements) {
        requirement = requirements[key]
        completed = requirement.isCompleted()
        for (element of requirement.elements) {
            setClass(element, "hidden", !completed)
        }
    }
}

function formatCoins(coins, element, tint = true) {
    var amount = Math.floor(coins)
    var span = element.children[0]
    var color = tint ? "var(--stone)" : ""
    setText(span, format(amount) + (amount == 1 ? " Spirit Stone" : " Spirit Stones"))
    if (span.style.color !== color) span.style.color = color
}



function createRankList(listId, ranks) {
    var list = byId(listId)
    ranks.forEach(function(name) {
        var item = document.createElement("li")
        item.className = "rank"
        item.textContent = name
        list.appendChild(item)
    })
}

function updateRankList(listId, displayId, ranks, rankIndex, emptyText) {
    byId(displayId).textContent = rankIndex >= 0 ? ranks[rankIndex] : emptyText
    var items = byId(listId).children
    for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle("reached", i < rankIndex)
        items[i].classList.toggle("current", i == rankIndex)
    }
}

// The one-line realm readouts in the player card on the left
function updateRealmLine(id, realms, index, emptyText) {
    var element = byId(id)
    var name = index >= 0 ? realms[index] : emptyText
    element.textContent = name
    element.title = name
}

function updateRanks() {
    updateRankList("martialRankList", "martialRankDisplay", martialArtsRanks, gameData.martialRank, "Untrained")
    updateRankList("cultivationRankList", "cultivationRankDisplay", cultivationRanks, gameData.cultivationRank, "Mortal")
    updateRealmLine("martialRealmDisplay", martialArtsRanks, gameData.martialRank, "Untrained")
    updateRealmLine("cultivationRealmDisplay", cultivationRanks, gameData.cultivationRank, "Mortal")
}

function setCategoryCollapsed(categoryName, collapsed) {
    gameData.collapsedCategories[categoryName] = collapsed
    var rows = document.querySelectorAll("[data-category]")
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].dataset.category == categoryName) rows[i].classList.toggle("collapsed", collapsed)
    }
    var headerRow = document.querySelector(".headerRow." + removeSpaces(categoryName))
    var button = headerRow.getElementsByClassName("collapse-btn")[0]
    button.textContent = collapsed ? "\u25B8" : "\u25BE"
    button.setAttribute("aria-expanded", String(!collapsed))
    button.setAttribute("aria-label", (collapsed ? "Expand " : "Collapse ") + categoryName)
}

function applyCollapsedCategories() {
    [jobCategories, skillCategories, itemCategories].forEach(function(categories) {
        for (var categoryName in categories) {
            setCategoryCollapsed(categoryName, !!gameData.collapsedCategories[categoryName])
        }
    })
}

function setTab(element, selectedTab) {

    var tabs = Array.prototype.slice.call(document.getElementsByClassName("tab"))
    tabs.forEach(function(tab) {
        tab.style.display = "none"
    })
    document.getElementById(selectedTab).style.display = "block"

    var tabButtons = document.getElementsByClassName("tabButton")
    for (tabButton of tabButtons) {
        tabButton.classList.remove("w3-blue-gray")
    }
    element.classList.add("w3-blue-gray")
}

function setStickySidebar(sticky) {
    gameData.settings.stickySidebar = sticky
    byId("settingsStickySidebar").checked = sticky
    byId("info").classList.toggle("sticky", sticky)
}

function setAutoPause(enabled) {
    gameData.settings.autoPause = enabled
    byId("settingsAutoPause").checked = enabled
}

function initUI() {
    setStickySidebar(gameData.settings.stickySidebar)
    setAutoPause(gameData.settings.autoPause)
}

// Cycles through the tabs that are currently visible (the Story tab stays hidden until it unlocks)
function changeTab(direction) {
    var tabButtons = Array.prototype.slice.call(document.getElementsByClassName("tabButton"))
    var visible = tabButtons.filter(function(button) { return button.offsetParent !== null })
    var current = visible.findIndex(function(button) { return button.classList.contains("w3-blue-gray") })
    visible[(current + direction + visible.length) % visible.length].click()
}

// Loadouts remember your job, skill, property and items, and are saved with the game
function saveLoadout(slot) {
    gameData.loadouts[slot] = {
        job: gameData.currentJob.name,
        skill: gameData.currentSkill.name,
        property: gameData.currentProperty.name,
        misc: gameData.currentMisc.map(function(item) { return item.name }),
    }
    showStatus("Loadout " + slot + " saved")
}

function loadLoadout(slot) {
    var loadout = gameData.loadouts[slot]
    if (!loadout) {
        showStatus("Loadout " + slot + " is empty. Press Alt+" + slot + " to save one")
        return
    }

    var skipped = []
    function usable(name, data) {
        if (name in data && isUnlocked(name)) return true
        skipped.push(name)
        return false
    }

    if (usable(loadout.job, gameData.taskData)) setTask(loadout.job)
    if (usable(loadout.skill, gameData.taskData)) setTask(loadout.skill)
    if (usable(loadout.property, gameData.itemData)) setProperty(loadout.property)
    gameData.currentMisc = []
    loadout.misc.forEach(function(name) {
        if (usable(name, gameData.itemData)) setMisc(name)
    })

    // Auto-promote and auto-learn would immediately override the loadout, so they are switched off
    var autoWasOn = autoPromoteElement.checked || autoLearnElement.checked
    autoPromoteElement.checked = false
    autoLearnElement.checked = false

    var message = "Loadout " + slot + " loaded"
    if (autoWasOn) message += " (auto-promote and auto-learn turned off)"
    if (skipped.length > 0) message += ". Not available yet: " + skipped.join(", ")
    showStatus(message)
}

// Keys that are meant for typing (the import box etc.) never trigger shortcuts
function isTypingTarget(target) {
    if (!target) return false
    if (target.isContentEditable) return true
    if (target.tagName == "TEXTAREA" || target.tagName == "SELECT") return true
    if (target.tagName == "INPUT") return !["checkbox", "radio", "button", "submit"].includes(target.type)
    return false
}

function loadoutSlot(event) {
    var match = /^(?:Digit|Numpad)([1-3])$/.exec(event.code)
    return match ? Number(match[1]) : 0
}

window.addEventListener("keydown", function(event) {
    if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey) return

    // event.code is used for the digits because Alt+1 types a different character on some keyboards
    var slot = loadoutSlot(event)
    if (slot && !event.shiftKey) {
        if (!event.repeat) event.altKey ? saveLoadout(slot) : loadLoadout(slot)
        event.preventDefault()
        return
    }
    if (event.altKey) return

    if (event.code == "Space") {
        if (!event.repeat) setPause()
        event.preventDefault() // no page scroll, and no second click on a focused button
    } else if (event.code == "ArrowRight" || event.code == "ArrowLeft") {
        if (!event.repeat) changeTab(event.code == "ArrowRight" ? 1 : -1)
        event.preventDefault()
    } else if (event.key.toLowerCase() == "l") {
        if (!event.repeat) autoLearnElement.checked = !autoLearnElement.checked
    } else if (event.key.toLowerCase() == "p") {
        if (!event.repeat) autoPromoteElement.checked = !autoPromoteElement.checked
    }
})

window.addEventListener("keyup", function(event) {
    if (event.code == "Space" && !isTypingTarget(event.target)) event.preventDefault()
})

var statusTimer = null
function showStatus(text) {
    var element = byId("statusMessage")
    element.textContent = text
    clearTimeout(statusTimer)
    statusTimer = setTimeout(function() { element.textContent = "" }, 4000)
}

function createRequiredRow(categoryName) {
    var requiredRow = document.getElementsByClassName("requiredRowTemplate")[0].content.firstElementChild.cloneNode(true)
    requiredRow.classList.add("requiredRow")
    requiredRow.classList.add(removeSpaces(categoryName))
    requiredRow.id = categoryName
    requiredRow.dataset.category = categoryName
    return requiredRow
}

function createHeaderRow(templates, categoryType, categoryName) {
    var headerRow = templates.headerRow.content.firstElementChild.cloneNode(true)
    headerRow.getElementsByClassName("category")[0].textContent = categoryName
    if (categoryType == jobCategories) headerRow.getElementsByClassName("levelHeader")[0].textContent = "Reputation"
    if (categoryType != itemCategories) {
        headerRow.getElementsByClassName("valueType")[0].textContent = categoryType == jobCategories ? "Income/day" : "Effect"
    }

    headerRow.style.backgroundColor = headerRowColors[categoryName]
    headerRow.classList.add(removeSpaces(categoryName))
    headerRow.classList.add("headerRow")
    headerRow.getElementsByClassName("collapse-btn")[0].onclick = function() {
        setCategoryCollapsed(categoryName, !gameData.collapsedCategories[categoryName])
    }
    
    return headerRow
}

function updateQuickTaskDisplay(taskType) {
    var currentTask = taskType == "job" ? gameData.currentJob : gameData.currentSkill
    var quickTaskDisplayElement = document.getElementById("quickTaskDisplay")
    var progressBar = quickTaskDisplayElement.getElementsByClassName(taskType)[0]
    progressBar.getElementsByClassName("name")[0].textContent = currentTask.name + (taskType == "job" ? " rep " : " lvl ") + currentTask.level
    progressBar.getElementsByClassName("progressFill")[0].style.width = currentTask.xp / currentTask.getMaxXp() * 100 + "%"
}


function format(number, decimals = 1) {

    // what tier? (determines SI symbol)
    var tier = Math.log10(number) / 3 | 0;

    // if zero, we don't need a suffix
    if(tier == 0) return number;

    // past the end of the suffix table, fall back to scientific notation
    if (tier >= units.length) return number.toExponential(2);

    // get suffix and determine scale
    var suffix = units[tier];
    var scale = Math.pow(10, tier * 3);

    // scale the number
    var scaled = number / scale;

    // format number and add suffix
    return scaled.toFixed(decimals) + suffix;
}

function getTaskElement(taskName) {
    var task = gameData.taskData[taskName]
    var element = document.getElementById(task.id)
    return element
}

function getItemElement(itemName) {
    var item = gameData.itemData[itemName]
    var element = document.getElementById(item.id)
    return element
}

function getElementsByClass(className) {
    var elements = document.getElementsByClassName(removeSpaces(className))
    return elements
}

function setLightDarkMode() {
    var body = document.getElementById("body")
    body.classList.contains("dark") ? body.classList.remove("dark") : body.classList.add("dark")
}

function updateUI() {
    updateTaskRows()
    updateItemRows()
    updateRequiredRows(gameData.taskData, jobCategories)
    updateRequiredRows(gameData.taskData, skillCategories)
    updateRequiredRows(gameData.itemData, itemCategories)
    updateHeaderRows(jobCategories)
    updateHeaderRows(skillCategories)
    updateQuickTaskDisplay("job")
    updateQuickTaskDisplay("skill")
    hideEntities()
    var deathText = document.getElementById("deathText")
    deathText.classList.toggle("hidden", isAlive())
    updateText()  
    updateRanks()
}
