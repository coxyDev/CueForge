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

    // Handle window close with unsaved changes check
    mainWindow.on('close', async (event) => {
        console.log('Main window close requested');
        console.log('=== CLOSE EVENT DIAGNOSTIC ===');
        console.log('1. Close event fired');
        console.log('2. Event defaultPrevented:', event.defaultPrevented);
        
        // Prevent the window from closing immediately
        event.preventDefault();
        console.log('3. Close prevented - checking for unsaved changes');
        
        try {
            // Check if renderer is available and responsive
            if (mainWindow.webContents.isDestroyed()) {
                console.log('4. WebContents destroyed - forcing close');
                app.quit();
                return;
            }
            
            // Send message to renderer to check for unsaved changes
            console.log('4. Sending close-check to renderer');
            mainWindow.webContents.send('app-close-requested');
            
            // Set a timeout in case renderer doesn't respond
            const timeout = setTimeout(() => {
                console.log('5. Renderer response timeout - forcing close');
                app.quit();
            }, 5000); // 5 second timeout
            
            // Wait for renderer response
            const closeConfirmed = await new Promise((resolve) => {
                // Listen for renderer response
                ipcMain.once('app-close-response', (event, canClose) => {
                    clearTimeout(timeout);
                    console.log('5. Renderer responded - canClose:', canClose);
                    resolve(canClose);
                });
            });
            
            if (closeConfirmed) {
                console.log('6. Close confirmed - destroying window');
                // Actually close the window
                mainWindow.destroy();
            } else {
                console.log('6. Close cancelled by user');
            }
            
        } catch (error) {
            console.error('4. Error checking renderer:', error);
            console.log('5. Forcing close anyway');
            
            // Show a basic dialog if we can't communicate with renderer
            const { response } = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                buttons: ['Save & Exit', 'Exit Without Saving', 'Cancel'],
                defaultId: 0,
                cancelId: 2,
                title: 'Confirm Exit',
                message: 'Do you want to save your changes before exiting?',
                detail: 'Unable to check for unsaved changes automatically.'
            });
            
            if (response === 0) {
                // Save & Exit - attempt to save then close
                console.log('6. User chose Save & Exit');
                app.quit();
            } else if (response === 1) {
                // Exit Without Saving
                console.log('6. User chose Exit Without Saving');
                app.quit();
            }
            // If Cancel (response === 2), do nothing - window stays open
        }
        
        console.log('=== END DIAGNOSTIC ===');
    });

    mainWindow.on('closed', () => {
        console.log('Main window closed, cleaning up...');
        
        // Force close all display windows immediately
        if (displayWindows && displayWindows.size > 0) {
            console.log(`Closing ${displayWindows.size} display windows...`);
            for (const [windowId, displayWindow] of displayWindows) {
                try {
                    if (!displayWindow.isDestroyed()) {
                        console.log(`Force closing display window: ${windowId}`);
                        displayWindow.destroy(); // Use destroy() instead of close()
                    }
                } catch (error) {
                    console.error(`Error closing display window ${windowId}:`, error);
                }
            }
            displayWindows.clear();
        }
        
        mainWindow = null;
        
        // Force quit the entire application
        console.log('Forcing application quit...');
        app.quit();
    });

    // Handle renderer crashes - force quit instead of trying to recover
    mainWindow.webContents.on('crashed', (event) => {
        console.error('Renderer process crashed, quitting application');
        app.quit();
    });

    // Handle unresponsive window
    mainWindow.on('unresponsive', () => {
        console.warn('Main window became unresponsive');
        // Don't show dialog, just log it
    });

    // Set up application menu
    createMenu();
    
    console.log('✓ Main window setup complete');
}

// Application menu
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

