const { app, BrowserWindow, Menu, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
    try {
        require('electron-reload')(__dirname, {
            electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
            hardResetMethod: 'exit'
        });
    } catch (e) {
        console.log('electron-reload not available');
    }
}

app.disableHardwareAcceleration();

// Keep a global reference of the window objects
let mainWindow;
let displayWindows = new Map(); // windowId -> BrowserWindow

function createWindow() {
    console.log('Creating main window...');
    
    // Verify preload script exists
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log(`Checking preload script at: ${preloadPath}`);
    
    if (!fs.existsSync(preloadPath)) {
        console.error(`FATAL: Preload script not found at: ${preloadPath}`);
        console.log('Current directory contents:', fs.readdirSync(__dirname));
        
        dialog.showErrorBox(
            'Preload Script Missing',
            `The preload script is missing at:\n${preloadPath}\n\nPlease ensure preload.js is in the root directory.`
        );
        app.quit();
        return;
    }
    
    console.log('✓ Preload script found');
    
    // Create the browser window with secure settings
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,           // Security: disable node integration
            contextIsolation: true,           // Security: enable context isolation
            enableRemoteModule: false,        // Security: disable remote module
            preload: preloadPath,             // Use verified path
            webSecurity: true,                // Enable web security
            allowRunningInsecureContent: false,
            sandbox: false                    // Keep sandbox disabled for now
        },
        titleBarStyle: 'default',
        show: false, // Don't show until ready
        icon: path.join(__dirname, 'assets', 'icon.png')
    });

    console.log('✓ Browser window created');

    // Load the app
    const htmlPath = path.join(__dirname, 'src', 'index.html');
    console.log(`Loading HTML from: ${htmlPath}`);
    
    if (!fs.existsSync(htmlPath)) {
        console.error(`HTML file not found: ${htmlPath}`);
        dialog.showErrorBox('HTML Missing', `index.html not found at:\n${htmlPath}`);
        app.quit();
        return;
    }
    
    mainWindow.loadFile(htmlPath);

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        console.log('✓ Window ready to show');
        mainWindow.show();
        
        // Test preload script loading
        if (process.env.NODE_ENV === 'development') {
            console.log('Testing preload script APIs...');
            
            setTimeout(() => {
                mainWindow.webContents.executeJavaScript(`
                    console.log('=== PRELOAD SCRIPT TEST ===');
                    console.log('electronAPI available:', typeof window.electronAPI !== 'undefined');
                    console.log('fs available:', typeof window.fs !== 'undefined');
                    console.log('qlabAPI available:', typeof window.qlabAPI !== 'undefined');
                    
                    if (window.debug && window.debug.checkAPIs) {
                        console.log('Running API check...');
                        const result = window.debug.checkAPIs();
                        console.log('API check result:', result);
                        
                        // Test basic functionality
                        if (window.debug.testAPIs) {
                            window.debug.testAPIs();
                        }
                    } else {
                        console.error('Debug helpers not available - preload script failed');
                    }
                    
                    if (window.preloadError) {
                        console.error('Preload error detected:', window.preloadError);
                    }
                    
                    console.log('=== END PRELOAD TEST ===');
                `).catch(err => {
                    console.error('Failed to execute test script:', err);
                });
            }, 1000);
        }
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Handle web contents crashes
    mainWindow.webContents.on('crashed', (event) => {
        console.error('Renderer process crashed:', event);
        dialog.showErrorBox('Renderer Crashed', 'The renderer process has crashed. Restarting...');
        mainWindow.reload();
    });

    // Handle unresponsive window
    mainWindow.on('unresponsive', () => {
        console.warn('Window became unresponsive');
        dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Window Unresponsive',
            message: 'The window has become unresponsive. Would you like to reload it?',
            buttons: ['Reload', 'Wait']
        }).then(result => {
            if (result.response === 0) {
                mainWindow.reload();
            }
        });
    });

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        console.log('Main window closing, cleaning up...');
        
        // Close all display windows when main window closes
        for (const [windowId, displayWindow] of displayWindows) {
            if (!displayWindow.isDestroyed()) {
                displayWindow.close();
            }
        }
        displayWindows.clear();
        mainWindow = null;
    });

    // Set up application menu
    createMenu();
    
    console.log('✓ Main window setup complete');
}

