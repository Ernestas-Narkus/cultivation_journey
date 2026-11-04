function validateHas(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key)
}

function validateEntityList() {
    var list = []
    var sets = [
        ["job", jobBaseData],
        ["skill", skillBaseData],
        ["item", itemBaseData]
    ]
    for (var i = 0; i < sets.length; i++) {
        for (var name in sets[i][1]) {
            if (validateHas(sets[i][1], name)) list.push({ name: name, kind: sets[i][0] })
        }
    }
    return list
}

function validateContent() {
    var errors = []
    var warnings = []
    var i, j, name, key

    try {
        // 1. Category members exist in base data
        var catSets = [
            ["jobCategories", jobCategories, "jobBaseData", jobBaseData],
            ["skillCategories", skillCategories, "skillBaseData", skillBaseData],
            ["itemCategories", itemCategories, "itemBaseData", itemBaseData]
        ]
        for (i = 0; i < catSets.length; i++) {
            var cats = catSets[i][1]
            var base = catSets[i][3]
            for (key in cats) {
                if (!validateHas(cats, key) || !Array.isArray(cats[key])) continue
                for (j = 0; j < cats[key].length; j++) {
                    if (!validateHas(base, cats[key][j])) {
                        errors.push(catSets[i][0] + "." + key + ": '" + cats[key][j] + "' is not in " + catSets[i][2])
                    }
                }
            }
        }

        // 2. Duplicate names across the three base-data objects
        var entities = validateEntityList()
        var seen = {}
        for (i = 0; i < entities.length; i++) {
            name = entities[i].name
            if (validateHas(seen, name)) {
                errors.push("Duplicate name '" + name + "' in " + seen[name] + " and " + entities[i].kind)
            } else {
                seen[name] = entities[i].kind
            }
        }

        // 3. Tooltips and 4. requirements entries
        for (i = 0; i < entities.length; i++) {
            name = entities[i].name
            if (!validateHas(tooltips, name) || typeof tooltips[name] !== "string" || tooltips[name] === "") {
                errors.push("Missing tooltip for " + entities[i].kind + " '" + name + "'")
            } else if (tooltips[name].indexOf("Placeholder") === 0) {
                warnings.push("Placeholder tooltip for " + entities[i].kind + " '" + name + "'")
            }
            if (!validateHas(requirements, name)) {
                errors.push("Missing requirements entry for " + entities[i].kind + " '" + name + "'")
            }
        }

        // 5. Task names inside TaskRequirements
        for (key in requirements) {
            if (!validateHas(requirements, key)) continue
            var req = requirements[key]
            if (!req || !Array.isArray(req.requirements)) continue
            for (j = 0; j < req.requirements.length; j++) {
                var item = req.requirements[j]
                if (!item || item.task === undefined) continue
                var taskName = (typeof item.task === "string") ? item.task : item.task && item.task.name
                if (!validateHas(jobBaseData, taskName) && !validateHas(skillBaseData, taskName)) {
                    errors.push("Requirement '" + key + "' names unknown task '" + taskName + "'")
                }
            }
        }

        // 6. headerRowColors for every category
        var allCats = [jobCategories, skillCategories, itemCategories]
        for (i = 0; i < allCats.length; i++) {
            for (key in allCats[i]) {
                if (validateHas(allCats[i], key) && !validateHas(headerRowColors, key)) {
                    errors.push("Missing headerRowColors entry for category '" + key + "'")
                }
            }
        }

        // 7. Required DOM ids
        var ids = ["ageDisplay", "dayDisplay", "coinDisplay", "netDisplay", "incomeDisplay", "expenseDisplay",
            "happinessDisplay", "evilDisplay", "timeWarpingDisplay", "importExportBox", "deathText",
            "quickTaskDisplay", "jobTable", "skillTable", "itemTable", "statusMessage"]
        for (i = 0; i < ids.length; i++) {
            if (!document.getElementById(ids[i])) errors.push("Missing DOM element id '" + ids[i] + "'")
        }
    } catch (e) {
        errors.push("validateContent crashed: " + (e && e.message ? e.message : e))
    }

    for (i = 0; i < warnings.length; i++) console.warn(warnings[i])
    for (i = 0; i < errors.length; i++) console.error(errors[i])
    if (errors.length > 0) {
        try { showFatalError(errors.join("\n")) } catch (e2) { console.error("showFatalError failed: " + e2) }
    }
    return errors
}

