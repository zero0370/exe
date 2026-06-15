const { contextBridge, ipcRenderer } = require('electron');

// 暴露缓存管理API到渲染进程
contextBridge.exposeInMainWorld('cacheAPI', {
  // 获取缓存统计信息
  getStats: async () => {
    return await ipcRenderer.invoke('cache:getStats');
  },
  
  // 检查URL是否已缓存
  checkUrl: async (url) => {
    return await ipcRenderer.invoke('cache:checkUrl', url);
  }
});