// REPLACE the createMenu function in your main.js with this enhanced version

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Show',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        console.log('Menu: New Show');
                        mainWindow.webContents.send('menu-new-show');
                    }
                },
                {
                    label: 'Open Show...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        console.log('Menu: Open Show');
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: [
                                { name: 'CueForge Shows', extensions: ['crfg'] },
                                { name: 'QLab Shows (Legacy)', extensions: ['qlab'] },
                                { name: 'All Files', extensions: ['*'] }
                            ]
                        });
                        
                        if (!result.canceled) {
                            mainWindow.webContents.send('menu-open-show', result.filePaths[0]);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Save Show',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        console.log('Menu: Save Show');
                        mainWindow.webContents.send('menu-save-show');
                    }
                },
                {
                    label: 'Save Show As...',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        console.log('Menu: Save Show As');
                        mainWindow.webContents.send('menu-save-show-as');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Import Audio File...',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => {
                        console.log('Menu: Import Audio');
                        mainWindow.webContents.send('menu-add-cue', 'audio');
                    }
                },
                {
                    label: 'Import Video File...',
                    accelerator: 'CmdOrCtrl+Alt+I',
                    click: () => {
                        console.log('Menu: Import Video');
                        mainWindow.webContents.send('menu-add-cue', 'video');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Copy Cue',
                    accelerator: 'CmdOrCtrl+C',
                    click: () => {
                        console.log('Menu: Copy Cue');
                        mainWindow.webContents.send('menu-copy-cue');
                    }
                },
                {
                    label: 'Cut Cue',
                    accelerator: 'CmdOrCtrl+X',
                    click: () => {
                        console.log('Menu: Cut Cue');
                        mainWindow.webContents.send('menu-cut-cue');
                    }
                },
                {
                    label: 'Paste Cue',
                    accelerator: 'CmdOrCtrl+V',
                    click: () => {
                        console.log('Menu: Paste Cue');
                        mainWindow.webContents.send('menu-paste-cue');
                    }
                },
                {
                    label: 'Duplicate Cue',
                    accelerator: 'CmdOrCtrl+D',
                    click: () => {
                        console.log('Menu: Duplicate Cue');
                        mainWindow.webContents.send('menu-duplicate-cue');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Delete Cue',
                    accelerator: 'Delete',
                    click: () => {
                        console.log('Menu: Delete Cue');
                        mainWindow.webContents.send('menu-delete-cue');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Select All Cues',
                    accelerator: 'CmdOrCtrl+A',
                    click: () => {
                        console.log('Menu: Select All');
                        mainWindow.webContents.send('menu-select-all');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Add Audio Cue',
                    accelerator: 'CmdOrCtrl+Shift+A',
                    click: () => {
                        console.log('Menu: Add Audio Cue');
                        mainWindow.webContents.send('menu-add-cue', 'audio');
                    }
                },
                {
                    label: 'Add Video Cue',
                    accelerator: 'CmdOrCtrl+Shift+V',
                    click: () => {
                        console.log('Menu: Add Video Cue');
                        mainWindow.webContents.send('menu-add-cue', 'video');
                    }
                },
                {
                    label: 'Add Wait Cue',
                    accelerator: 'CmdOrCtrl+Shift+W',
                    click: () => {
                        console.log('Menu: Add Wait Cue');
                        mainWindow.webContents.send('menu-add-cue', 'wait');
                    }
                },
                {
                    label: 'Add Group Cue',
                    accelerator: 'CmdOrCtrl+Shift+G',
                    click: () => {
                        console.log('Menu: Add Group Cue');
                        mainWindow.webContents.send('menu-add-cue', 'group');
                    }
                }
            ]
        },
        {
            label: 'Show',
            submenu: [
                {
                    label: 'Go',
                    accelerator: 'Space',
                    click: () => {
                        console.log('Menu: Go');
                        mainWindow.webContents.send('menu-go');
                    }
                },
                {
                    label: 'Stop',
                    accelerator: 'CmdOrCtrl+.',
                    click: () => {
                        console.log('Menu: Stop');
                        mainWindow.webContents.send('menu-stop');
                    }
                },
                {
                    label: 'Pause/Resume',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => {
                        console.log('Menu: Pause');
                        mainWindow.webContents.send('menu-pause');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Emergency Stop All',
                    accelerator: 'Escape',
                    click: () => {
                        console.log('Menu: Emergency Stop');
                        mainWindow.webContents.send('menu-emergency-stop');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Show Settings...',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        console.log('Menu: Show Settings');
                        mainWindow.webContents.send('menu-show-settings');
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        mainWindow.reload();
                    }
                },
                {
                    label: 'Force Reload',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => {
                        mainWindow.webContents.reloadIgnoringCache();
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'F12',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 1);
                    }
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 1);
                    }
                },
                {
                    label: 'Reset Zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(0);
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About CueForge',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About CueForge',
                            message: 'CueForge',
                            detail: 'Professional Show Control Software\nVersion 1.0.0\n\nBuilt with Electron and modern web technologies.\n\nCopyright © 2025 Joel Cox'
                        });
                    }
                },
                {
                    label: 'Keyboard Shortcuts',
                    accelerator: 'F1',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Keyboard Shortcuts',
                            message: 'CueForge Keyboard Shortcuts',
                            detail: `Show Control:
Space - Go
Ctrl+. - Stop
Ctrl+P - Pause/Resume
Escape - Emergency Stop All

File Operations:
Ctrl+N - New Show
Ctrl+O - Open Show
Ctrl+S - Save Show
Ctrl+Shift+S - Save Show As

Editing:
Ctrl+C - Copy Cue
Ctrl+X - Cut Cue
Ctrl+V - Paste Cue
Ctrl+D - Duplicate Cue
Delete - Delete Cue

Navigation:
↑/↓ - Select Cue
Enter - Play Selected Cue

Add Cues:
Ctrl+Shift+A - Audio Cue
Ctrl+Shift+V - Video Cue
Ctrl+Shift+W - Wait Cue
Ctrl+Shift+G - Group Cue`
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Secure File System IPC handlers
ipcMain.handle('fs-readFile', async (event, filePath, options) => {
    try {
        console.log(`IPC: Reading file: ${filePath}`);
        
        // Security: Validate file path (basic check)
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path');
        }
        
        // Read file with error handling
        const data = await fs.readFile(filePath, options);
        console.log(`✓ File read successfully: ${filePath}`);
        return data;
    } catch (error) {
        console.error('File read error:', error.message);
        throw new Error(`Failed to read file: ${error.message}`);
    }
});