function validateDeepEqual(a, b) {
    if (a === b) return true
    if (typeof a === "number" && typeof b === "number" && a !== a && b !== b) return true
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false
    if (Array.isArray(a) !== Array.isArray(b)) return false
    var ka = Object.keys(a)
    var kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    for (var i = 0; i < ka.length; i++) {
        if (!validateHas(b, ka[i])) return false
        if (!validateDeepEqual(a[ka[i]], b[ka[i]])) return false
    }
    return true
}

function validateClone(obj) {
    return JSON.parse(JSON.stringify(obj))
}

function runSelfTests() {
    if (location.hash !== "#test") return
    var passed = 0
    var failed = 0

    function check(label, fn) {
        var ok = false
        var msg = ""
        try {
            ok = !!fn()
        } catch (e) {
            msg = " (" + (e && e.message ? e.message : e) + ")"
        }
        if (ok) {
            passed++
            console.log("PASS: " + label)
        } else {
            failed++
            console.log("FAIL: " + label + msg)
        }
    }

    function maxXpIncreases(name) {
        var task = gameData.taskData[name]
        var oldLevel = task.level
        var result
        try {
            task.level = 0
            var m0 = task.getMaxXp()
            task.level = 10
            var m10 = task.getMaxXp()
            result = m10 > m0
        } finally {
            task.level = oldLevel
        }
        return result
    }

    var firstJob = Object.keys(jobBaseData)[0]
    var firstSkill = Object.keys(skillBaseData)[0]

    check("getMaxXp increases with level (job " + firstJob + ")", function () { return maxXpIncreases(firstJob) })
    check("getMaxXp increases with level (skill " + firstSkill + ")", function () { return maxXpIncreases(firstSkill) })

    check("buildSaveObject -> validateSave ok", function () {
        return validateSave(validateClone(buildSaveObject())).ok === true
    })

    check("applySave(buildSaveObject()) leaves buildSaveObject() deep-equal", function () {
        var before = validateClone(buildSaveObject())
        applySave(validateClone(before))
        return validateDeepEqual(before, validateClone(buildSaveObject()))
    })

    check("validateSave rejects negative level", function () {
        var s = validateClone(buildSaveObject())
        s.tasks[firstJob].level = -1
        return validateSave(s).ok === false
    })

    check("validateSave rejects NaN coin value", function () {
        var s = validateClone(buildSaveObject())
        s.coins = NaN
        return validateSave(s).ok === false
    })

    check("skippedSkills round-trips correctly through save/load", function () {
        var snapshot = validateClone(buildSaveObject())
        try {
            setSkillSkipped(firstSkill, true)
            var saved = validateClone(buildSaveObject())
            setSkillSkipped(firstSkill, false)
            if (!validateSave(saved).ok) return false
            applySave(saved)
            return checkSkillSkipped({name: firstSkill}) === true
        } finally {
            applySave(validateClone(snapshot))
        }
    })

    check("validateSave rejects non-true skippedSkills values", function () {
        var s = validateClone(buildSaveObject())
        s.skippedSkills = {}
        s.skippedSkills[firstSkill] = "yes"
        return validateSave(s).ok === false
    })

    check("validateSave rejects unknown version", function () {
        var s = validateClone(buildSaveObject())
        s.v = 999999
        return validateSave(s).ok === false
    })

    check("rebirthReset sets levels to 0 and keeps permanentUnlocks completed", function () {
        var snapshot = validateClone(buildSaveObject())
        var ok = true
        try {
            var name
            for (name in gameData.taskData) {
                if (validateHas(gameData.taskData, name)) gameData.taskData[name].level = 5
            }
            for (var i = 0; i < permanentUnlocks.length; i++) {
                if (requirements[permanentUnlocks[i]]) requirements[permanentUnlocks[i]].completed = true
            }
            rebirthReset()
            for (name in gameData.taskData) {
                if (validateHas(gameData.taskData, name) && gameData.taskData[name].level !== 0) ok = false
            }
            for (var j = 0; j < permanentUnlocks.length; j++) {
                if (requirements[permanentUnlocks[j]] && requirements[permanentUnlocks[j]].completed !== true) ok = false
            }
        } finally {
            applySave(validateClone(snapshot))
        }
        return ok
    })

    console.log("Self tests finished: " + passed + " passed, " + failed + " failed")
}

if (location.hash === "#test") {
    if (document.readyState === "complete") {
        runSelfTests()
    } else {
        window.addEventListener("load", function () { runSelfTests() })
    }
}