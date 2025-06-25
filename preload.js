const { contextBridge, ipcRenderer } = require('electron');

// Create a minimal path utility object instead of requiring the full path module
const pathUtils = {
    join: function(...segments) {
        return segments.join('/').replace(/\/+/g, '/').replace(/\\/g, '/');
    },
    basename: function(filepath, ext) {
        if (!filepath) return '';
        const name = filepath.split(/[\\/]/).pop() || '';
        if (ext && name.endsWith(ext)) {
            return name.slice(0, -ext.length);
        }
        return name;
    },
    extname: function(filepath) {
        if (!filepath) return '';
        const name = filepath.split(/[\\/]/).pop() || '';
        const lastDot = name.lastIndexOf('.');
        return lastDot === -1 ? '' : name.slice(lastDot);
    },
    dirname: function(filepath) {
        if (!filepath) return '';
        const parts = filepath.split(/[\\/]/);
        parts.pop();
        return parts.join('/') || '/';
    },
    resolve: function(...segments) {
        return pathUtils.join(...segments);
    },
    relative: function(from, to) {
        // Simplified relative path calculation
        return to; // For now, just return the target path
    }
};

console.log('Preload script starting...');

try {
    // Expose protected methods that allow the renderer process to use
    // the ipcRenderer without exposing the entire object
    contextBridge.exposeInMainWorld('electronAPI', {
        // IPC Communication
        ipcRenderer: {
            invoke: function(channel, ...args) {
                console.log('IPC invoke: ' + channel, args);
                return ipcRenderer.invoke(channel, ...args);
            },
            on: function(channel, callback) {
                const subscription = function(event, ...args) { 
                    callback(...args); 
                };
                ipcRenderer.on(channel, subscription);
                return function() { 
                    ipcRenderer.removeListener(channel, subscription); 
                };
            },
            removeAllListeners: function(channel) { 
                return ipcRenderer.removeAllListeners(channel); 
            },
            send: function(channel, ...args) {
                console.log('IPC send: ' + channel, args);
                ipcRenderer.send(channel, ...args);
            }
        },
        
        // Path utilities
        path: pathUtils,
        
        // Platform info
        platform: process.platform,
        
        // Environment
        env: {
            NODE_ENV: process.env.NODE_ENV
        }
    });

    console.log('electronAPI exposed successfully');

    // Expose secure file system operations
    contextBridge.exposeInMainWorld('fs', {
        readFile: async function(filePath, options) {
            try {
                console.log('FS readFile: ' + filePath);
                return await ipcRenderer.invoke('fs-readFile', filePath, options);
            } catch (error) {
                console.error('File read failed: ' + error.message);
                throw new Error('File read failed: ' + error.message);
            }
        },
        
        writeFile: async function(filePath, data, options) {
            try {
                console.log('FS writeFile: ' + filePath);
                return await ipcRenderer.invoke('fs-writeFile', filePath, data, options);
            } catch (error) {
                console.error('File write failed: ' + error.message);
                throw new Error('File write failed: ' + error.message);
            }
        },
        
        exists: async function(filePath) {
            try {
                return await ipcRenderer.invoke('fs-exists', filePath);
            } catch (error) {
                console.error('File exists check failed: ' + error.message);
                return false;
            }
        },
        
        stat: async function(filePath) {
            try {
                return await ipcRenderer.invoke('fs-stat', filePath);
            } catch (error) {
                console.error('File stat failed: ' + error.message);
                throw new Error('Stat failed: ' + error.message);
            }
        }
    });

    console.log('fs API exposed successfully');

    // Expose app-specific APIs
    contextBridge.exposeInMainWorld('qlabAPI', {
        // Show management
        saveShow: function(showData) {
            console.log('Save show requested');
            return ipcRenderer.invoke('save-show-dialog', showData);
        },
        loadShow: function(filePath) {
            console.log('Load show requested: ' + filePath);
            return ipcRenderer.invoke('load-show-file', filePath);
        },
        
        // File selection
        selectAudioFile: function() {
            console.log('Select audio file requested');
            return ipcRenderer.invoke('select-audio-file');
        },
        selectVideoFile: function() {
            console.log('Select video file requested');
            return ipcRenderer.invoke('select-video-file');
        },
        
        // Display management
        getDisplays: function() {
            console.log('Get displays requested');
            return ipcRenderer.invoke('get-displays');
        },
        createDisplayWindow: function(config) {
            console.log('Create display window requested', config);
            return ipcRenderer.invoke('create-display-window', config);
        },
        closeDisplayWindow: function(windowId) {
            console.log('Close display window requested: ' + windowId);
            return ipcRenderer.invoke('close-display-window', windowId);
        },
        sendToDisplay: function(data) {
            console.log('Send to display requested', data);
            return ipcRenderer.invoke('send-to-display', data);
        },
        
        // Menu events
        onMenuEvent: function(callback) {
            const channels = [
                'menu-new-show',
                'menu-open-show', 
                'menu-save-show',
                'menu-save-show-as',
                'menu-add-cue',
                'menu-delete-cue',
                'menu-copy-cue',
                'menu-cut-cue',
                'menu-paste-cue',
                'menu-duplicate-cue',
                'menu-select-all',
                'menu-go',
                'menu-stop',
                'menu-pause',
                'menu-emergency-stop',
                'menu-show-settings'
            ];
            
            const unsubscribers = channels.map(function(channel) {
                const handler = function(event, ...args) {
                    console.log('Menu event: ' + channel, args);
                    callback(channel, ...args);
                };
                ipcRenderer.on(channel, handler);
                return function() { 
                    ipcRenderer.removeListener(channel, handler); 
                };
            });
            
            // Return cleanup function
            return function() { 
                unsubscribers.forEach(function(unsub) { 
                    unsub(); 
                }); 
            };
        }
    });

    console.log('qlabAPI exposed successfully');

    // Development helpers
    if (process.env.NODE_ENV === 'development') {
        contextBridge.exposeInMainWorld('debug', {
            log: function(...args) { 
                console.log('[Renderer]', ...args); 
            },
            warn: function(...args) { 
                console.warn('[Renderer]', ...args); 
            },
            error: function(...args) { 
                console.error('[Renderer]', ...args); 
            },
            
            // Check if APIs are properly exposed
            checkAPIs: function() {
                const apis = ['electronAPI', 'fs', 'qlabAPI'];
                const results = {};
                apis.forEach(function(api) {
                    results[api] = typeof window[api] !== 'undefined';
                });
                console.log('API Check Results:', results);
                return results;
            },
            
            // Test API calls
            testAPIs: async function() {
                console.log('Testing API calls...');
                
                try {
                    // Test file selection
                    console.log('Testing selectAudioFile...');
                    // Don't actually call it, just check if it exists
                    console.log('selectAudioFile available:', typeof window.qlabAPI.selectAudioFile === 'function');
                    
                    // Test display detection
                    console.log('Testing getDisplays...');
                    const displays = await window.qlabAPI.getDisplays();
                    console.log('Displays detected:', displays);
                    
                } catch (error) {
                    console.error('API test failed:', error);
                }
            }
        });

        console.log('Debug helpers exposed');
    }

    console.log('Preload script loaded successfully - all APIs exposed');

} catch (error) {
    console.error('Error in preload script:', error);
    
    // Try to expose at least a basic error API
    try {
        contextBridge.exposeInMainWorld('preloadError', {
            error: error.message,
            stack: error.stack
        });
    } catch (bridgeError) {
        console.error('Failed to expose error info:', bridgeError);
    }
}