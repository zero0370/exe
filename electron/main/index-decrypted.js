"use strict";

const { app, BrowserWindow, dialog, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const resourceCache = require('./resource-cache');
// Prefer discrete/high-performance GPU for Chromium's GPU process.
app.commandLine.appendSwitch("force_high_performance_gpu");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("use-angle", "d3d11");


// ==================== 创建窗口 ====================
function createWindow(binPath, index, totalCount = 1) {
  // 提取 bin 文件名（不带扩展名）
  let binFileName = '';
  if (binPath) {
    const fullName = path.basename(binPath);
    binFileName = fullName.replace(/\.bin$/i, ''); // 移除 .bin 扩展名
  }
  
  // 获取屏幕工作区大小
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  
  // 根据窗口总数动态计算窗口大小和布局
  const margin = 10; // 窗口间距
  let windowWidth, windowHeight, cols, rows;
  
  if (totalCount === 1) {
    // 单窗口：使用默认大小
    windowWidth = 440;
    windowHeight = 800;
    cols = 1;
    rows = 1;
  } else {
    // 多窗口：动态等比例缩放布局，优先横向排列
    const targetRatio = 440 / 800; // 原始宽高比 0.55
    const maxCols = 6; // 最多6列（横向）
    
    // 计算需要多少行
    cols = Math.min(totalCount, maxCols);
    rows = Math.ceil(totalCount / cols);
    
    // 计算窗口大小（保持等比例）
    // 先尝试用原始大小
    let windowW = 440;
    let windowH = 800;
    
    // 计算实际需要的总宽高
    const totalNeededW = cols * windowW + (cols - 1) * margin;
    const totalNeededH = rows * windowH + (rows - 1) * margin;
    
    // 如果超出屏幕，等比例缩小
    if (totalNeededW > workArea.width || totalNeededH > workArea.height) {
      const scaleW = workArea.width / totalNeededW;
      const scaleH = workArea.height / totalNeededH;
      const scale = Math.min(scaleW, scaleH);
      
      windowW = Math.floor(440 * scale);
      windowH = Math.floor(800 * scale);
    }
    
    // 限制最小窗口大小
    if (windowW < 250) {
      windowW = 250;
      windowH = Math.floor(250 / targetRatio);
    }
    
    windowWidth = windowW;
    windowHeight = windowH;
  }
  
  console.log(`[窗口${index}] 窗口大小: ${windowWidth}x${windowHeight}, 布局: ${cols}列x${rows}行`);

  const mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    resizable: true, // 允许调节大小
    maximizable: true, // 允许最大化
    title: binFileName ? `缺德地图 - ${binFileName}` : "缺德地图", // 创建时就设置标题
    icon: path.join(__dirname, "../../resources/缺德地图.png"),
    autoHideMenuBar: true, // 自动隐藏菜单栏
    movable: true, // 允许窗口移动（新增）
    show: false, // 先隐藏，设置位置后再显示
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true, // 允许开发者工具，但默认不打开
      backgroundThrottling: false, // 禁用后台节流
      webgl: true, // 启用WebGL
      offscreen: false, // 禁用离屏渲染
    },
  });
  
  // 自动排列窗口位置（网格布局）
  if (totalCount > 1) {
    // 计算当前窗口的行列位置
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    // 计算实际占用的总宽高
    const totalWidth = cols * windowWidth + (cols - 1) * margin;
    const totalHeight = rows * windowHeight + (rows - 1) * margin;
    
    let startX, startY;
    
    // 如果窗口没有缩小（原始大小），则居中排列
    if (windowWidth === 440 && windowHeight === 800) {
      startX = workArea.x + Math.floor((workArea.width - totalWidth) / 2);
      startY = workArea.y + Math.floor((workArea.height - totalHeight) / 2);
    } else {
      // 窗口已缩小，从左上角开始排列
      startX = workArea.x;
      startY = workArea.y;
    }
    
    const x = startX + col * (windowWidth + margin);
    const y = startY + row * (windowHeight + margin);
    
    // 确保位置在屏幕范围内
    const safeX = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - windowWidth));
    const safeY = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - windowHeight));
    
    // 设置窗口位置并显示
    mainWindow.setPosition(Math.round(safeX), Math.round(safeY));
    console.log(`[窗口${index}] 自动排列位置: (${safeX}, ${safeY}), 行列: (${col}, ${row})`);
  }
  
  mainWindow.show();

  // 保存 binPath 到窗口对象，供刷新时使用
  mainWindow.binPath = binPath;
  mainWindow.binFileName = binFileName;

  // DOM加载完成后立即设置标题（在Cocos引擎修改之前）
  mainWindow.webContents.on('dom-ready', () => {
    if (binFileName) {
      const title = `缺德地图 - ${binFileName}`;
      mainWindow.setTitle(title);
      mainWindow.webContents.executeJavaScript(`document.title = '${title}';`);
      //console.log(`[窗口${index}] DOM就绪，设置标题: ${title}`);
    }
  });
  
  // 页面加载完成后再次确认标题
  mainWindow.webContents.on('did-finish-load', () => {
    if (binFileName) {
      const title = `缺德地图 - ${binFileName}`;
      mainWindow.setTitle(title);
      mainWindow.webContents.executeJavaScript(`document.title = '${title}';`);
      //console.log(`[窗口${index}] 页面加载完成，确认标题: ${title}`);
    }
  });

  // 直接加载本地 HTML 文件
  const indexPath = path.join(__dirname, "../../public/index.html");
  mainWindow.loadFile(indexPath);
  console.log(`[窗口${index}] 加载本地静态页面: ${indexPath}`);
  if (binPath) {
    console.log(`[窗口${index}] Bin文件: ${binPath}`);
  }

  // ==================== 资源拦截和缓存 ====================
  // 使用协议拦截而不是URL重定向，避免WebGL跨域问题
  mainWindow.webContents.session.protocol.registerBufferProtocol('cdn-cache', async (request, callback) => {
    try {
      const url = request.url.replace('cdn-cache://', 'https://');
      
      // 使用 getResource 方法（内置请求去重）
      const result = await resourceCache.getResource(url);
      
      if (result && result.data) {
        // console.log(`[缓存拦截] ${result.fromCache ? '缓存命中' : '下载完成'}: ${url}`);
        callback({
          mimeType: result.mimeType,
          data: result.data
        });
        return;
      }
      
      // 失败时返回空数据（静默处理）
      callback({ data: Buffer.from('') });
    } catch (e) {
      // 静默处理异常，不输出日志避免卡顿
      callback({ data: Buffer.from('') });
    }
  });

  // 拦截CDN请求，重定向到自定义协议
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ["https://xxz-xyzw-res.hortorgames.com/*"] },
    (details, callback) => {
      try {
        const url = details.url;
        
        // 所有CDN请求都重定向到自定义协议（由协议处理缓存逻辑）
        const customUrl = url.replace('https://', 'cdn-cache://');
        callback({ redirectURL: customUrl });
      } catch (e) {
        //console.error('[缓存拦截] 处理异常:', e.message);
        callback({});
      }
    }
  );

  // 处理本地文件访问的CORS问题
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ["file://*"] },
    (details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS'];
      responseHeaders['Access-Control-Allow-Headers'] = ['*'];
      callback({ responseHeaders });
    }
  );

  // 处理CDN资源的CORS问题（WebGL纹理需要）
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ["https://xxz-xyzw-res.hortorgames.com/*"] },
    (details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS'];
      responseHeaders['Access-Control-Allow-Headers'] = ['*'];
      // WebGL纹理需要这个头
      responseHeaders['Cross-Origin-Resource-Policy'] = ['cross-origin'];
      callback({ responseHeaders });
    }
  );

  mainWindow.webContents.on("did-finish-load", () => {
    // 从窗口对象中获取 binPath 和 binFileName（支持刷新后重新使用）
    const currentBinPath = mainWindow.binPath;
    const currentBinFileName = mainWindow.binFileName;

    // ==================== 注入登录请求拦截器（使用 bin 解密并 Hook HttpDelegate） ====================
    if (currentBinPath && fs.existsSync(currentBinPath)) {
      const binContent = fs.readFileSync(currentBinPath);
      const binBase64 = binContent.toString('base64');

      mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            console.log('[登录拦截器] 开始注入登录请求拦截器');

            // Base64转ArrayBuffer
            function base64ToArrayBuffer(base64) {
              const binaryString = atob(base64);
              const length = binaryString.length;
              const bytes = new Uint8Array(length);
              for (let i = 0; i < length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              return bytes.buffer;
            }

            const binBase64 = '${binBase64}';
            const arrayBuffer = base64ToArrayBuffer(binBase64);
            console.log('[登录拦截器] Bin文件大小:', arrayBuffer.byteLength, '字节');

            // 使用 fetch 拦截方式 hook HttpDelegate
            const origFetch = window.fetch;
            let originalSendAsync = null;

            window.fetch = async function(url, options) {
              // 在第一次 fetch 时尝试 hook
              if (originalSendAsync == null && window.o4e && window.o4e.HttpDelegate && window.__require) {
                try {
                  console.log('[登录拦截器] 检测到 fetch 请求，开始 hook HttpDelegate');
                  
                  const c = window.__require("13");
                  if (!c || !c.decMsg || !c.lz4XorDecode || !c.lz4XorEncode) {
                    console.error('[登录拦截器] 模块 13 不存在或函数不存在');
                  } else {
                    const account = c.decMsg(arrayBuffer, {
                      decrypt: c.lz4XorDecode,
                      encrypt: c.lz4XorEncode,
                    });

                    const info = account._raw;
                    let serverId = info && info.serverId;
                    1
                    console.log('[登录拦截器] 账号信息解密成功');

                    originalSendAsync = window.o4e.HttpDelegate.prototype.sendAsync;

                    window.o4e.HttpDelegate.prototype.sendAsync = function (e) {
                      if (e && e.params && e.params.info) {
                        if (e.params.serverId) {
                          e.params = { ...info, serverId: e.params.serverId };
                        } else {
                          e.params = { ...info };
                        }
                        if (serverId) {
                          e.params.serverId = serverId;
                          serverId = null;
                        }
                      }
                      return originalSendAsync.call(this, e);
                    };

                    console.log('[登录拦截器] ✓ 已通过 HttpDelegate.sendAsync 注入 bin 账号信息');
                  }
                } catch (e) {
                  console.error('[登录拦截器] hook 失败:', e);
                }
              }

              // 调用原始 fetch
              return origFetch.apply(this, arguments);
            };

            console.log('[登录拦截器] fetch 拦截器已设置');
          } catch (err) {
            console.error('[登录拦截器] 注入过程出错:', err);
          }
        })();
      `).catch(err => {
        console.error('登录拦截器注入失败:', err);
      });
    }

    // ==================== 注入外部油猴脚本 ====================
    if (currentBinPath && fs.existsSync(currentBinPath)) {
      const binDir = path.dirname(currentBinPath);

      try {
        // 读取 bin 文件所在目录的所有文件
        const files = fs.readdirSync(binDir);

        // 查找目录中所有后缀为 .js 或 .txt 的文件
        const extensionFiles = files.filter(file =>
          file.endsWith('.js') || file.endsWith('.txt')
        );

        if (extensionFiles.length > 0) {
          console.log(`[扩展脚本] 找到 ${extensionFiles.length} 个扩展脚本文件（.js/.txt）:`, extensionFiles);

          // 依次执行所有扩展脚本
          extensionFiles.forEach((fileName, index) => {
            const extensionScriptPath = path.join(binDir, fileName);
            try {
              const extensionScript = fs.readFileSync(extensionScriptPath, 'utf8');
              console.log(`[扩展脚本] [${index + 1}/${extensionFiles.length}] 加载扩展脚本: ${fileName}`);

              mainWindow.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('[扩展脚本] 开始执行扩展脚本: ${fileName}');
                    
                    // ==================== 油猴脚本兼容层 ====================
                    // 为油猴脚本提供必要的全局变量和API
                    if (typeof unsafeWindow === 'undefined') {
                      window.unsafeWindow = window;
                    }
                    
                    // 提供 GM_* API 的简单实现（如果脚本需要）
                    if (typeof GM_getValue === 'undefined') {
                      window.GM_getValue = function(key, defaultValue) {
                        try {
                          const value = localStorage.getItem('GM_' + key);
                          return value !== null ? JSON.parse(value) : defaultValue;
                        } catch (e) {
                          return defaultValue;
                        }
                      };
                    }
                    
                    if (typeof GM_setValue === 'undefined') {
                      window.GM_setValue = function(key, value) {
                        localStorage.setItem('GM_' + key, JSON.stringify(value));
                      };
                    }
                    
                    if (typeof GM_deleteValue === 'undefined') {
                      window.GM_deleteValue = function(key) {
                        localStorage.removeItem('GM_' + key);
                      };
                    }
                    
                    if (typeof GM_listValues === 'undefined') {
                      window.GM_listValues = function() {
                        const keys = [];
                        for (let i = 0; i < localStorage.length; i++) {
                          const key = localStorage.key(i);
                          if (key && key.startsWith('GM_')) {
                            keys.push(key.substring(3));
                          }
                        }
                        return keys;
                      };
                    }

                    if (typeof GM_addStyle === 'undefined') {
                      window.GM_addStyle = function(css) {
                        const style = document.createElement('style');
                        style.textContent = css || '';
                        (document.head || document.documentElement || document.body).appendChild(style);
                        return style;
                      };
                    }
                    
                    if (typeof GM_xmlhttpRequest === 'undefined') {
                      window.GM_xmlhttpRequest = function(details) {
                        const xhr = new XMLHttpRequest();
                        xhr.open(details.method || 'GET', details.url, true);
                        
                        if (details.headers) {
                          for (let key in details.headers) {
                            xhr.setRequestHeader(key, details.headers[key]);
                          }
                        }
                        
                        xhr.onload = function() {
                          if (details.onload) {
                            details.onload({
                              status: xhr.status,
                              statusText: xhr.statusText,
                              responseText: xhr.responseText,
                              response: xhr.response,
                              responseHeaders: xhr.getAllResponseHeaders(),
                              finalUrl: xhr.responseURL
                            });
                          }
                        };
                        
                        xhr.onerror = function() {
                          if (details.onerror) details.onerror({ status: 0, responseText: '', error: xhr });
                        };

                        xhr.ontimeout = function() {
                          if (details.ontimeout) details.ontimeout({ status: 0, responseText: '' });
                        };

                        if (details.responseType) xhr.responseType = details.responseType;
                        if (details.timeout) xhr.timeout = details.timeout;
                        
                        xhr.send(details.data || null);
                        return { abort: function() { xhr.abort(); } };
                      };
                    }
                    
                    if (typeof GM_info === 'undefined') {
                      window.GM_info = { scriptHandler: 'Electron', version: '1.0' };
                    }

                    if (typeof GM_log === 'undefined') {
                      window.GM_log = function() {
                        console.log.apply(console, ['[GM]'].concat(Array.prototype.slice.call(arguments)));
                      };
                    }

                    if (typeof GM_openInTab === 'undefined') {
                      window.GM_openInTab = function(url) {
                        window.open(url);
                        return { close: function() {}, closed: false };
                      };
                    }

                    if (typeof GM_setClipboard === 'undefined') {
                      window.GM_setClipboard = function(text) {
                        try {
                          if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(String(text || ''));
                          }
                        } catch (e) {}
                      };
                    }

                    if (typeof GM_notification === 'undefined') {
                      window.GM_notification = function(details, ondone) {
                        const text = typeof details === 'string' ? details : (details && (details.text || details.title)) || '';
                        console.log('[GM_notification]', text);
                        if (typeof ondone === 'function') setTimeout(ondone, 0);
                      };
                    }

                    if (typeof GM === 'undefined') {
                      window.GM = {};
                    }
                    window.GM.getValue = window.GM.getValue || function(key, defaultValue) {
                      return Promise.resolve(window.GM_getValue(key, defaultValue));
                    };
                    window.GM.setValue = window.GM.setValue || function(key, value) {
                      window.GM_setValue(key, value);
                      return Promise.resolve();
                    };
                    window.GM.deleteValue = window.GM.deleteValue || function(key) {
                      window.GM_deleteValue(key);
                      return Promise.resolve();
                    };
                    window.GM.listValues = window.GM.listValues || function() {
                      return Promise.resolve(window.GM_listValues());
                    };
                    window.GM.addStyle = window.GM.addStyle || window.GM_addStyle;
                    window.GM.xmlHttpRequest = window.GM.xmlHttpRequest || window.GM_xmlhttpRequest;
                    window.GM.openInTab = window.GM.openInTab || window.GM_openInTab;
                    window.GM.setClipboard = window.GM.setClipboard || function(text) {
                      window.GM_setClipboard(text);
                      return Promise.resolve();
                    };
                    window.GM.notification = window.GM.notification || window.GM_notification;
                    
                    console.log('[扩展脚本] ✓ 油猴兼容层已加载');
                    
                    // ==================== 执行扩展脚本 ====================
                    ${extensionScript}
                    console.log('[扩展脚本] ✓ 扩展脚本执行完成: ${fileName}');
                  } catch(e) {
                    console.error('[扩展脚本] 扩展脚本执行失败 (${fileName}):', e);
                  }
                })();
              `).catch(err => {
                console.error(`[扩展脚本] 注入失败 (${fileName}):`, err);
              });
            } catch (err) {
              console.error(`[扩展脚本] 读取扩展脚本失败 (${fileName}):`, err);
            }
          });
        } else {
          console.log(`[扩展脚本] 未找到 .js 或 .txt 扩展脚本文件`);
        }
      } catch (err) {
        console.error(`[扩展脚本] 读取目录失败:`, err);
      }
    }
    // ==================== 注入游戏修改器 ====================
    // 延迟注入，等待游戏引擎加载
    setTimeout(() => {
      // 检查窗口是否已被销毁
      if (mainWindow.isDestroyed()) {
        console.log('[修改器] 窗口已销毁，跳过注入');
        return;
      }
      
      console.log('[修改器] 开始注入游戏修改器');
      // 重新获取当前窗口的 binFileName，确保正确传递
      const injectedBinFileName = mainWindow.binFileName || '';
      console.log('[修改器] BIN文件名:', injectedBinFileName);
      mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            console.log('[修改器] 开始执行游戏修改器脚本');
            
            // ==================== localStorage 扩展 ====================
            const recordItems = {};
            for (var key in recordItems) {
              localStorage.setItem(key, recordItems[key]);
            }
            
            const oldSetItem = localStorage.setItem;
            localStorage.setItem = function (key, value) {
              oldSetItem.call(this, key, value);
              if (window.electron && window.electron.ipcRenderer) {
                window.electron.ipcRenderer.send("setItemEx", key, value);
              }
            };
            
            const oldRemoveItem = localStorage.removeItem;
            localStorage.removeItem = function (key) {
              oldRemoveItem.call(this, key);
              if (window.electron && window.electron.ipcRenderer) {
                window.electron.ipcRenderer.send("removeItemEx", key);
              }
            };

            // ==================== 游戏引擎修改（需要等待加载） ====================
            
            // 初始化全局变量（默认100倍）
            if (window.__nightmareSpeed === undefined) {
              window.__nightmareSpeed = 100;
              window.__nightmareHooked = false;
              console.log('[修改器] 初始化, 十殿加速:', window.__nightmareSpeed + 'x');
            }
            
            // Hook十殿面板函数（参考APK项目逻辑）
            function hookNightmarePanel() {
              if (window.__nightmareHooked) return true;
              try {
                const NightmareBattlePanel = window.__require('NightmareBattlePanel').NightmareBattlePanel;
                if (NightmareBattlePanel && NightmareBattlePanel.prototype && NightmareBattlePanel.prototype.onShow) {
                  if (!NightmareBattlePanel.prototype.onShow.__isPatched) {
                    const orig = NightmareBattlePanel.prototype.onShow;
                    NightmareBattlePanel.prototype.onShow = function(...args) {
                      orig.apply(this, args);
                      // 保存原始值
                      if (this._originalDefaultTimescale === undefined) {
                        this._originalDefaultTimescale = this.DEFAULT_TIMESCALE;
                      }
                      // 应用加速
                      const speed = window.__nightmareSpeed || 100;
                      this.DEFAULT_TIMESCALE = speed;
                      console.log('[修改器] ✓ 十殿加速应用:', speed + 'x');
                    };
                    NightmareBattlePanel.prototype.onShow.__isPatched = true;
                  }
                  window.__nightmareHooked = true;
                  console.log('[修改器] ✓ 十殿加速Hook成功');
                  return true;
                }
              } catch(e) {}
              return false;
            }
            
            function applyGameMods() {
              console.log('[修改器] 尝试应用游戏修改');
              
              // 检查必要的对象是否存在
              if (!window.__require) {
                console.log('[修改器] window.__require 不存在');
                return false;
              }
              
              if (!window.cc) {
                console.log('[修改器] window.cc 不存在');
                return false;
              }
              
              // 尝试Hook十殿面板（需要__require就绪）
              if (!window.__nightmareHooked) {
                hookNightmarePanel();
              }
              
              // 返回是否所有Hook都成功
              return window.__nightmareHooked;

              // PlatformManager 修改
              try {
                const PlatformManager = window.__require("PlatformManager").PlatformManager;
                const oldExitGame = PlatformManager.instance.exitGame;
                if (!oldExitGame.isSelfCreate) {
                  PlatformManager.instance.exitGame = function () {
                    const floatText = document.createElement('div');
                    floatText.textContent = '禁止退出游戏！3分钟后自动刷新重连...';
                    floatText.style.cssText = \`
                      position: fixed;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      color: red;
                      background-color: white;
                      padding: 12px 24px;
                      border-radius: 8px;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                      font-size: 30px;
                      font-weight: bold;
                      z-index: 10000;
                    \`;
                    document.body.appendChild(floatText);
                    if (window.cc) {
                      cc.director.pause();
                    }
                    
                    // 3分钟后自动刷新
                    setTimeout(() => {
                      console.log('[修改器] 3分钟已到，刷新窗口...');
                      location.reload();
                    }, 3 * 60 * 1000); // 3分钟 = 180秒 = 180000毫秒
                  };
                  PlatformManager.instance.exitGame.isSelfCreate = true;
                  console.log('[修改器] ✓ 已修改 PlatformManager');
                }
              } catch(e) {
                console.error('[修改器] PlatformManager修改失败:', e);
              }

              console.log('[修改器] 游戏修改应用完成！');
              return true;
            }

            // 轮询等待游戏模块加载（参考APK项目的做法，持续轮询直到成功）
            let pollCount = 0;
            const maxPoll = 300; // 最多轮询300次，约60秒
            
            const pollInterval = setInterval(() => {
              pollCount++;
              
              // 检查cc引擎是否就绪
              const ccReady = typeof cc !== 'undefined' && cc.director && cc.director.getScheduler;
              const requireReady = typeof window.__require === 'function';
              
              // 尝试Hook十殿（需要__require就绪）
              if (requireReady && !window.__nightmareHooked) {
                hookNightmarePanel();
              }
              
              // 所有Hook都成功或超时才停止
              if (window.__nightmareHooked || pollCount >= maxPoll) {
                clearInterval(pollInterval);
                console.log('[修改器] 轮询结束, 十殿Hook:', window.__nightmareHooked, '轮询次数:', pollCount);
              }
            }, 200);

          } catch(e) {
            console.error('[修改器] 初始化失败:', e);
          }
        })();
      `).catch(err => {
        console.error('脚本注入失败:', err);
      });
    }, 5000); // 延迟5秒，给游戏更多时间加载

  });

  // 默认不打开开发者工具（可以通过快捷键 Ctrl+Shift+I 打开）
  // mainWindow.webContents.openDevTools();

  // 注册快捷键 F5 刷新窗口 和 F12 打开开发者工具
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' && input.type === 'keyDown') {
      console.log(`[窗口${index}] 检测到 F5 按键，刷新窗口`);
      mainWindow.reload();
      event.preventDefault();
    }
    if (input.key === 'F12' && input.type === 'keyDown') {
      console.log(`[窗口${index}] 检测到 F12 按键，切换开发者工具`);
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
      event.preventDefault();
    }
  });

  // ==================== 渲染进程崩溃保护 ====================
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`[窗口${index}] 渲染进程崩溃:`, details);
    console.log(`[窗口${index}] 3秒后自动重新加载...`);
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    }, 3000);
  });

  // 渲染进程无响应处理
  let unresponsiveTimer = null;
  mainWindow.webContents.on('unresponsive', () => {
    console.warn(`[窗口${index}] 渲染进程无响应，等待恢复...`);
    // 如果30秒后仍未恢复，强制重新加载
    unresponsiveTimer = setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        console.error(`[窗口${index}] 渲染进程长时间无响应，强制重新加载`);
        mainWindow.reload();
      }
    }, 3000); // 3秒超时
  });

  // 渲染进程恢复响应
  mainWindow.webContents.on('responsive', () => {
    console.log(`[窗口${index}] 渲染进程已恢复响应`);
    // 清除超时定时器
    if (unresponsiveTimer) {
      clearTimeout(unresponsiveTimer);
      unresponsiveTimer = null;
    }
  });

  // 页面加载失败处理
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[窗口${index}] 页面加载失败: ${errorCode} - ${errorDescription}`);
    if (errorCode !== -3) { // -3 是用户主动取消，不需要重新加载
      console.log(`[窗口${index}] 5秒后重试加载...`);
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }, 5000);
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  // 窗口关闭时的处理
  mainWindow.on('closed', () => {
    console.log(`[窗口${index}] 正在关闭`);
    // 清理定时器
    if (unresponsiveTimer) {
      clearTimeout(unresponsiveTimer);
      unresponsiveTimer = null;
    }
  });

  return mainWindow;
}

// ==================== IPC 处理 ====================
ipcMain.on("setItemEx", (event, key, value) => {
  console.log(`localStorage.setItem: ${key} = ${value}`);
});

ipcMain.on("removeItemEx", (event, key) => {
  console.log(`localStorage.removeItem: ${key}`);
});

// ==================== 缓存管理 IPC ====================
ipcMain.handle("cache:getStats", async () => {
  try {
    const size = resourceCache.getCacheSize();
    return {
      success: true,
      size: size,
      sizeMB: (size / (1024 * 1024)).toFixed(2),
      cacheDir: resourceCache.cacheDir
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("cache:checkUrl", async (event, url) => {
  try {
    const cachedFile = resourceCache.checkCache(url);
    return {
      success: true,
      isCached: !!cachedFile,
      cachedFile: cachedFile,
      isCdnResource: resourceCache.isCdnResource(url)
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});



// ==================== 应用启动 ====================
app.whenReady().then(async () => {
  try {
    console.log(`[应用] Electron 应用已准备就绪`);
    console.log(`[应用] 进程参数: ${JSON.stringify(process.argv)}`);
    console.log(`[应用] 工作目录: ${process.cwd()}`);
    console.log(`[应用] 资源路径: ${process.resourcesPath}`);
    console.log(`[应用] 不启动内置服务器，使用本地静态文件`);

    // 检查是否通过命令行参数传递了bin文件
    const commandLineArgs = process.argv.slice(2);
    console.log(`[应用] 命令行参数: ${JSON.stringify(commandLineArgs)}`);

    let binFiles = [];

    // 过滤出 .bin 文件
    if (commandLineArgs.length > 0) {
      binFiles = commandLineArgs.filter(arg =>
        arg.toLowerCase().endsWith('.bin') && fs.existsSync(arg)
      );
      console.log(`[应用] 从命令行参数找到的 BIN 文件: ${JSON.stringify(binFiles)}`);
    }

    // 如果没有通过命令行参数传递bin文件，则显示文件选择对话框
    if (binFiles.length === 0) {
      console.log(`[应用] 显示文件选择对话框`);
      // 多窗口选择逻辑
      const tempWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const result = await dialog.showOpenDialog(tempWin, {
        title: "选择游戏 BIN 文件",
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "BIN 文件", extensions: ["bin", "BIN"] }],
      });
      tempWin.close();

      binFiles = result.canceled ? [] : result.filePaths;
      console.log(`[应用] 用户选择的 BIN 文件: ${JSON.stringify(binFiles)}`);
    }

    if (binFiles.length > 0) {
      // 为每个 bin 文件创建一个窗口，但都使用同一个端口
      console.log(`[应用] 为 ${binFiles.length} 个 BIN 文件创建窗口`);
      for (let i = 0; i < binFiles.length; i++) {
        const binPath = binFiles[i];
        createWindow(binPath, i, binFiles.length); // pass total count
      }
    } else {
      // 没有选择 bin 文件，直接关闭应用
      console.log(`[应用] 用户取消选择 BIN 文件，关闭应用`);
      app.quit();
    }
  } catch (error) {
    console.error("[应用启动] 启动失败:", error);
    // 显示错误对话框
    dialog.showErrorBox('应用启动失败', `启动时发生错误: ${error.message}`);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  console.log("[应用] 所有窗口已关闭");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(null, 0, 1);
  }
});
