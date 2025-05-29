const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        titleBarStyle: 'default',
        show: false, // Don't show until ready
        icon: path.join(__dirname, 'assets', 'icon.png') // Windows will use .ico if available
    });

    // Load the app
    mainWindow.loadFile('src/index.html');

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
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

// IPC handlers for file operations
ipcMain.handle('save-show-dialog', async (event, showData) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
            { name: 'QLab Clone Shows', extensions: ['qlab'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    if (!result.canceled) {
        try {
            await fs.writeJson(result.filePath, showData, { spaces: 2 });
            return { success: true, filePath: result.filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    return { success: false, cancelled: true };
});

ipcMain.handle('load-show-file', async (event, filePath) => {
    try {
        const showData = await fs.readJson(filePath);
        return { success: true, data: showData };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-audio-file', async () => {
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
});

ipcMain.handle('select-video-file', async () => {
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
});

ipcMain.handle('select-media-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Media Files', extensions: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma', 'mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm', 'flv', 'm4v'] },
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma'] },
            { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm', 'flv', 'm4v'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    if (!result.canceled) {
        return { success: true, filePath: result.filePaths[0] };
    }
    
    return { success: false };
});

// App event handlers
app.whenReady().then(createWindow);

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