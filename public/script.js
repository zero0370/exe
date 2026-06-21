(function () {
    function script(contentWindow) {
        if (contentWindow._script) return
        contentWindow._script = true

        // 各功能独立检测、独立注入
        applyDefaultAudioAndFps(contentWindow)
        fixChooseImage(contentWindow)
        waitForPlatformManager(contentWindow)
        startBattleFlyTextOptimizer(contentWindow)

        waitForModule(contentWindow, 'HeroAttributeToolTip', (m) => {
            if (m && (m.HeroAttributeToolTip || m.SeasonHeroAttributeToolTip)) {
                hookHeroAttributeToolTip(contentWindow, m)
            }
        })

        waitForModule(contentWindow, 'HeroModule', (m) => {
            if (m && m.HeroModule) {
                hookHeroRedPoint(contentWindow, m.HeroModule)
            }
        })

        waitForModule(contentWindow, 'HeroListPanel', (m) => {
            if (m && m.HeroListPanel) {
                hookHeroListPanelRedPoint(contentWindow, m.HeroListPanel)
            }
        })

        waitForModule(contentWindow, 'HeroAllPanel', (m) => {
            if (m && m.HeroAllPanel) {
                hookHeroAllPanelRedPoint(contentWindow, m.HeroAllPanel)
            }
        })

        waitForModule(contentWindow, 'QuenchStageUpDialog', (m) => {
            if (m && m.QuenchStageUpDialog) {
                hookQuenchStageUpDialog(contentWindow, m.QuenchStageUpDialog)
            }
        })

        waitForModule(contentWindow, 'BottleRobotDialog', (m) => {
            if (m && m.BottleRobotDialog) {
                hookBottleRobotDialog(contentWindow, m.BottleRobotDialog)
            }
        })

        waitForModule(contentWindow, 'PlayerInfoDialog', (m) => {
            if (m && m.PlayerInfoDialog) {
                hookPlayerInfoDialog(contentWindow, m.PlayerInfoDialog)
            }
        })

        waitForModule(contentWindow, 'ArenaRecordDialog', (m) => {
            if (m && m.ArenaRecordDialog) {
                hookArenaRecordDialog(contentWindow, m.ArenaRecordDialog)
            }
        })

        waitForModule(contentWindow, 'FriendSearchDialog', (m) => {
            if (m && m.FriendSearchDialog) {
                hookFriendSearchDialog(contentWindow, m.FriendSearchDialog)
            }
        })

        waitForModule(contentWindow, 'BoxPanel', (m) => {
            if (m && m.BoxPanel) {
                hookBoxPanel(contentWindow, m.BoxPanel)
            }
        })

        waitForModule(contentWindow, 'LegacyMailDetailDialog', (m) => {
            if (m && m.LegacyMailDetailDialog) {
                hookLegacyMailDetailDialog(contentWindow, m.LegacyMailDetailDialog)
            }
        })

        waitForModule(contentWindow, 'FirstFaceToPlayerManager', (m) => {
            if (m && m.FirstFaceToPlayerManager) {
                hideFirstLoginDialogs(m.FirstFaceToPlayerManager)
            }
        })

    }

    // 等待模块加载
    function waitForModule(contentWindow, moduleName, callback) {
        const interval = setInterval(() => {
            try {
                const m = contentWindow.__require(moduleName)
                if (m && Object.keys(m).length > 0) {
                    clearInterval(interval)
                    callback(m)
                }
            } catch (e) { }
        }, 500)
        setTimeout(() => clearInterval(interval), 60000)
    }

    // 默认关闭声音和音效，并按窗口状态控制帧率
    function applyDefaultAudioAndFps(contentWindow) {
        const focusedFrameRate = 60
        const backgroundFrameRate = 30
        const startupFrameRate = 30
        const startupLowPowerMs = 10000
        let isStartupLowPower = true
        let currentFrameRate = startupFrameRate

        const applyFrameRate = (frameRate) => {
            currentFrameRate = frameRate
            writeDefaultAudioAndFpsStorage(contentWindow, focusedFrameRate)
            patchCocosFrameRate(contentWindow, frameRate)
        }

        const getTargetFrameRate = () => {
            if (isStartupLowPower) return startupFrameRate
            return contentWindow.document && contentWindow.document.hidden ? backgroundFrameRate : focusedFrameRate
        }

        const applyCurrentFrameRate = () => applyFrameRate(getTargetFrameRate())

        applyCurrentFrameRate()

        contentWindow.addEventListener('focus', applyCurrentFrameRate)
        contentWindow.addEventListener('blur', applyCurrentFrameRate)
        contentWindow.document?.addEventListener('visibilitychange', applyCurrentFrameRate)

        setTimeout(() => {
            isStartupLowPower = false
            applyCurrentFrameRate()
            console.log('[卡卡] 加载期30帧结束，前台60帧/后台30帧已恢复')
        }, startupLowPowerMs)

        waitForModule(contentWindow, 'SoundManager', (m) => {
            const soundManager = m?.SoundManager?.instance
            if (!soundManager) return

            if (typeof soundManager.setMusicVolume === 'function') {
                soundManager.setMusicVolume(0)
            }
            if (typeof soundManager.setEffectVolume === 'function') {
                soundManager.setEffectVolume(0)
            }
        })

        waitForModule(contentWindow, 'HighFpsStartTask', (m) => {
            const highFpsTask = m?.HighFPSStartTask
            if (!highFpsTask) return

            highFpsTask.HIGH_FPS = focusedFrameRate
            if (typeof highFpsTask.updateFps === 'function') {
                highFpsTask.updateFps(currentFrameRate)
            }
            patchCocosFrameRate(contentWindow, currentFrameRate)
        })

        const interval = setInterval(() => {
            applyCurrentFrameRate()
        }, 1000)
        setTimeout(() => clearInterval(interval), 60000)

        console.log('[卡卡] 默认关闭声音和音效，加载期30帧/稳定后前台60帧已启用')
    }

    function writeDefaultAudioAndFpsStorage(contentWindow, targetFrameRate) {
        try {
            const storage = contentWindow.localStorage
            if (!storage) return

            storage.setItem('MUSIC_OPEN', 'false')
            storage.setItem('SOUND_OPEN', 'false')
            storage.setItem('ClientFPS', String(targetFrameRate))
        } catch (e) { }
    }

    function patchCocosFrameRate(contentWindow, targetFrameRate) {
        const game = contentWindow.cc?.game
        if (!game) return

        if (!game._kakaFrameRatePatched && typeof game.setFrameRate === 'function') {
            const originalSetFrameRate = game.setFrameRate
            game.setFrameRate = function (frameRate) {
                return originalSetFrameRate.call(this, frameRate)
            }
            game._kakaFrameRatePatched = true
        }

        try {
            game.setFrameRate(targetFrameRate)
        } catch (e) {
            if (game.config) {
                game.config.frameRate = targetFrameRate
            }
        }
    }

    // 等待平台管理器加载
    function waitForPlatformManager(contentWindow) {
        let logged = false

        const patchPlatformManager = function () {
            try {
                const pm = contentWindow.__require('PlatformManager').PlatformManager.instance
                if (!pm) return

                pm.getClientVersion = function () {
                    return Promise.resolve({ version: contentWindow.CODE_VERSION })
                }

                pm.setClipboardData = function (request) {
                    const textarea = document.createElement('textarea')
                    textarea.value = request.data
                    document.body.appendChild(textarea)
                    textarea.select()
                    document.execCommand('copy')
                    document.body.removeChild(textarea)
                    contentWindow.__require('TipsManager').SHOW_TIP('复制成功')
                }

                if (!logged) {
                    logged = true
                    console.log('[卡卡] 复制功能已修复')
                    console.log('[卡卡] 客户端版本接口已修复')
                }
            } catch (e) { }
        }

        patchPlatformManager()
        const interval = setInterval(patchPlatformManager, 300)
        setTimeout(() => clearInterval(interval), 60000)
    }

    // 复制文本到剪贴板
    function copyText(text) {
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
    }

    // 修复头像选择
    function fixChooseImage(contentWindow) {
        contentWindow.__HORTOR_SDK__.chooseImage = function (callback, options) {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = (e) => {
                const file = e.target.files[0]
                if (!file) return
                const img = new Image()
                img.onload = () => {
                    // 创建小图 98x98
                    const smallCanvas = document.createElement('canvas')
                    smallCanvas.width = 98
                    smallCanvas.height = 98
                    const smallCtx = smallCanvas.getContext('2d')
                    smallCtx.drawImage(img, 0, 0, 98, 98)
                    const smallBase64 = smallCanvas.toDataURL('image/jpeg', 1).split(',')[1]
                    // 创建大图 512x512
                    const largeCanvas = document.createElement('canvas')
                    largeCanvas.width = 512
                    largeCanvas.height = 512
                    const largeCtx = largeCanvas.getContext('2d')
                    largeCtx.drawImage(img, 0, 0, 512, 512)
                    const largeBase64 = largeCanvas.toDataURL('image/jpeg', 1).split(',')[1]
                    callback({ base64s: [largeBase64, smallBase64], images: [], imagePath: '' })
                }
                img.src = URL.createObjectURL(file)
            }
            input.click()
        }

        console.log('[卡卡] 头像选择已修复')
    }

    // 英雄属性面板增强 - 完整显示配置和英雄身上的全部属性
    function hookHeroAttributeToolTip(contentWindow, HeroTipModule) {
        const tipClasses = [
            HeroTipModule?.HeroAttributeToolTip,
            HeroTipModule?.SeasonHeroAttributeToolTip
        ].filter(Boolean)

        tipClasses.forEach((TipClass) => {
            patchHeroAttributeTipClass(contentWindow, TipClass)
        })

        console.log('[卡卡] 英雄属性面板增强已启用')
    }

    function patchHeroAttributeTipClass(contentWindow, TipClass) {
        if (!TipClass?.prototype || TipClass.prototype._kakaAttrEnhanced) return
        if (typeof TipClass.prototype.onShow !== 'function') return

        const originalOnShow = TipClass.prototype.onShow
        TipClass.prototype._kakaAttrEnhanced = true

        TipClass.prototype.onShow = function () {
            let result
            let originalSucceeded = false
            let originalError = null

            try {
                result = originalOnShow.apply(this, arguments)
                originalSucceeded = true
            } catch (e) {
                originalError = e
            }

            try {
                renderFullHeroAttributes(contentWindow, this, !originalSucceeded)
            } catch (e) {
                if (originalError) throw originalError
            }

            return result
        }
    }

    function renderFullHeroAttributes(contentWindow, dialog, bindClose) {
        const ui = dialog.ui
        const model = dialog.model
        const role = dialog.role
        const heroIdKey = dialog.constructor.OP_HERO_ID
        const heroId = model && typeof model.get === 'function' ? model.get(heroIdKey, 0) : 0
        const hero = role && typeof role.getHeroById === 'function' ? role.getHeroById(heroId) : null

        if (!ui || !hero) {
            throw new Error('hero attribute data is not ready')
        }
        if (!ui.m_attr || !ui.m_advanceAttr) {
            throw new Error('hero attribute list is not ready')
        }

        const Configs = contentWindow.__require('Configs')
        const LanguageExtModule = contentWindow.__require('LanguageExt')
        const languageExt = LanguageExtModule.LanguageExt || LanguageExtModule
        const basicAttrs = Configs.ConstantConf.config.basicBattleAttribute || []
        const specialAttrs = Configs.ConstantConf.config.specialBattleAttribute || []
        const basicAttrKeys = [5, 7, 6, 8]
        const extraAttrKeys = [65, 66, 67, 68, 69, 70, 79, 80, 226, 227, 228, 229, 230, 231]
        const allAttrKeys = new Set([...basicAttrs, ...specialAttrs, ...extraAttrKeys])

        if (hero.attribute && typeof hero.attribute.forEach === 'function') {
            hero.attribute.forEach((value, key) => {
                allAttrKeys.add(key)
            })
        }

        const specialAttrKeys = Array.from(allAttrKeys).filter((key) => !basicAttrKeys.includes(key))

        ui.m_attr.numItems = basicAttrKeys.length
        ui.m_advanceAttr.numItems = specialAttrKeys.length

        basicAttrKeys.forEach((key, index) => {
            const item = ui.m_attr.getChildAt(index)
            if (!item) return

            setAttributeItem(item, getAttributeName(languageExt, key), getBasicAttributeValue(hero, key), 'base')
        })

        specialAttrKeys.forEach((key, index) => {
            const item = ui.m_advanceAttr.getChildAt(index)
            if (!item) return

            setAttributeItem(item, getAttributeName(languageExt, key), formatSpecialAttributeValue(hero, key), 'advance')
        })

        resizeAttributePanel(ui)

        if (bindClose && typeof ui.onceClick === 'function') {
            ui.onceClick(dialog.close, dialog)
        }
    }

    function getBasicAttributeValue(hero, key) {
        switch (key) {
            case 5:
                return hero.calculateAttack
            case 6:
                return hero.calculateDefense
            case 7:
                return hero.calculateHp
            case 8:
                return hero.calculateSpeed
            default:
                return ''
        }
    }

    function getAttributeName(languageExt, key) {
        if (key === 303) return '定心'
        if (languageExt && typeof languageExt.getAttributeName === 'function') {
            return languageExt.getAttributeName(key)
        }
        return `属性${key}`
    }

    function formatSpecialAttributeValue(hero, key) {
        let rawValue = hero.attribute && typeof hero.attribute.get === 'function' ? hero.attribute.get(key) : 0
        if (rawValue === undefined || rawValue === null) rawValue = 0

        if (key === 9) {
            return String(Math.round(rawValue))
        }

        return `${((Math.round(10000 * rawValue)) / 100).toFixed(1)}%`
    }

    function setAttributeItem(item, name, value, pageName) {
        if (!item.m_attrName || !item.m_value) return

        item.m_attrName.text = String(name)
        item.m_value.text = String(value)

        if (item.m_state) {
            item.m_state.selectedPage = pageName
        }
    }

    function resizeAttributePanel(ui) {
        const advanceList = ui.m_advanceAttr
        if (advanceList._kakaAttrBaseHeight === undefined) {
            advanceList._kakaAttrBaseHeight = advanceList.height
        }
        if (ui._kakaAttrBaseHeight === undefined) {
            ui._kakaAttrBaseHeight = ui.height
        }

        setDisplayObjectHeight(advanceList, advanceList._kakaAttrBaseHeight)

        if (typeof ui.m_advanceAttr.ensureBoundsCorrect === 'function') {
            ui.m_advanceAttr.ensureBoundsCorrect()
        }

        if (typeof ui.m_advanceAttr.resizeToFit === 'function') {
            ui.m_advanceAttr.resizeToFit()
        } else if (ui.m_advanceAttr.scrollPane) {
            const contentHeight = ui.m_advanceAttr.scrollPane.contentHeight
            if (contentHeight > ui.m_advanceAttr.viewHeight) {
                ui.m_advanceAttr.viewHeight = contentHeight
            }
        }

        const knownChildren = new Set([
            ui.m_txtLab1,
            ui.m_txtLab2,
            ui.m_tabs,
            ui.m_attr,
            ui.m_advanceAttr,
            ui.m_block
        ].filter(Boolean))

        let bgChild = null
        let bgMaxHeight = 0
        for (let i = 0; i < ui.numChildren; i++) {
            const child = ui.getChildAt(i)
            if (!knownChildren.has(child) && child.height > bgMaxHeight) {
                bgMaxHeight = child.height
                bgChild = child
            }
        }

        if (bgChild && bgChild._kakaAttrBaseHeight === undefined) {
            bgChild._kakaAttrBaseHeight = bgChild.height
        }

        const heightDiff = advanceList.height - advanceList._kakaAttrBaseHeight
        setDisplayObjectHeight(ui, ui._kakaAttrBaseHeight + Math.max(heightDiff, 0))

        if (bgChild) {
            setDisplayObjectHeight(bgChild, bgChild._kakaAttrBaseHeight + Math.max(heightDiff, 0))
        }
    }

    function setDisplayObjectHeight(target, height) {
        if (!target) return

        const width = target.width !== undefined ? target.width : target._width
        if (typeof target.setSize === 'function' && width !== undefined) {
            target.setSize(width, height)
        } else {
            target.height = height
        }
    }

    // 四圣皮肤和技能觉醒红点隐藏 - 只保留升星红点
    function hookHeroRedPoint(contentWindow, HeroModuleClass) {
        const proto = HeroModuleClass?.prototype
        if (!proto || proto._kakaRedPointPatched) return

        if (typeof proto.judgeHolyBeastSkinRed === 'function') {
            proto.judgeHolyBeastSkinRed = function () {
                return false
            }
        }

        if (typeof proto.judgeAllSkillCanAwake === 'function') {
            proto.judgeAllSkillCanAwake = function () {
                return false
            }
        }

        if (typeof proto.judgeTrainHero === 'function') {
            proto.judgeTrainHero = function (hero) {
                return typeof this.judgeUpgradeStar === 'function' ? this.judgeUpgradeStar(hero) : false
            }
        }

        proto._kakaRedPointPatched = true
        console.log('[卡卡] 四圣皮肤和技能觉醒红点隐藏已启用')
    }

    function hookHeroListPanelRedPoint(contentWindow, HeroListPanelClass) {
        const proto = HeroListPanelClass?.prototype
        if (!proto || proto._kakaRedPointPatched || typeof proto._refreshHeroTrainItem !== 'function') return

        proto._refreshHeroTrainItem = function (item, hero) {
            if (!item || !hero || hero.createByClient) return

            const Configs = contentWindow.__require('Configs')
            const HeroTrainDialog = contentWindow.__require('HeroTrainDialog').HeroTrainDialog
            const ModuleManager = contentWindow.__require('ModuleManager')
            const UIHelper = contentWindow.__require('UIHelper').UIHelper
            const indexUi = contentWindow.__require('index-ui')
            const heroModule = ModuleManager.GET_MODULE(Configs.ModuleType.HERO)
            const heroItem = item.m_heroItem
            const slot = heroItem.m_slot

            UIHelper.showHeroIcon(slot, hero)
            heroItem.m_nameColor.setSelectedPage(String(hero.color))
            heroItem.m_name.text = hero.realName
            heroItem.m_power.text = Number.abridge(hero.power)
            slot.m_redPoint.m_isRed.selectedPage = String(heroModule.judgeUpgradeStar(hero))
            slot.clearClick()
            slot.onClick(() => {
                const model = {}
                model[HeroTrainDialog.OP_HERO_ID] = hero.heroId
                model[HeroTrainDialog.OP_TAP_INDEX] = 0
                indexUi.SHOW_PROXY(HeroTrainDialog, model)
            })

            this._refreshHeroLevelUp(heroItem, hero)
        }

        proto._kakaRedPointPatched = true
        console.log('[卡卡] 英雄培养列表红点过滤已启用')
    }

    function hookHeroAllPanelRedPoint(contentWindow, HeroAllPanelClass) {
        const proto = HeroAllPanelClass?.prototype
        if (!proto || proto._kakaRedPointPatched || typeof proto._showHeroCell !== 'function') return

        const originalShowHeroCell = proto._showHeroCell
        proto._showHeroCell = function (index, cell) {
            const result = originalShowHeroCell.apply(this, arguments)

            try {
                const Configs = contentWindow.__require('Configs')
                const ModuleManager = contentWindow.__require('ModuleManager')
                const heroModule = ModuleManager.GET_MODULE(Configs.ModuleType.HERO)
                const hero = heroModule.heroesByFilter[index]

                if (hero && !hero.createByClient && cell?.m_slot?.m_hero?.m_redPoint?.m_isRed) {
                    cell.m_slot.m_hero.m_redPoint.m_isRed.selectedPage = String(heroModule.judgeUpgradeStar(hero))
                }
            } catch (e) { }

            return result
        }

        proto._kakaRedPointPatched = true
        console.log('[卡卡] 英雄总览红点过滤已启用')
    }

    // 战斗漂字优化 - 数值万/亿格式化，并按伤害类型调整样式
    function startBattleFlyTextOptimizer(contentWindow) {
        if (contentWindow._battleFlyTextOptimizerStarted) return
        contentWindow._battleFlyTextOptimizerStarted = true

        const state = { compPatched: false, hpPatched: false }
        const timer = setInterval(() => {
            try {
                const requireFn = getRequire(contentWindow)
                if (!requireFn) return

                patchFlyUiModules(contentWindow, requireFn)
                state.compPatched = patchCompFlyEffect(requireFn) || state.compPatched
                patchSystemEffect(contentWindow, requireFn)
                state.hpPatched = patchHpTextGlobal(contentWindow) || state.hpPatched

                if (state.compPatched && state.hpPatched) {
                    clearInterval(timer)
                    contentWindow._battleFlyTextOptimizerTimer = null
                }
            } catch (e) { }
        }, 100)

        contentWindow._battleFlyTextOptimizerTimer = timer
        setTimeout(() => {
            if (contentWindow._battleFlyTextOptimizerTimer) {
                clearInterval(contentWindow._battleFlyTextOptimizerTimer)
                contentWindow._battleFlyTextOptimizerTimer = null
            }
        }, 60000)

        console.log('[卡卡] 战斗漂字优化已启用')
    }

    function getRequire(contentWindow) {
        if (typeof contentWindow.__require === 'function') return contentWindow.__require
        if (typeof contentWindow.require === 'function') return contentWindow.require
        return null
    }

    const FLY_UI_MODULE_NAMES = [
        'UI_FlyDamage',
        'UI_FlyDamageSkew',
        'UI_FlyCrit',
        'UI_FlyCritSkew',
        'UI_FlyBlock',
        'UI_FlyTreatment',
        'UI_FlyBleed',
        'UI_FlyPoison',
        'UI_FlyBurn',
        'UI_FlyTerrifying',
        'UI_FlyTongxin',
        'UI_FlyHelp',
        'UI_FlyTieXue',
        'UI_FlyQingNang',
        'UI_FlyRende',
        'UI_FlyXuanJi',
        'UI_FlyJianDan'
    ]

    const DAMAGE_TYPE_LABELS = ['', '+', '暴击', '格挡', '流血', '毒', '灼烧', '恐', '同心', '协力', '铁血', '青囊', '仁德', '玄机', '剑胆']
    const DAMAGE_TYPE_COLORS = [
        [255, 255, 255, 255],
        [0, 255, 0, 255],
        [255, 0, 0, 255],
        [128, 128, 128, 255],
        [139, 0, 0, 255],
        [128, 0, 128, 255],
        [255, 140, 0, 255],
        [75, 0, 130, 255],
        [255, 215, 0, 255],
        [0, 191, 255, 255],
        [178, 34, 34, 255],
        [0, 206, 209, 255],
        [255, 192, 203, 255],
        [138, 43, 226, 255],
        [255, 69, 0, 255]
    ]

    function patchFlyUiModules(contentWindow, requireFn) {
        FLY_UI_MODULE_NAMES.forEach((moduleName) => {
            try {
                const mod = requireFn(moduleName)
                const Cls = mod && (mod.default || mod[Object.keys(mod)[0]])
                if (!Cls?.prototype || Cls.prototype._kakaFlyTextPatched) return

                const damageType = getDamageTypeByFlyModule(moduleName)
                const originalOnConstruct = Cls.prototype.onConstruct
                Cls.prototype.onConstruct = function () {
                    if (typeof originalOnConstruct === 'function') {
                        originalOnConstruct.call(this)
                    }

                    const textField = this.m_number || this.m_num || this.m_value
                    if (textField) {
                        setFlyTextStyle(contentWindow, textField, damageType)
                        hookFlyTextField(textField, damageType)
                    }
                }

                Cls.prototype._kakaFlyTextPatched = true
            } catch (e) { }
        })
    }

    function getDamageTypeByFlyModule(moduleName) {
        const typeMap = {
            UI_FlyDamage: 0,
            UI_FlyDamageSkew: 0,
            UI_FlyTreatment: 1,
            UI_FlyCrit: 2,
            UI_FlyCritSkew: 2,
            UI_FlyBlock: 3,
            UI_FlyBleed: 4,
            UI_FlyPoison: 5,
            UI_FlyBurn: 6,
            UI_FlyTerrifying: 7,
            UI_FlyTongxin: 8,
            UI_FlyHelp: 9,
            UI_FlyTieXue: 10,
            UI_FlyQingNang: 11,
            UI_FlyRende: 12,
            UI_FlyXuanJi: 13,
            UI_FlyJianDan: 14
        }

        return typeMap[moduleName] ?? 0
    }

    function patchCompFlyEffect(requireFn) {
        try {
            const compMod = requireFn('comp-fly-effect')
            const CompFlyEffect = compMod && (compMod.CompFlyEffect || compMod.default)
            if (!CompFlyEffect || CompFlyEffect._kakaFlyTextPatched) return Boolean(CompFlyEffect?._kakaFlyTextPatched)

            const rawKey = '_kakaRawFloatString'
            const showKey = '_kakaShowFloatString'
            Object.defineProperty(CompFlyEffect.prototype, 'floatString', {
                configurable: true,
                enumerable: true,
                get() {
                    return this[showKey] || this[rawKey] || ''
                },
                set(value) {
                    this[rawKey] = value
                    this[showKey] = formatBattleNumber(value, this.type)
                }
            })

            CompFlyEffect._kakaFlyTextPatched = true
            return true
        } catch (e) {
            return false
        }
    }

    function patchSystemEffect(contentWindow, requireFn) {
        if (contentWindow._kakaSystemEffectPatched) return

        try {
            const systemEffectMod = requireFn('system-effect')
            const SystemEffect = systemEffectMod && (systemEffectMod.SystemEffect || systemEffectMod.default)
            if (!SystemEffect?.prototype?.onEntityAdded) return

            const originalOnEntityAdded = SystemEffect.prototype.onEntityAdded
            SystemEffect.prototype.onEntityAdded = function (entity, group) {
                originalOnEntityAdded.call(this, entity, group)

                try {
                    const matchers = this.getMatchers ? this.getMatchers() : []
                    if (group !== matchers[0]) return

                    const compFlyEffect = entity.getComponent(requireFn('comp-fly-effect').CompFlyEffect)
                    const numberField = compFlyEffect?.display?.ui?.m_number
                    if (numberField) {
                        setFlyTextStyle(contentWindow, numberField, compFlyEffect.type)
                    }
                } catch (e) { }
            }

            contentWindow._kakaSystemEffectPatched = true
        } catch (e) { }
    }

    function hookFlyTextField(textField, damageType) {
        if (!textField || textField._kakaFlyTextHooked) return

        try {
            let proto = textField
            let desc = null
            while (proto && !desc) {
                proto = Object.getPrototypeOf(proto)
                if (!proto) break
                desc = Object.getOwnPropertyDescriptor(proto, 'text')
            }

            if (desc && typeof desc.set === 'function') {
                const originalGet = desc.get
                const originalSet = desc.set
                Object.defineProperty(textField, 'text', {
                    configurable: true,
                    enumerable: true,
                    get() {
                        return originalGet ? originalGet.call(this) : this._text
                    },
                    set(value) {
                        originalSet.call(this, formatBattleNumber(value, damageType))
                    }
                })
                textField._kakaFlyTextHooked = true
                return
            }

            if (typeof textField.setText === 'function') {
                const originalSetText = textField.setText
                textField.setText = function (value) {
                    return originalSetText.call(this, formatBattleNumber(value, damageType))
                }
                textField._kakaFlyTextHooked = true
            }
        } catch (e) { }
    }

    function patchHpTextGlobal(contentWindow) {
        const fgui = contentWindow.fgui || contentWindow.fairygui
        const GTextField = fgui?.GTextField
        if (!GTextField?.prototype || GTextField.prototype._kakaHpTextPatched) return Boolean(GTextField?.prototype?._kakaHpTextPatched)

        let proto = GTextField.prototype
        let desc = null
        while (proto && !desc) {
            desc = Object.getOwnPropertyDescriptor(proto, 'text')
            proto = Object.getPrototypeOf(proto)
        }

        if (desc && typeof desc.set === 'function') {
            const originalGet = desc.get
            const originalSet = desc.set
            Object.defineProperty(GTextField.prototype, 'text', {
                configurable: true,
                enumerable: true,
                get() {
                    return originalGet ? originalGet.call(this) : this._text
                },
                set(value) {
                    originalSet.call(this, formatHpText(value))
                }
            })
            GTextField.prototype._kakaHpTextPatched = true
            return true
        }

        if (typeof GTextField.prototype.setText === 'function') {
            const originalSetText = GTextField.prototype.setText
            GTextField.prototype.setText = function (value) {
                return originalSetText.call(this, formatHpText(value))
            }
            GTextField.prototype._kakaHpTextPatched = true
            return true
        }

        return false
    }

    function formatHpText(value) {
        if (typeof value !== 'string' || !/HP$/i.test(value.trim())) return value
        return formatBattleNumber(value.trim().replace(/\s*HP$/i, ''))
    }

    function formatBattleNumber(value, damageType) {
        if (value === undefined || value === null) return '0'

        const original = String(value).trim()
        if (original.endsWith('亿') || original.endsWith('万')) return original

        const match = original.match(/^([^\d\-.]*)([+-]?)([\d.]+)$/)
        if (!match) return original

        const num = Number(match[3])
        if (!Number.isFinite(num)) return original

        const absNum = Math.abs(num)
        let suffix
        if (absNum < 10000) {
            suffix = String(Math.floor(absNum))
        } else if (absNum < 100000000) {
            suffix = `${Math.floor(absNum / 10000)}万`
        } else {
            suffix = `${Math.floor(absNum / 100000000)}亿`
        }

        const label = typeof damageType === 'number' ? DAMAGE_TYPE_LABELS[damageType] : ''
        if (label) return `${label}${suffix}`

        return `${match[1] || ''}${match[2] || ''}${suffix}`
    }

    function setFlyTextStyle(contentWindow, textField, damageType) {
        if (!textField) return

        try {
            const cc = contentWindow.cc
            if (typeof textField.font !== 'undefined') {
                textField.font = 'HYDianHeiW'
            }
            if (textField.asTextField && typeof textField.asTextField.font !== 'undefined') {
                textField.asTextField.font = 'HYDianHeiW'
            }
            if (cc?.color) {
                const color = DAMAGE_TYPE_COLORS[damageType] || DAMAGE_TYPE_COLORS[0]
                textField.color = cc.color(color[0], color[1], color[2], color[3])
                if (typeof textField.stroke !== 'undefined') {
                    textField.stroke = 3
                    textField.strokeColor = cc.color(0, 0, 0, 255)
                }
                if (typeof textField.shadowOffset !== 'undefined') {
                    textField.shadowOffset = cc.v2(4, -4)
                    textField.shadowColor = cc.color(101, 67, 33, 180)
                }
            }
        } catch (e) { }
    }

    // 罐子奖励计算
    function hookBottleRobotDialog(contentWindow, BottleRobotDialogClass) {
        const proto = BottleRobotDialogClass?.prototype
        if (!proto || proto._kakaBottleCalcPatched || typeof proto.onShow !== 'function') return

        const originalOnShow = proto.onShow
        const originalOnHide = proto.onHide
        proto.onShow = function () {
            const result = originalOnShow.apply(this, arguments)
            addBottleCalculateButton(contentWindow, this)
            return result
        }

        proto.onHide = function () {
            disposeDialogChild(this, '_calculateButtonBottle')
            if (typeof originalOnHide === 'function') {
                return originalOnHide.apply(this, arguments)
            }
        }

        proto._kakaBottleCalcPatched = true
        console.log('[卡卡] 罐子奖励计算已启用')
    }

    function addBottleCalculateButton(contentWindow, dialog) {
        if (dialog._calculateButtonBottle) return

        try {
            const button = contentWindow.fgui.UIPackage.createObject('ui_common', 'BtnInfo2').asButton
            const anchor = dialog.ui.m_btnHelp
            if (anchor) {
                button.setPosition(anchor.x, anchor.y + anchor.height + 10)
            } else {
                button.setPosition((dialog.ui.width - button.width) / 2, (dialog.ui.height - button.height) / 2)
            }

            button.onClick(() => showBottleCalculateResult(contentWindow, dialog, button))
            dialog.ui.addChild(button)
            dialog._calculateButtonBottle = button
        } catch (e) {
            showTip(contentWindow, '罐子计算按钮创建失败')
        }
    }

    function showBottleCalculateResult(contentWindow, dialog, button) {
        try {
            const gold = dialog.bottleComps?.[0]?.obtainCnt || 0
            const silver = dialog.bottleComps?.[1]?.obtainCnt || 0
            const copper = dialog.bottleComps?.[2]?.obtainCnt || 0
            const guaranteed = gold * 160 + silver * 100 + copper * 40
            const estimated = gold * 190 + silver * 110 + copper * 48
            const content = [
                '=====罐子计算结果=====',
                '',
                `金罐子: ${gold} 个`,
                `银罐子: ${silver} 个`,
                `铜罐子: ${copper} 个`,
                '',
                `平均预估: ${estimated.toLocaleString()} 金砖`,
                `保底金砖: ${guaranteed.toLocaleString()} 金砖`,
                '',
                '========@苏念========='
            ].join('\n')

            showHelpText(contentWindow, button, content)
        } catch (e) {
            showTip(contentWindow, '计算出错')
        }
    }

    // 红淬跳过
    function hookQuenchStageUpDialog(contentWindow, QuenchDialogClass) {
        if (!QuenchDialogClass?.prototype) return

        const originalOnShow = QuenchDialogClass.prototype.onShow
        const originalOnHide = QuenchDialogClass.prototype.onHide
        const originalCheckQuenchConfirm = QuenchDialogClass.prototype._checkQuenchConfirm

        QuenchDialogClass.prototype.onShow = function () {
            originalOnShow.apply(this, arguments)
            if (this.button_red) return

            const button = contentWindow.fgui.UIPackage.createObject('ui_equipQuench', 'AutoQuenchToggle').asButton
            const Button = this.ui.m_btnSetting
            if (Button) {
                button.setPosition(Button.x, Button.y + 70)
                button.m_title.text = '跳过红色'
            }

            button.m_checkBox.onClick(() => {
                if (button.m_checkBox.selected) {
                    const indexUi = contentWindow.__require('index-ui')
                    const NormalDialog = contentWindow.__require('NormalDialog')
                    indexUi.SHOW_SIMPLE_DIALOG(NormalDialog.NormalDialog, {
                        content: '确定关闭红色淬炼提醒弹窗吗？自动淬炼过程中如果遇到红色淬炼将不再出现确认弹窗，并会自动继续洗炼',
                        hook: (confirmed) => {
                            if (confirmed) {
                                this.isSkipRed = true
                            } else {
                                this.isSkipRed = false
                                button.m_checkBox.selected = false
                            }
                        }
                    })
                } else {
                    this.isSkipRed = false
                }
            })

            this.ui.addChild(button)
            this.button_red = button
        }

        QuenchDialogClass.prototype.onHide = function () {
            if (this.button_red) {
                this.button_red.dispose()
                this.button_red = null
            }
            this.isSkipRed = false
            originalOnHide.apply(this, arguments)
        }

        QuenchDialogClass.prototype._checkQuenchConfirm = function () {
            if (this.isSkipRed) return false
            return originalCheckQuenchConfirm.apply(this, arguments)
        }

        console.log('[卡卡] 红淬跳过已启用')
    }

    // 玩家信息弹窗增强
    function hookPlayerInfoDialog(contentWindow, PlayerInfoDialogClass) {
        if (!PlayerInfoDialogClass?.prototype) return

        PlayerInfoDialogClass.prototype._onClickBtnNativeImg = function () {
            this._showChangeHeadImageDialog()
        }

        const originalPlayerInfoShow = PlayerInfoDialogClass.prototype.onShow

        PlayerInfoDialogClass.prototype.onShow = function () {
            const T = contentWindow.__require('consts')
            const d = contentWindow.__require('ServerData')
            const le = contentWindow.__require('LanguageExt')
            const pm = contentWindow.__require('PlatformManager')
            const TipsManager = contentWindow.__require('TipsManager')
            const roleInfo = this.model.get(T.ModelConst.ROLE_INFO)
            const isSelf = roleInfo.roleId === d.ROLE.roleId

            const result = originalPlayerInfoShow.apply(this, arguments)

            // 查看别人时，激活ID、区服和复制按钮
            if (!isSelf) {
                setTimeout(() => {
                    // 激活被隐藏的节点
                    this.ui.m_serverName._node.active = true
                    this.ui.m_playerid._node.active = true
                    this.ui.m_btnCopyID._node.active = true

                    // 激活区服背景框 (n101)
                    this.ui.m_serverName.parent.getChild('n101')._node.active = true

                    // 重新绑定复制按钮事件（复制别人的ID）
                    this.ui.m_btnCopyID.clearClick()
                    this.ui.m_btnCopyID.onClick(() => {
                        const serverName = le.GET_SERVER_NAME(parseInt(roleInfo.serverName), false)
                        const copyText = serverName + '+' + roleInfo.roleId
                        pm.PlatformManager.instance.setClipboardData({
                            data: copyText,
                            success: () => {
                                TipsManager.SHOW_TIP('复制成功')
                            }
                        })
                    })
                }, 100)
            }

            return result
        }

        console.log('[卡卡] 玩家信息弹窗增强已启用')
    }

    // 竞技场战报增强 - 点击头像显示玩家信息
    function hookArenaRecordDialog(contentWindow, ArenaRecordDialogClass) {
        if (!ArenaRecordDialogClass?.prototype) return

        const originalRefreshItem = ArenaRecordDialogClass.prototype._refreshSingleListItem

        ArenaRecordDialogClass.prototype._refreshSingleListItem = function (e, t) {
            const result = originalRefreshItem.call(this, e, t)

            const recordData = this.recordList?.[e]
            if (recordData && t.m_headIcon) {
                const RankModule = contentWindow.__require('RankModule')
                t.m_headIcon.clearClick()
                t.m_headIcon.onClick(() => {
                    RankModule.SHOW_ROLE_INFO(recordData.oppositeId)
                })
            }

            return result
        }

        console.log('[卡卡] 竞技场战报增强已启用')
    }

    // 好友搜索增强 - 点击头像显示玩家信息
    function hookFriendSearchDialog(contentWindow, FriendSearchDialogClass) {
        if (!FriendSearchDialogClass?.prototype) return

        const originalRefreshUI = FriendSearchDialogClass.prototype._refreshUI

        FriendSearchDialogClass.prototype._refreshUI = function () {
            const result = originalRefreshUI.apply(this, arguments)

            if (this._curFriendInfo && this.ui.m_friend.m_headIcon) {
                const RankModule = contentWindow.__require('RankModule')
                const curFriendInfo = this._curFriendInfo
                this.ui.m_friend.m_headIcon.clearClick()
                this.ui.m_friend.m_headIcon.onClick(() => {
                    RankModule.SHOW_ROLE_INFO(curFriendInfo.roleId)
                })
            }

            return result
        }

        console.log('[卡卡] 好友搜索增强已启用')
    }

    // 宝箱计算和默认跳过宝箱动画
    function hookBoxPanel(contentWindow, BoxPanelClass) {
        if (!BoxPanelClass?.prototype) return

        contentWindow._skipBoxAnim = true

        const originalOnShow = BoxPanelClass.prototype.onShow
        const originalOnHide = BoxPanelClass.prototype.onHide
        const originalOnOpenBox = BoxPanelClass.prototype._onOpenBox

        BoxPanelClass.prototype._onOpenBox = async function () {
            if (!contentWindow._skipBoxAnim) {
                return originalOnOpenBox.apply(this, arguments)
            }

            const boxList = this.boxList
            const currentIndex = this._currentIndex
            if (currentIndex < 0 || currentIndex >= boxList.length) return

            const boxItem = boxList[currentIndex]
            const itemId = boxItem.id
            const quantity = contentWindow.ROLE.getItemQuantity(itemId)
            if (quantity === 0) return

            this._removeCoinAnim()

            const Configs = contentWindow.__require('Configs')
            const ModuleManager = contentWindow.__require('ModuleManager')
            const LanguageExt = contentWindow.__require('LanguageExt')
            const TipsManager = contentWindow.__require('TipsManager')

            const boxModule = ModuleManager.GET_MODULE(Configs.ModuleType.BOX)
            const openNum = boxModule.getOpenBoxNum(boxItem, quantity)

            const rewards = await boxModule.sendOpenBox(itemId, openNum)
            if (rewards) {
                boxModule.syncBoxPoint()
                const itemConfig = Configs.ItemConf.getById(itemId)
                const itemName = itemConfig ? LanguageExt.GET_CONTENT(itemConfig.name) : '宝箱'
                TipsManager.SHOW_TIP(`成功开启 ${openNum} 个${itemName}`)
            }

            this._refresh()
        }

        BoxPanelClass.prototype.onShow = function () {
            originalOnShow.apply(this, arguments)
            addBoxCalculateButton(contentWindow, this)
        }

        BoxPanelClass.prototype.onHide = function () {
            disposeDialogChild(this, '_calculateButtonBox')
            originalOnHide.apply(this, arguments)
        }

        console.log('[卡卡] 宝箱计算和默认跳过宝箱动画已启用')
    }

    function addBoxCalculateButton(contentWindow, dialog) {
        if (dialog._calculateButtonBox) return

        try {
            const button = contentWindow.fgui.UIPackage.createObject('ui_common', 'BtnInfo2').asButton
            const anchor = dialog.ui.m_quesHelp
            if (anchor) {
                button.setPosition(anchor.x + anchor.width + 10, anchor.y)
            } else {
                button.setPosition(20, dialog.ui.height - button.height - 20)
            }

            button.onClick(() => showBoxCalculateResult(contentWindow, dialog, button))
            dialog.ui.addChild(button)
            dialog._calculateButtonBox = button
        } catch (e) {
            showTip(contentWindow, '宝箱计算按钮创建失败')
        }
    }

    function showBoxCalculateResult(contentWindow, dialog, button) {
        try {
            const ModuleManager = contentWindow.__require('ModuleManager')
            const Configs = contentWindow.__require('Configs')
            const LanguageExt = contentWindow.__require('LanguageExt')
            const boxModule = ModuleManager.GET_MODULE(Configs.ModuleType.BOX)

            boxModule.syncRewardConf()
            const rewardConf = boxModule.curBoxPointLastRewardConf
            const data = {
                wood_chest: contentWindow.ROLE.getItemQuantity(2001),
                bronze_chest: contentWindow.ROLE.getItemQuantity(2002),
                gold_chest: contentWindow.ROLE.getItemQuantity(2003),
                platinum_chest: contentWindow.ROLE.getItemQuantity(2004),
                current_points: boxModule.boxRenderPoint,
                required_points: rewardConf ? rewardConf.limit : 0,
                chest_type: rewardConf ? LanguageExt.GET_CONTENT(rewardConf.description) || '未知宝箱' : '无'
            }

            showHelpText(contentWindow, button, calculateBoxResult(data))
        } catch (e) {
            showTip(contentWindow, '计算出错')
        }
    }

    const BOX_STAGES = {
        values: [10, 20, 30, 40, 80, 100, 70, 50, 100],
        boxes: ['青铜宝箱', '青铜宝箱', '黄金宝箱', '铂金宝箱', '铂金宝箱', '铂金宝箱', '黄金宝箱', '铂金宝箱', '钻石宝箱']
    }

    const BOX_POINTS = {
        木质宝箱: 1,
        青铜宝箱: 10,
        黄金宝箱: 20,
        铂金宝箱: 50,
        钻石宝箱: 0
    }

    function calculateBoxResult(data) {
        const allPoints = data.wood_chest + data.bronze_chest * 10 + data.gold_chest * 20 + data.platinum_chest * 50 + data.current_points
        const noWoodPoints = data.bronze_chest * 10 + data.gold_chest * 20 + data.platinum_chest * 50 + data.current_points
        const noPlatinumPoints = data.wood_chest + data.bronze_chest * 10 + data.gold_chest * 20 + data.current_points
        const all = calculateBoxRecursive(allPoints, data.required_points, data.chest_type, false)
        const noWood = calculateBoxRecursive(noWoodPoints, data.required_points, data.chest_type, false)
        const noPlatinum = calculateBoxRecursive(noPlatinumPoints, data.required_points, data.chest_type, true)

        return [
            '===== 宝箱计算结果 =====',
            formatBoxPlan('【全开】', allPoints, all),
            '---------------------',
            formatBoxPlan('【不开木质】', noWoodPoints, noWood),
            '---------------------',
            formatBoxPlan('【不开铂金】', noPlatinumPoints, noPlatinum),
            '=========@苏念========='
        ].join('\n\n')
    }

    function calculateBoxRecursive(points, requiredPoints, chestType, skipPlatinum, diamondBoxes = 0, pointValue = 0) {
        const normalizedChestType = normalizeBoxName(chestType)
        const stageIndex = BOX_STAGES.boxes.findIndex((boxName, index) => boxName === normalizedChestType && BOX_STAGES.values[index] === requiredPoints)
        if (stageIndex === -1) {
            return { error: '档位错误' }
        }

        if (points < requiredPoints) {
            return {
                totalPointValue: pointValue,
                totalDiamondBoxes: diamondBoxes,
                finalStageInfo: `积分值：${points}/${requiredPoints} (${normalizedChestType})`
            }
        }

        const openedBoxes = {
            青铜宝箱: 0,
            黄金宝箱: 0,
            铂金宝箱: 0,
            钻石宝箱: 0
        }
        let restPoints = points
        let index = stageIndex

        while (restPoints >= BOX_STAGES.values[index]) {
            restPoints -= BOX_STAGES.values[index]
            openedBoxes[BOX_STAGES.boxes[index]]++
            index = (index + 1) % BOX_STAGES.values.length
        }

        const gainedPointValue = openedBoxes.青铜宝箱 * BOX_POINTS.青铜宝箱 +
            openedBoxes.黄金宝箱 * BOX_POINTS.黄金宝箱 +
            (skipPlatinum ? 0 : openedBoxes.铂金宝箱 * BOX_POINTS.铂金宝箱)

        return calculateBoxRecursive(
            restPoints + gainedPointValue,
            BOX_STAGES.values[index],
            BOX_STAGES.boxes[index],
            skipPlatinum,
            diamondBoxes + openedBoxes.钻石宝箱,
            pointValue + gainedPointValue
        )
    }

    function normalizeBoxName(value) {
        const text = String(value || '').replace(/<[^>]+>/g, '').replace(/\s/g, '')
        if (text.includes('木质')) return '木质宝箱'
        if (text.includes('青铜')) return '青铜宝箱'
        if (text.includes('黄金')) return '黄金宝箱'
        if (text.includes('铂金')) return '铂金宝箱'
        if (text.includes('钻石')) return '钻石宝箱'
        return text
    }

    function formatBoxPlan(title, basePoints, result) {
        if (result.error) {
            return `${title}\n计算出错: ${result.error}`
        }

        const totalPoints = basePoints + result.totalPointValue
        return [
            title,
            `宝箱裸分: ${basePoints.toLocaleString()}`,
            `宝箱总分: ${totalPoints.toLocaleString()}分`,
            `宝箱轮数: ${(totalPoints / 8000).toFixed(2)}轮(下轮需: ${(8000 - totalPoints % 8000).toLocaleString()}分)`,
            result.finalStageInfo,
            `奖励钻石宝箱: ${result.totalDiamondBoxes}个`
        ].join('\n')
    }

    function showHelpText(contentWindow, target, content) {
        const indexUi = contentWindow.__require('index-ui')
        const HelpTextDialog = contentWindow.__require('HelpTextDialog').HelpTextDialog
        const model = {}
        model[HelpTextDialog.OP_OBJ] = target
        model[HelpTextDialog.OP_CONTENT] = content
        indexUi.SHOW_PROXY_OVER(HelpTextDialog, model)
    }

    function showTip(contentWindow, content) {
        try {
            contentWindow.__require('TipsManager').SHOW_TIP(content)
        } catch (e) {
            console.warn('[卡卡]', content)
        }
    }

    function disposeDialogChild(dialog, key) {
        if (!dialog || !dialog[key]) return

        if (typeof dialog[key].dispose === 'function') {
            dialog[key].dispose()
        }
        dialog[key] = null
    }

    // 邮件详情增强 - 点击头像复制玩家ID
    function hookLegacyMailDetailDialog(contentWindow, LegacyMailDetailDialogClass) {
        if (!LegacyMailDetailDialogClass?.prototype) return

        const originalOnShow = LegacyMailDetailDialogClass.prototype.onShow

        LegacyMailDetailDialogClass.prototype.onShow = function () {
            const result = originalOnShow.apply(this, arguments)

            const friend = this.ui.m_friend
            if (friend) {
                const headIcon = friend._children[1]
                const playerIdLabel = friend._children[2]

                if (headIcon && playerIdLabel) {
                    headIcon.clearClick()
                    headIcon.onClick(() => {
                        const idText = playerIdLabel.text.replace('玩家ID：', '')
                        copyText(idText)
                    })
                }
            }

            return result
        }

        console.log('[卡卡] 邮件详情增强已启用')
    }

    // 隐藏所有首次登录弹窗
    function hideFirstLoginDialogs(FirstFaceToPlayerManagerClass) {
        const manager = FirstFaceToPlayerManagerClass?.instance
        if (!manager) return

        manager.setActive = function () { }

        console.log('[卡卡] 隐藏所有登录弹窗已启用')
    }

    script(window)
})()
