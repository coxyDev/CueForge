const { app, BrowserWindow, Menu, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs-extra');

app.disableHardwareAcceleration();

// Keep a global reference of the window objects
let mainWindow;
let displayWindows = new Map(); // windowId -> BrowserWindow

function createWindow() {
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
            preload: path.join(__dirname, 'preload.js'), // Fixed path - preload.js in root
            webSecurity: true,                // Enable web security
            allowRunningInsecureContent: false
        },
        titleBarStyle: 'default',
        show: false, // Don't show until ready
        icon: path.join(__dirname, 'assets', 'icon.png')
    });

    // Load the app
    mainWindow.loadFile('src/index.html');

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Debug: Check if preload script loaded
        if (process.env.NODE_ENV === 'development') {
            console.log('Main window ready, preload script should be active');
        }
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
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
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Show',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('menu-new-show');
                    }
                },
                {
                    label: 'Open Show',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: [
                                { name: 'QLab Clone Shows', extensions: ['qlab'] },
                                { name: 'All Files', extensions: ['*'] }
                            ]
                        });
                        
                        if (!result.canceled) {
                            mainWindow.webContents.send('menu-open-show', result.filePaths[0]);
                        }
                    }
                },
                {
                    label: 'Save Show',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('menu-save-show');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
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
                    label: 'Add Audio Cue',
                    accelerator: 'CmdOrCtrl+Shift+A',
                    click: () => {
                        mainWindow.webContents.send('menu-add-cue', 'audio');
                    }
                },
                {
                    label: 'Add Video Cue',
                    accelerator: 'CmdOrCtrl+Shift+V',
                    click: () => {
                        mainWindow.webContents.send('menu-add-cue', 'video');
                    }
                },
                {
                    label: 'Add Wait Cue',
                    accelerator: 'CmdOrCtrl+Shift+W',
                    click: () => {
                        mainWindow.webContents.send('menu-add-cue', 'wait');
                    }
                },
                {
                    label: 'Add Group Cue',
                    accelerator: 'CmdOrCtrl+Shift+G',
                    click: () => {
                        mainWindow.webContents.send('menu-add-cue', 'group');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Delete Cue',
                    accelerator: 'Delete',
                    click: () => {
                        mainWindow.webContents.send('menu-delete-cue');
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
                        mainWindow.webContents.send('menu-go');
                    }
                },
                {
                    label: 'Stop',
                    accelerator: 'CmdOrCtrl+.',
                    click: () => {
                        mainWindow.webContents.send('menu-stop');
                    }
                },
                {
                    label: 'Pause',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => {
                        mainWindow.webContents.send('menu-pause');
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
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
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
        console.log(`Reading file: ${filePath}`);
        
        // Security: Validate file path (basic check)
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path');
        }
        
        // Read file with error handling
        const data = await fs.readFile(filePath, options);
        return data;
    } catch (error) {
        console.error('File read error:', error.message);
        throw new Error(`Failed to read file: ${error.message}`);
    }
});

ipcMain.handle('fs-writeFile', async (event, filePath, data, options) => {
    try {
        console.log(`Writing file: ${filePath}`);
        
        // Security: Validate inputs
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path');
        }
        
        await fs.writeFile(filePath, data, options);
        return { success: true };
    } catch (error) {
        console.error('File write error:', error.message);
        throw new Error(`Failed to write file: ${error.message}`);
    }
});

ipcMain.handle('fs-exists', async (event, filePath) => {
    try {
        return await fs.pathExists(filePath);
    } catch (error) {
        return false;
    }
});

ipcMain.handle('fs-stat', async (event, filePath) => {
    try {
        return await fs.stat(filePath);
    } catch (error) {
        throw new Error(`Failed to stat file: ${error.message}`);
    }
});

// IPC handlers for show operations
ipcMain.handle('save-show-dialog', async (event, showData) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            filters: [
                { name: 'QLab Clone Shows', extensions: ['qlab'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled) {
            await fs.writeJson(result.filePath, showData, { spaces: 2 });
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
        const showData = await fs.readJson(filePath);
        return { success: true, data: showData };
    } catch (error) {
        console.error('Load show error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-audio-file', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled) {
            return { success: true, filePath: result.filePaths[0] };
        }
        
        return { success: false };
    } catch (error) {
        console.error('Select audio file error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-video-file', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm', 'flv', 'm4v'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled) {
            return { success: true, filePath: result.filePaths[0] };
        }
        
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
        
        return displays.map((display, index) => ({
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
        
        console.log(`Created display window: ${windowId} for ${config.displayName}`);
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
        
        console.log(`Closed display window: ${windowId}`);
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

// App event handlers
app.whenReady().then(() => {
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
    // On Windows and Linux, quit when all windows are closed
    // On macOS, keep the app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (mainWindow === null) {
        createWindow();
    }
});

// Windows-specific optimizations
if (process.platform === 'win32') {
    // Set app user model ID for Windows taskbar
    app.setAppUserModelId('com.yourname.qlabclone');
    
    // Handle protocol for Windows
    app.setAsDefaultProtocolClient('qlab-clone');
}