(function () {
    function script(contentWindow) {
        if (contentWindow._script) return
        contentWindow._script = true

        // 各功能独立检测、独立注入
        fixChooseImage(contentWindow)
        waitForPlatformManager(contentWindow)

        waitForModule(contentWindow, 'HeroAttributeToolTip', (m) => {
            if (m && m.HeroAttributeToolTip) {
                hookHeroAttributeToolTip(contentWindow, m.HeroAttributeToolTip)
            }
        })

        waitForModule(contentWindow, 'QuenchStageUpDialog', (m) => {
            if (m && m.QuenchStageUpDialog) {
                hookQuenchStageUpDialog(contentWindow, m.QuenchStageUpDialog)
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

    // 英雄属性面板增强 - 扩展显示更多属性
    function hookHeroAttributeToolTip(contentWindow, HeroTipClass) {
        if (!HeroTipClass?.prototype) return

        const originalOnShow = HeroTipClass.prototype.onShow
        let attrPatched = false

        HeroTipClass.prototype.onShow = function () {
            // 只修改一次配置
            if (!attrPatched) {
                const Configs = contentWindow.__require('Configs')
                const attrs = Configs.ConstantConf.config.specialBattleAttribute
                if (attrs.length === 16) {
                    attrs.push(65, 66, 67, 68, 69, 70, 79, 80, 226, 227, 228, 229, 230, 231)
                }
                attrPatched = true
            }

            // 显示全部属性
            const attr = this.ui.m_advanceAttr
            if (attr) attr.setSize(attr._width, 438)

            // 调大背景框
            const n9 = this.ui._children[0]
            if (n9) n9.setSize(n9._width, 720)

            return originalOnShow.apply(this, arguments)
        }

        console.log('[卡卡] 英雄属性面板增强已启用')
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

    // 跳过宝箱动画
    function hookBoxPanel(contentWindow, BoxPanelClass) {
        if (!BoxPanelClass?.prototype) return

        contentWindow._skipBoxAnim = false

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
            if (this._skipAnimCheckBox) return

            const TipsManager = contentWindow.__require('TipsManager')
            const Button = this.ui.m_quesHelp

            const checkBox = contentWindow.fgui.UIPackage.createObject('ui_common', 'BtnCheckBox')
            checkBox.setPosition(Button.x + Button.width + 10, Button.y)
            checkBox.selected = contentWindow._skipBoxAnim
            checkBox.onClick(() => {
                contentWindow._skipBoxAnim = checkBox.selected
                TipsManager.SHOW_TIP(checkBox.selected ? '已开启跳过动画' : '已关闭跳过动画')
            })

            const textArea = contentWindow.fgui.UIPackage.createObject('ui_common', 'TextArea')
            textArea.text = '跳过动画'
            textArea.touchable = false
            textArea.setPosition(Button.x + Button.width + 60, Button.y + 10)

            this.ui.addChild(checkBox)
            this.ui.addChild(textArea)
            this._skipAnimCheckBox = checkBox
            this._skipAnimText = textArea
        }

        BoxPanelClass.prototype.onHide = function () {
            if (this._skipAnimCheckBox) {
                this._skipAnimCheckBox.dispose()
                this._skipAnimCheckBox = null
            }
            if (this._skipAnimText) {
                this._skipAnimText.dispose()
                this._skipAnimText = null
            }
            originalOnHide.apply(this, arguments)
        }

        console.log('[卡卡] 跳过宝箱动画已启用')
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
