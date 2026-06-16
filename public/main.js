window.xxtea = (function () {
  var delta = 0x9e3779b9
  function toUint8Array(v, includeLength) {
    var length = v.length
    var n = length << 2
    if (includeLength) {
      var m = v[length - 1]
      n -= 4
      if (m < n - 3 || m > n) {
        return null
      }
      n = m
    }
    var bytes = new Uint8Array(n)
    for (var i = 0; i < n; ++i) {
      bytes[i] = v[i >> 2] >> ((i & 3) << 3)
    }
    return bytes
  }

  function toUint32Array(bytes, includeLength) {
    var length = bytes.length
    var n = length >> 2
    if ((length & 3) !== 0) {
      ++n
    }
    var v
    if (includeLength) {
      v = new Uint32Array(n + 1)
      v[n] = length
    } else {
      v = new Uint32Array(n)
    }
    for (var i = 0; i < length; ++i) {
      v[i >> 2] |= bytes[i] << ((i & 3) << 3)
    }
    return v
  }

  function mx(sum, y, z, p, e, k) {
    return (((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) ^ ((sum ^ y) + (k[(p & 3) ^ e] ^ z))
  }

  function fixk(k) {
    if (k.length < 16) {
      var key = new Uint8Array(16)
      key.set(k)
      k = key
    }
    return k
  }

  function encryptUint32Array(v, k) {
    var length = v.length
    var n = length - 1
    var y, z, sum, e, p, q
    z = v[n]
    sum = 0
    for (q = Math.floor(6 + 52 / length) | 0; q > 0; --q) {
      sum += delta
      e = (sum >>> 2) & 3
      for (p = 0; p < n; ++p) {
        y = v[p + 1]
        z = v[p] += mx(sum, y, z, p, e, k)
      }
      y = v[0]
      z = v[n] += mx(sum, y, z, p, e, k)
    }
    return v
  }

  function decryptUint32Array(v, k) {
    var length = v.length
    var n = length - 1
    var y, z, sum, e, p, q
    y = v[0]
    q = Math.floor(6 + 52 / length)
    for (sum = q * delta; sum !== 0; sum -= delta) {
      e = (sum >>> 2) & 3
      for (p = n; p > 0; --p) {
        z = v[p - 1]
        y = v[p] -= mx(sum, y, z, p, e, k)
      }
      z = v[n]
      y = v[0] -= mx(sum, y, z, p, e, k)
    }
    return v
  }

  function toBytes(str) {
    var n = str.length
    // A single code unit uses at most 3 bytes.
    // Two code units at most 4.
    var bytes = new Uint8Array(n * 3)
    var length = 0
    for (var i = 0; i < n; i++) {
      var codeUnit = str.charCodeAt(i)
      if (codeUnit < 0x80) {
        bytes[length++] = codeUnit
      } else if (codeUnit < 0x800) {
        bytes[length++] = 0xc0 | (codeUnit >> 6)
        bytes[length++] = 0x80 | (codeUnit & 0x3f)
      } else if (codeUnit < 0xd800 || codeUnit > 0xdfff) {
        bytes[length++] = 0xe0 | (codeUnit >> 12)
        bytes[length++] = 0x80 | ((codeUnit >> 6) & 0x3f)
        bytes[length++] = 0x80 | (codeUnit & 0x3f)
      } else {
        if (i + 1 < n) {
          var nextCodeUnit = str.charCodeAt(i + 1)
          if (codeUnit < 0xdc00 && 0xdc00 <= nextCodeUnit && nextCodeUnit <= 0xdfff) {
            var rune = (((codeUnit & 0x03ff) << 10) | (nextCodeUnit & 0x03ff)) + 0x010000
            bytes[length++] = 0xf0 | (rune >> 18)
            bytes[length++] = 0x80 | ((rune >> 12) & 0x3f)
            bytes[length++] = 0x80 | ((rune >> 6) & 0x3f)
            bytes[length++] = 0x80 | (rune & 0x3f)
            i++
            continue
          }
        }
        throw new Error('Malformed string')
      }
    }
    return bytes.subarray(0, length)
  }

  function toShortString(bytes, n) {
    var charCodes = new Uint16Array(n)
    var i = 0,
      off = 0
    for (var len = bytes.length; i < n && off < len; i++) {
      var unit = bytes[off++]
      switch (unit >> 4) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
          charCodes[i] = unit
          break
        case 12:
        case 13:
          if (off < len) {
            charCodes[i] = ((unit & 0x1f) << 6) | (bytes[off++] & 0x3f)
          } else {
            throw new Error('Unfinished UTF-8 octet sequence')
          }
          break
        case 14:
          if (off + 1 < len) {
            charCodes[i] =
              ((unit & 0x0f) << 12) | ((bytes[off++] & 0x3f) << 6) | (bytes[off++] & 0x3f)
          } else {
            throw new Error('Unfinished UTF-8 octet sequence')
          }
          break
        case 15:
          if (off + 2 < len) {
            var rune =
              (((unit & 0x07) << 18) |
                ((bytes[off++] & 0x3f) << 12) |
                ((bytes[off++] & 0x3f) << 6) |
                (bytes[off++] & 0x3f)) -
              0x10000
            if (0 <= rune && rune <= 0xfffff) {
              charCodes[i++] = ((rune >> 10) & 0x03ff) | 0xd800
              charCodes[i] = (rune & 0x03ff) | 0xdc00
            } else {
              throw new Error('Character outside valid Unicode range: 0x' + rune.toString(16))
            }
          } else {
            throw new Error('Unfinished UTF-8 octet sequence')
          }
          break
        default:
          throw new Error('Bad UTF-8 encoding 0x' + unit.toString(16))
      }
    }
    if (i < n) {
      charCodes = charCodes.subarray(0, i)
    }
    return String.fromCharCode.apply(String, charCodes)
  }

  function toLongString(bytes, n) {
    var buf = []
    var charCodes = new Uint16Array(0x8000)
    var i = 0,
      off = 0
    for (var len = bytes.length; i < n && off < len; i++) {
      var unit = bytes[off++]
      switch (unit >> 4) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
          charCodes[i] = unit
          break
        case 12:
        case 13:
          if (off < len) {
            charCodes[i] = ((unit & 0x1f) << 6) | (bytes[off++] & 0x3f)
          } else {
            throw new Error('Unfinished UTF-8 octet sequence')
          }
          break
        case 14:
          if (off + 1 < len) {
            charCodes[i] =
              ((unit & 0x0f) << 12) | ((bytes[off++] & 0x3f) << 6) | (bytes[off++] & 0x3f)
          } else {
            throw new Error('Unfinished UTF-8 octet sequence')
          }
          break
        case 15:
          if (off + 2 < len) {
            var rune =
              (((unit & 0x07) << 18) |
                ((bytes[off++] & 0x3f) << 12) |
                ((bytes[off++] & 0x3f) << 6) |
                (bytes[off++] & 0x3f)) -
              0x10000
            if (0 <= rune && rune <= 0xfffff) {
              charCodes[i++] = ((rune >> 10) & 0x03ff) | 0xd800
              charCodes[i] = (rune & 0x03ff) | 0xdc00
            } else {
              throw new Error('Character outside valid Unicode range: 0x' + rune.toString(16))
            }
          } else {
            throw new Error('Unfinished UTF-8 octet sequence')
          }
          break
        default:
          throw new Error('Bad UTF-8 encoding 0x' + unit.toString(16))
      }
      if (i >= 0x7fff - 1) {
        var size = i + 1
        buf.push(String.fromCharCode.apply(String, charCodes.subarray(0, size)))
        n -= size
        i = -1
      }
    }
    if (i > 0) {
      buf.push(String.fromCharCode.apply(String, charCodes.subarray(0, i)))
    }
    return buf.join('')
  }

  function toString(bytes) {
    var n = bytes.length
    if (n === 0) return ''
    return n < 0x7fff ? toShortString(bytes, n) : toLongString(bytes, n)
  }

  function encrypt(data, key) {
    if (typeof data === 'string') data = toBytes(data)
    if (typeof key === 'string') key = toBytes(key)
    if (data === undefined || data === null || data.length === 0) {
      return data
    }
    return toUint8Array(
      encryptUint32Array(toUint32Array(data, true), toUint32Array(fixk(key), false)),
      false
    )
  }

  function encryptToString(data, key) {
    if (typeof Buffer.from === 'function') {
      return Buffer.from(encrypt(data, key)).toString('base64')
    } else {
      return new Buffer(encrypt(data, key)).toString('base64')
    }
  }

  function decrypt(data, key) {
    if (typeof data === 'string') {
      if (typeof Buffer.from === 'function') {
        data = Buffer.from(data, 'base64')
      } else {
        data = new Buffer(data, 'base64')
      }
    }
    if (typeof key === 'string') key = toBytes(key)
    if (data === undefined || data === null || data.length === 0) {
      return data
    }
    return toUint8Array(
      decryptUint32Array(toUint32Array(data, false), toUint32Array(fixk(key), false)),
      true
    )
  }

  function decryptToString(data, key) {
    return toString(decrypt(data, key))
  }

  return {
    toBytes,
    toString,
    encrypt,
    encryptToString,
    decrypt,
    decryptToString
  }
})()
window.convertAssets = function (url) {
  if (typeof url != 'string') {
    return url
  }
  if (!url.startsWith('assets/') || url.startsWith('assets/internal')) {
    return url
  }
  let newUrl = 'https://xxz-xyzw-res.hortorgames.com/remote/' + url.slice(7)
  if (url.startsWith('assets/game') || url.startsWith('assets/launcher') || url.startsWith('assets/TEST_REMOTE_MODULE')) {
    if (url.endsWith('.js') || url.endsWith('.jsc')) {
      newUrl += 'c'
    }
  }
  return newUrl
}

