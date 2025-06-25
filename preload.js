const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // IPC Communication
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, callback) => {
            const subscription = (event, ...args) => callback(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        },
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
        send: (channel, ...args) => ipcRenderer.send(channel, ...args)
    },
    
    // Path utilities
    path: {
        join: (...args) => path.join(...args),
        basename: (p, ext) => path.basename(p, ext),
        extname: (p) => path.extname(p),
        dirname: (p) => path.dirname(p),
        resolve: (...args) => path.resolve(...args),
        relative: (from, to) => path.relative(from, to)
    },
    
    // Platform info
    platform: process.platform,
    
    // Environment
    env: {
        NODE_ENV: process.env.NODE_ENV
    }
});

// Expose secure file system operations
contextBridge.exposeInMainWorld('fs', {
    readFile: async (filePath, options) => {
        try {
            return await ipcRenderer.invoke('fs-readFile', filePath, options);
        } catch (error) {
            throw new Error(`File read failed: ${error.message}`);
        }
    },
    
    writeFile: async (filePath, data, options) => {
        try {
            return await ipcRenderer.invoke('fs-writeFile', filePath, data, options);
        } catch (error) {
            throw new Error(`File write failed: ${error.message}`);
        }
    },
    
    exists: async (filePath) => {
        try {
            return await ipcRenderer.invoke('fs-exists', filePath);
        } catch (error) {
            return false;
        }
    },
    
    stat: async (filePath) => {
        try {
            return await ipcRenderer.invoke('fs-stat', filePath);
        } catch (error) {
            throw new Error(`Stat failed: ${error.message}`);
        }
    }
});

// Expose app-specific APIs
contextBridge.exposeInMainWorld('qlabAPI', {
    // Show management
    saveShow: (showData) => ipcRenderer.invoke('save-show-dialog', showData),
    loadShow: (filePath) => ipcRenderer.invoke('load-show-file', filePath),
    
    // File selection
    selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
    selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
    
    // Display management
    getDisplays: () => ipcRenderer.invoke('get-displays'),
    createDisplayWindow: (config) => ipcRenderer.invoke('create-display-window', config),
    closeDisplayWindow: (windowId) => ipcRenderer.invoke('close-display-window', windowId),
    sendToDisplay: (data) => ipcRenderer.invoke('send-to-display', data),
    
    // Menu events
    onMenuEvent: (callback) => {
        const channels = [
            'menu-new-show',
            'menu-open-show', 
            'menu-save-show',
            'menu-add-cue',
            'menu-delete-cue',
            'menu-go',
            'menu-stop',
            'menu-pause'
        ];
        
        const unsubscribers = channels.map(channel => {
            const handler = (event, ...args) => callback(channel, ...args);
            ipcRenderer.on(channel, handler);
            return () => ipcRenderer.removeListener(channel, handler);
        });
        
        // Return cleanup function
        return () => unsubscribers.forEach(unsub => unsub());
    }
});

// Development helpers
if (process.env.NODE_ENV === 'development') {
    contextBridge.exposeInMainWorld('debug', {
        log: (...args) => console.log('[Renderer]', ...args),
        warn: (...args) => console.warn('[Renderer]', ...args),
        error: (...args) => console.error('[Renderer]', ...args),
        
        // Check if APIs are properly exposed
        checkAPIs: () => {
            const apis = ['electronAPI', 'fs', 'qlabAPI'];
            const results = {};
            apis.forEach(api => {
                results[api] = typeof window[api] !== 'undefined';
            });
            console.log('API Check Results:', results);
            return results;
        }
    });
}

console.log('Preload script loaded successfully');