// Handle close confirmation from renderer
ipcMain.handle('confirm-app-close', async (event, hasUnsavedChanges) => {
    console.log('Renderer requests close confirmation, unsaved changes:', hasUnsavedChanges);
    
    if (!hasUnsavedChanges) {
        // No unsaved changes, safe to close
        return true;
    }
    
    // Show save dialog
    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Save & Exit', 'Exit Without Saving', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes in your show.',
        detail: 'Do you want to save your changes before exiting?'
    });
    
    switch (response) {
        case 0: // Save & Exit
            console.log('User chose: Save & Exit');
            // Try to save the show first
            try {
                // Send save command to renderer
                mainWindow.webContents.send('app-save-before-close');
                // Return true to allow close (renderer will handle saving)
                return true;
            } catch (error) {
                console.error('Failed to save before close:', error);
                return true; // Close anyway if save fails
            }
            
        case 1: // Exit Without Saving
            console.log('User chose: Exit Without Saving');
            return true;
            
        case 2: // Cancel
        default:
            console.log('User chose: Cancel');
            return false;
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

// File dialog handlers
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

// Settings management
ipcMain.handle('load-app-settings', async () => {
    try {
        const settingsPath = path.join(__dirname, 'settings.json');
        console.log(`Loading app settings from: ${settingsPath}`);
        
        // Check if settings file exists
        const exists = await fs.pathExists(settingsPath);
        if (!exists) {
            console.log('Settings file does not exist, using defaults');
            return getDefaultSettings();
        }
        
        // Read and parse settings
        const settingsData = await fs.readJson(settingsPath);
        console.log('App settings loaded successfully');
        
        // Merge with defaults to ensure all required properties exist
        const defaultSettings = getDefaultSettings();
        return { ...defaultSettings, ...settingsData };
        
    } catch (error) {
        console.error('Failed to load app settings:', error);
        return getDefaultSettings();
    }
});

ipcMain.handle('save-app-settings', async (event, settings) => {
    try {
        const settingsPath = path.join(__dirname, 'settings.json');
        console.log(`Saving app settings to: ${settingsPath}`);
        
        // Add metadata
        const settingsToSave = {
            ...settings,
            lastModified: new Date().toISOString(),
            version: '1.0'
        };
        
        await fs.writeJson(settingsPath, settingsToSave, { spaces: 2 });
        console.log('App settings saved successfully');
        return { success: true };
        
    } catch (error) {
        console.error('Failed to save app settings:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-startup-file', async () => {
    try {
        console.log('IPC: Select startup file dialog requested');
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'CueForge Shows', extensions: ['crfg'] },
                { name: 'QLab Shows (Legacy)', extensions: ['qlab'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            title: 'Select Default Startup File'
        });
        
        if (!result.canceled) {
            const filePath = result.filePaths[0];
            console.log(`✓ Startup file selected: ${filePath}`);
            
            // Verify file exists and is readable
            try {
                const exists = await fs.pathExists(filePath);
                if (!exists) {
                    throw new Error('File does not exist');
                }
                
                // Try to read the file to make sure it's valid
                const showData = await fs.readJson(filePath);
                
                return { success: true, filePath: filePath };
            } catch (accessError) {
                console.error('Selected file is not readable or invalid:', accessError);
                return { success: false, error: 'File is not readable or not a valid show file' };
            }
        }
        
        console.log('Startup file selection cancelled');
        return { success: false, cancelled: true };
    } catch (error) {
        console.error('Select startup file error:', error);
        return { success: false, error: error.message };
    }
});

// Media Browser IPC handlers
ipcMain.handle('select-media-folder', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Media Folder'
        });
        
        if (!result.canceled) {
            return { 
                success: true, 
                folderPath: result.filePaths[0] 
            };
        } else {
            return { success: false };
        }
    } catch (error) {
        console.error('Select media folder error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-media-files', async (event, options) => {
    try {
        const { folderPath, supportedFormats } = options;
        const allFormats = [...supportedFormats.audio, ...supportedFormats.video];
        
        const files = await fs.readdir(folderPath);
        const mediaFiles = [];
        
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isFile()) {
                const extension = path.extname(file).toLowerCase().substring(1);
                
                if (allFormats.includes(extension)) {
                    const fileType = supportedFormats.audio.includes(extension) ? 'audio' : 'video';
                    
                    mediaFiles.push({
                        name: file,
                        path: filePath,
                        extension: extension,
                        type: fileType,
                        size: stats.size,
                        lastModified: stats.mtime.toISOString()
                    });
                }
            }
        }
        
        return { success: true, files: mediaFiles };
    } catch (error) {
        console.error('Get media files error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-media-metadata', async (event, filePath) => {
    try {
        const stats = await fs.stat(filePath);
        const extension = path.extname(filePath).toLowerCase().substring(1);
        
        // Basic metadata - in a real implementation, you'd use libraries like ffprobe
        const metadata = {
            path: filePath,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            extension: extension,
            type: ['mp3', 'wav', 'aiff', 'm4a'].includes(extension) ? 'audio' : 'video',
            duration: 0, // TODO: Implement actual duration detection
            // Additional properties would be detected here
        };
        
        return { success: true, metadata };
    } catch (error) {
        console.error('Get media metadata error:', error);
        return { success: false, error: error.message };
    }
});

// Helper function for default settings
function getDefaultSettings() {
    return {
        startupMode: 'template', // 'template', 'file', or 'empty'
        startupFilePath: null,
        windowSize: {
            width: 1200,
            height: 800
        },
        windowPosition: null, // Will center if null
        lastOpenFiles: [],
        preferences: {
            singleCueMode: true,
            autoContinueEnabled: true,
            masterVolume: 1.0
        }
    };
}

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    app.quit();
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
    console.log('All windows closed - forcing quit');
    // Always quit immediately, even on macOS
    app.quit();
});

app.on('activate', () => {
    console.log('App activated');
    // On macOS, re-create window when dock icon is clicked
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('before-quit', (event) => {
    console.log('Application before-quit event');
    // Force close any remaining windows
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.destroy();
    }
    
    // Clean up display windows
    if (displayWindows && displayWindows.size > 0) {
        for (const [windowId, displayWindow] of displayWindows) {
            try {
                if (!displayWindow.isDestroyed()) {
                    displayWindow.destroy();
                }
            } catch (error) {
                console.error(`Error destroying display window:`, error);
            }
        }
        displayWindows.clear();
    }
});

app.on('will-quit', (event) => {
    console.log('Application will-quit event');
    // Don't prevent quit
});

// Emergency force quit handler
app.on('quit', () => {
    console.log('Application quit event - forcing process exit');
    // Give it 1 second to clean up, then force exit
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

// Handle process termination signals
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, quitting gracefully');
    app.quit();
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, quitting gracefully');
    app.quit();
});

// Windows-specific optimizations
if (process.platform === 'win32') {
    // Set app user model ID for Windows taskbar
    app.setAppUserModelId('com.joelcox.cueforge');
    
    // Handle protocol for Windows
    app.setAsDefaultProtocolClient('cueforge');
}