window.loadJscAndDecode = async function (url, callback) {
  const jscRes = await fetch(url, { cache: 'force-cache' })
  const jscData = await jscRes.arrayBuffer()
  const uint8Data = new Uint8Array(jscData)
  const jsCodeData = xxtea.decrypt(uint8Data, xxtea.toBytes('0Aed5E79bbEa69f8'))
  const decoder = new TextDecoder();
  let jsCode = decoder.decode(jsCodeData)
  
  // 删除 launcher 中禁用 loadAny 的代码
  jsCode = jsCode.replace(/cc\.assetManager\.loadAny=function\(\)\{\},?/g, '');
  // 删除 game 中禁用 loadBundle 的代码 (isH5 判断)
  jsCode = jsCode.replace(/[a-zA-Z]\.PlatformManager\.instance\.isH5&&\(cc\.assetManager\.loadBundle=function\(\)\{\}\),?/g, '');
  console.log('[loadDecodeJSC] 已删除H5禁用代码');
  
  callback(jsCode)
}

window.boot = async function () {
  const settingsRes = await fetch(
    `https://xxz-xyzw.hortorgames.com/login/manifest?platform=hortor&version=0.1.0-androidh5`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'Accept-Encoding': 'gzip,deflate,br',
        'Content-Type': 'application/json;charset=UTF-8',
        Host: 'xxz-xyzw.hortorgames.com',
        'Content-Length': '0'
      }
    }
  )
  const settingsTxt = await settingsRes.text()
  const settingsObj = JSON.parse(settingsTxt)
  
  const bundleVers = JSON.parse(settingsObj.body.bundleVers)
  Object.assign(window._CCSettings.bundleVers, bundleVers)

  var settings = window._CCSettings
  window._CCSettings = undefined
  var onProgress = null

  var RESOURCES = cc.AssetManager.BuiltinBundleName.RESOURCES
  var INTERNAL = cc.AssetManager.BuiltinBundleName.INTERNAL
  var MAIN = cc.AssetManager.BuiltinBundleName.MAIN
  function setLoadingDisplay() {
    // Loading splash scene
    var splash = document.getElementById('splash')
    var progressBar = splash.querySelector('.progress-bar span')
    onProgress = function (finish, total) {
      var percent = (100 * finish) / total
      if (progressBar) {
        progressBar.style.width = percent.toFixed(2) + '%'
      }
    }
    splash.style.display = 'block'
    progressBar.style.width = '0%'

    cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function () {
      splash.style.display = 'none'
    })
  }

  var onStart = function () {
    cc.view.enableRetina(true)

    cc.assetManager.downloader.maxConcurrency = 10;
    cc.assetManager.downloader.maxRequestsPerFrame = 10;
    cc.view.resizeWithBrowserSize(true)

    if (cc.sys.isBrowser) {
      // setLoadingDisplay();
    }

    if (cc.sys.isMobile) {
      if (settings.orientation === 'landscape') {
        cc.view.setOrientation(cc.macro.ORIENTATION_LANDSCAPE)
      } else if (settings.orientation === 'portrait') {
        cc.view.setOrientation(cc.macro.ORIENTATION_PORTRAIT)
      }
      cc.view.enableAutoFullScreen(
        [
          cc.sys.BROWSER_TYPE_BAIDU,
          cc.sys.BROWSER_TYPE_BAIDU_APP,
          cc.sys.BROWSER_TYPE_WECHAT,
          cc.sys.BROWSER_TYPE_MOBILE_QQ,
          cc.sys.BROWSER_TYPE_MIUI,
          cc.sys.BROWSER_TYPE_HUAWEI,
          cc.sys.BROWSER_TYPE_UC
        ].indexOf(cc.sys.browserType) < 0
      )
    }

    // Limit downloading max concurrent task to 2,
    // more tasks simultaneously may cause performance draw back on some android system / browsers.
    // You can adjust the number based on your own test result, you have to set it before any loading process to take effect.
    if (cc.sys.isBrowser && cc.sys.os === cc.sys.OS_ANDROID) {
      cc.assetManager.downloader.maxConcurrency = 2
      cc.assetManager.downloader.maxRequestsPerFrame = 2
    }

    var launchScene = settings.launchScene
    var bundle = cc.assetManager.bundles.find(function (b) {
      return b.getSceneInfo(launchScene)
    })

    bundle.loadScene(launchScene, null, onProgress, function (err, scene) {
      if (!err) {
        cc.director.runSceneImmediate(scene)
        if (cc.sys.isBrowser) {
          // show canvas
          var canvas = document.getElementById('GameCanvas')
          canvas.style.visibility = ''
          var div = document.getElementById('GameDiv')
          if (div) {
            div.style.backgroundImage = ''
          }
          console.log('Success to load scene: ' + launchScene)
        }
      }
    })
  }

  var option = {
    id: 'GameCanvas',
    debugMode: settings.debug ? cc.debug.DebugMode.INFO : cc.debug.DebugMode.ERROR,
    showFPS: settings.debug,
    frameRate: 30,
    groupList: settings.groupList,
    collisionMatrix: settings.collisionMatrix
  }

  cc.assetManager.init({
    bundleVers: settings.bundleVers,
    remoteBundles: settings.remoteBundles,
    server: settings.server
  })

  var bundleRoot = [INTERNAL]
  settings.hasResourcesBundle && bundleRoot.push(RESOURCES)

  var count = 0
  function cb(err) {
    if (err) return console.error(err.message, err.stack)
    count++
    if (count === bundleRoot.length + 1) {
      cc.assetManager.loadBundle(MAIN, function (err) {
        if (!err) {
          cc.game.run(option, onStart)
        }
      })
    }
  }

  cc.assetManager.loadScript(
    settings.jsList.map(function (x) {
      return 'src/' + x
    }),
    cb
  )

  for (var i = 0; i < bundleRoot.length; i++) {
    cc.assetManager.loadBundle(bundleRoot[i], cb)
  }
}