ipcMain.handle('fs-writeFile', async (event, filePath, data, options) => {
    try {
        console.log(`IPC: Writing file: ${filePath}`);
        
        // Security: Validate inputs
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path');
        }
        
        await fs.writeFile(filePath, data, options);
        console.log(`✓ File written successfully: ${filePath}`);
        return { success: true };
    } catch (error) {
        console.error('File write error:', error.message);
        throw new Error(`Failed to write file: ${error.message}`);
    }
});

ipcMain.handle('fs-exists', async (event, filePath) => {
    try {
        const exists = await fs.pathExists(filePath);
        console.log(`File exists check: ${filePath} = ${exists}`);
        return exists;
    } catch (error) {
        console.error('File exists check error:', error.message);
        return false;
    }
});

ipcMain.handle('fs-stat', async (event, filePath) => {
    try {
        const stats = await fs.stat(filePath);
        console.log(`File stat: ${filePath}`);
        return stats;
    } catch (error) {
        console.error('File stat error:', error.message);
        throw new Error(`Failed to stat file: ${error.message}`);
    }
});

// IPC handlers for show operations
ipcMain.handle('save-show-dialog', async (event, showData) => {
    try {
        console.log('IPC: Save show dialog requested');
        const result = await dialog.showSaveDialog(mainWindow, {
            filters: [
                { name: 'CueForge Shows', extensions: ['crfg'] },
                { name: 'QLab Shows (Legacy)', extensions: ['qlab']},
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled) {
            await fs.writeJson(result.filePath, showData, { spaces: 2 });
            console.log(`✓ Show saved: ${result.filePath}`);
            return { success: true, filePath: result.filePath };
        }
        
        return { success: false, cancelled: true };
    } catch (error) {
        console.error('Save show error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-show-file', async (event, filePath) => {
    try {
        console.log(`IPC: Loading show file: ${filePath}`);
        const showData = await fs.readJson(filePath);
        console.log(`✓ Show loaded: ${filePath}`);
        return { success: true, data: showData };
    } catch (error) {
        console.error('Load show error:', error);
        return { success: false, error: error.message };
    }
});

// REPLACE the file dialog handlers in your main.js with these enhanced versions

ipcMain.handle('select-audio-file', async () => {
    try {
        console.log('IPC: Select audio file dialog requested');
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { 
                    name: 'Audio Files', 
                    extensions: [
                        'mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma', 
                        'aiff', 'au', 'mp4', 'webm', 'opus'
                    ] 
                },
                { name: 'MP3 Audio', extensions: ['mp3'] },
                { name: 'WAV Audio', extensions: ['wav'] },
                { name: 'AAC/M4A Audio', extensions: ['aac', 'm4a'] },
                { name: 'FLAC Audio', extensions: ['flac'] },
                { name: 'OGG Audio', extensions: ['ogg', 'opus'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled) {
            const filePath = result.filePaths[0];
            console.log(`✓ Audio file selected: ${filePath}`);
            
            // Verify file exists and is readable
            try {
                const exists = await fs.pathExists(filePath);
                if (!exists) {
                    throw new Error('File does not exist');
                }
                return { success: true, filePath: filePath };
            } catch (accessError) {
                console.error('Selected file is not readable:', accessError);
                return { success: false, error: 'File is not readable' };
            }
        }
        
        console.log('Audio file selection cancelled');
        return { success: false };
    } catch (error) {
        console.error('Select audio file error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-video-file', async () => {
    try {
        console.log('IPC: Select video file dialog requested');
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { 
                    name: 'Video Files', 
                    extensions: [
                        'mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm', 'flv', 'm4v',
                        'ogv', 'qt', '3gp', 'asf', 'rm', 'rmvb'
                    ] 
                },
                { name: 'MP4 Video', extensions: ['mp4', 'm4v'] },
                { name: 'QuickTime Video', extensions: ['mov', 'qt'] },
                { name: 'AVI Video', extensions: ['avi'] },
                { name: 'WebM Video', extensions: ['webm'] },
                { name: 'Windows Media', extensions: ['wmv', 'asf'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled) {
            const filePath = result.filePaths[0];
            console.log(`✓ Video file selected: ${filePath}`);
            
            // Verify file exists and is readable
            try {
                const exists = await fs.pathExists(filePath);
                if (!exists) {
                    throw new Error('File does not exist');
                }
                return { success: true, filePath: filePath };
            } catch (accessError) {
                console.error('Selected file is not readable:', accessError);
                return { success: false, error: 'File is not readable' };
            }
        }
        
        console.log('Video file selection cancelled');
        return { success: false };
    } catch (error) {
        console.error('Select video file error:', error);
        return { success: false, error: error.message };
    }
});

// Display Management IPC Handlers
ipcMain.handle('get-displays', async () => {
    try {
        const displays = screen.getAllDisplays();
        console.log(`Found ${displays.length} displays`);
        
        const displayInfo = displays.map((display, index) => ({
            id: display.id,
            name: display.label || `Display ${index + 1}`,
            label: display.label || `Display ${index + 1}`,
            bounds: display.bounds,
            workArea: display.workArea,
            scaleFactor: display.scaleFactor,
            rotation: display.rotation,
            primary: display === screen.getPrimaryDisplay(),
            internal: display.internal || false,
            resolution: `${display.bounds.width}x${display.bounds.height}`
        }));
        
        console.log('Display info:', displayInfo);
        return displayInfo;
    } catch (error) {
        console.error('Failed to get displays:', error);
        return [];
    }
});

ipcMain.handle('create-display-window', async (event, config) => {
    try {
        const windowId = `display-${Date.now()}`;
        
        console.log(`Creating display window for: ${config.displayName}`);
        
        const displayWindow = new BrowserWindow({
            width: config.bounds.width,
            height: config.bounds.height,
            x: config.bounds.x,
            y: config.bounds.y,
            fullscreen: true,
            frame: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js')
            },
            show: false,
            backgroundColor: '#000000'
        });
        
        // Load display content page
        const displayHtmlPath = path.join(__dirname, 'src', 'display.html');
        await displayWindow.loadFile(displayHtmlPath);
        
        // Show the window
        displayWindow.show();
        displayWindow.focus();
        
        // Store reference
        displayWindows.set(windowId, displayWindow);
        
        // Handle window close
        displayWindow.on('closed', () => {
            displayWindows.delete(windowId);
            console.log(`Display window closed: ${windowId}`);
        });
        
        console.log(`✓ Created display window: ${windowId} for ${config.displayName}`);
        return windowId;
    } catch (error) {
        console.error('Failed to create display window:', error);
        throw error;
    }
});

ipcMain.handle('close-display-window', async (event, windowId) => {
    try {
        const displayWindow = displayWindows.get(windowId);
        if (displayWindow && !displayWindow.isDestroyed()) {
            displayWindow.close();
        }
        displayWindows.delete(windowId);
        
        console.log(`✓ Closed display window: ${windowId}`);
        return true;
    } catch (error) {
        console.error('Failed to close display window:', error);
        return false;
    }
});

ipcMain.handle('send-to-display', async (event, data) => {
    try {
        const displayWindow = displayWindows.get(data.windowId);
        if (displayWindow && !displayWindow.isDestroyed()) {
            displayWindow.webContents.send('display-content', data.content);
            return true;
        }
        console.warn(`Display window not found: ${data.windowId}`);
        return false;
    } catch (error) {
        console.error('Failed to send to display:', error);
        return false;
    }
});

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// App event handlers
app.whenReady().then(() => {
    console.log('Electron app ready, creating window...');
    createWindow();
    
    // Security: Prevent new window creation
    app.on('web-contents-created', (event, contents) => {
        contents.on('new-window', (event, navigationUrl) => {
            event.preventDefault();
            console.warn('Blocked new window creation to:', navigationUrl);
        });
    });
});

app.on('window-all-closed', () => {
    console.log('All windows closed');
    // On Windows and Linux, quit when all windows are closed
    // On macOS, keep the app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    console.log('App activated');
    // On macOS, re-create window when dock icon is clicked
    if (mainWindow === null) {
        createWindow();
    }
});

// Windows-specific optimizations
if (process.platform === 'win32') {
    // Set app user model ID for Windows taskbar
    app.setAppUserModelId('com.joelcox.cueforge');
    
    // Handle protocol for Windows
    app.setAsDefaultProtocolClient('cueforge');
}