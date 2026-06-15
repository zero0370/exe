const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class ResourceCache {
  constructor() {
    // 缓存目录设置为应用安装目录下的 res_cache 文件夹
    // 使用 process.resourcesPath 获取应用安装目录
    const installDir = process.resourcesPath || app.getAppPath();
    this.cacheDir = path.join(installDir, 'res_cache');
    this.ensureCacheDirExists();
    
    // CDN域名配置
    this.cdnDomains = [
      'xxz-xyzw-res.hortorgames.com',
      'comb-platform.hortorgames.com',
      'ucenter-app-server.hortorgames.com',
      'open.weixin.qq.com'
    ];
    
    // 请求去重：记录正在下载的请求
    this.pendingDownloads = new Map();
    
    // console.log(`[ResourceCache] 缓存目录: ${this.cacheDir}`);
  }

  // 确保缓存目录存在
  ensureCacheDirExists() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  // 将URL转换为缓存文件路径
  urlToCachePath(url) {
    try {
      const parsedUrl = new URL(url);
      // 使用域名和路径组成本地缓存路径
      const cachePath = path.join(parsedUrl.hostname, parsedUrl.pathname.substring(1));
      return path.join(this.cacheDir, cachePath);
    } catch (e) {
      console.error('[ResourceCache] URL解析失败:', url, e.message);
      return null;
    }
  }

  // 检查URL是否是CDN资源
  isCdnResource(url) {
    try {
      const parsedUrl = new URL(url);
      return this.cdnDomains.some(domain => parsedUrl.hostname.includes(domain));
    } catch (e) {
      return false;
    }
  }

  // 获取MIME类型
  getMimeType(url) {
    const ext = path.extname(url).toLowerCase();
    const mimeTypes = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.json': 'application/json',
      '.html': 'text/html',
      '.bin': 'application/octet-stream',
      '.mp3': 'audio/mpeg',
      '.ttf': 'font/ttf',
      '.webp': 'image/webp',
      '.plist': 'application/xml',
      '.jsc': 'application/octet-stream'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // 检查缓存是否命中
  checkCache(url) {
    const cacheFile = this.urlToCachePath(url);
    if (!cacheFile) return null;
    
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      if (stats.size > 0) {
        // console.log(`[ResourceCache] 缓存命中: ${url}`);
        
        // 缓存命中后，尝试清理同目录下的无用文件
        this.cleanUnusedFilesInDirectory(cacheFile);
        
        return cacheFile;
      }
    }
    return null;
  }

  // 清理同目录下的无用文件
  cleanUnusedFilesInDirectory(cachedFile) {
    try {
      const dir = path.dirname(cachedFile);
      if (!fs.existsSync(dir)) return;

      // 只处理特定目录层级，避免误删
      const fileName = path.basename(cachedFile);
      const fileExt = path.extname(fileName).toLowerCase();
      
      // 只对.js和.json文件触发清理
      if (fileExt !== '.js' && fileExt !== '.json') return;

      // 获取文件名（不含扩展名和哈希后缀）
      // 例如: config.cbefe.json -> config
      const baseName = fileName.replace(/\.[a-f0-9]+\./, '.').replace(/^config\./, '').replace(/^index\./, '');
      
      const files = fs.readdirSync(dir);
      let cleanedCount = 0;

      files.forEach(file => {
        const filePath = path.join(dir, file);
        const ext = path.extname(file).toLowerCase();
        
        // 只清理.js和.json文件
        if (ext !== '.js' && ext !== '.json') return;
        
        // 跳过当前命中的文件
        if (file === fileName) return;

        // 检查是否是旧版本文件（带有哈希后缀但不是当前文件）
        // 例如: config.abc12.json, config.def34.json 等
        const hashPattern = /^.*\.[a-f0-9]{5,}\.(js|json)$/i;
        if (hashPattern.test(file)) {
          // 提取基础名称进行比较
          const fileBaseName = file.replace(/\.[a-f0-9]+\./, '.');
          const currentBaseName = fileName.replace(/\.[a-f0-9]+\./, '.');
          
          // 如果是同名但不同哈希的文件，说明是旧版本
          if (fileBaseName === currentBaseName) {
            try {
              fs.unlinkSync(filePath);
              cleanedCount++;
              // console.log(`[ResourceCache] 清理旧版本文件: ${file}`);
            } catch (e) {
              console.error(`[ResourceCache] 清理文件失败: ${file}`, e.message);
            }
          }
        }
      });

      if (cleanedCount > 0) {
        // console.log(`[ResourceCache] 已清理 ${cleanedCount} 个旧版本文件`);
      }
    } catch (e) {
      // 静默失败，不影响主要功能
      console.error('[ResourceCache] 清理无用文件失败:', e.message);
    }
  }

  // 下载并缓存资源
  async downloadAndCache(url) {
    return new Promise((resolve, reject) => {
      const cacheFile = this.urlToCachePath(url);
      if (!cacheFile) {
        reject(new Error('无效的URL'));
        return;
      }

      // 确保目录存在
      const dir = path.dirname(cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      // console.log(`[ResourceCache] 下载资源: ${url}`);

      const request = protocol.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (response) => {
        // 处理重定向
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          this.downloadAndCache(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const data = Buffer.concat(chunks);
          
          // 写入缓存文件
          try {
            fs.writeFileSync(cacheFile, data);
            // console.log(`[ResourceCache] 已缓存: ${url} (${data.length} bytes)`);
            resolve({
              data: data,
              mimeType: this.getMimeType(url),
              cachedFile: cacheFile
            });
          } catch (e) {
            console.error('[ResourceCache] 写入缓存失败:', e.message);
            resolve({ data: data, mimeType: this.getMimeType(url) });
          }
        });
      });

      request.on('error', (e) => {
        console.error('[ResourceCache] 下载失败:', url, e.message);
        reject(e);
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('请求超时'));
      });
    });
  }

  // 获取资源（优先缓存，未缓存则下载）
  async getResource(url) {
    // 检查是否是需要缓存的CDN资源
    if (!this.isCdnResource(url)) {
      return null; // 非CDN资源不处理
    }

    // 检查缓存
    const cachedFile = this.checkCache(url);
    if (cachedFile) {
      try {
        const data = fs.readFileSync(cachedFile);
        return {
          data: data,
          mimeType: this.getMimeType(url),
          fromCache: true,
          cachedFile: cachedFile
        };
      } catch (e) {
        console.error('[ResourceCache] 读取缓存失败:', e.message);
      }
    }

    // 缓存未命中，检查是否已有正在进行的下载请求（请求去重）
    if (this.pendingDownloads.has(url)) {
      // console.log(`[ResourceCache] 复用正在下载的请求: ${url}`);
      return await this.pendingDownloads.get(url);
    }

    // 创建新的下载请求并记录
    const downloadPromise = this.downloadAndCache(url)
      .then(result => {
        // 下载完成，从待下载列表中移除
        this.pendingDownloads.delete(url);
        return { ...result, fromCache: false };
      })
      .catch(e => {
        // 下载失败，也从待下载列表中移除
        this.pendingDownloads.delete(url);
        console.error('[ResourceCache] 获取资源失败:', url, e.message);
        return null;
      });
    
    this.pendingDownloads.set(url, downloadPromise);
    return await downloadPromise;
  }

  // 清理缓存（可选功能）
  clearCache() {
    try {
      if (fs.existsSync(this.cacheDir)) {
        fs.rmSync(this.cacheDir, { recursive: true, force: true });
        this.ensureCacheDirExists();
        console.log('[ResourceCache] 缓存已清理');
      }
    } catch (e) {
      console.error('[ResourceCache] 清理缓存失败:', e.message);
    }
  }

  // 获取缓存大小
  getCacheSize() {
    let totalSize = 0;
    const calculateSize = (dir) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          calculateSize(filePath);
        } else {
          totalSize += stats.size;
        }
      });
    };
    calculateSize(this.cacheDir);
    return totalSize;
  }
}

module.exports = new ResourceCache();
