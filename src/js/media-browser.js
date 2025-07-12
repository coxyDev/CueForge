/**
 * Professional Media Browser Component for CueForge
 * Provides QLab-style media management and preview capabilities
 */

class MediaBrowser {
    constructor(uiManager, cueManager) {
        this.uiManager = uiManager;
        this.cueManager = cueManager;
        this.currentPath = null;
        this.mediaCache = new Map();
        this.thumbnailCache = new Map();
        this.isVisible = false;
        
        // Media filters and organization
        this.currentFilter = 'all'; // 'all', 'audio', 'video', 'recent', 'favorites'
        this.sortBy = 'name'; // 'name', 'date', 'size', 'type'
        this.sortOrder = 'asc';
        
        // File system watching
        this.fileWatchers = new Map();
        this.supportedFormats = this.getSupportedFormats();
        
        // Preview state
        this.previewElement = null;
        this.isPreviewPlaying = false;
        
        this.initializeMediaBrowser();
    }

    initializeMediaBrowser() {
        this.createMediaBrowserPanel();
        this.bindEvents();
        this.loadRecentLocations();
        console.log('MediaBrowser initialized');
    }

    createMediaBrowserPanel() {
        // Create the media browser panel HTML structure
        const mediaBrowserHTML = `
            <div id="media-browser-panel" class="media-browser-panel" style="display: none;">
                <div class="media-browser-header">
                    <div class="media-browser-title">
                        <h3>Media Browser</h3>
                        <button id="media-browser-close" class="close-btn">&times;</button>
                    </div>
                    <div class="media-browser-toolbar">
                        <div class="path-breadcrumb" id="media-path-breadcrumb">
                            <span class="breadcrumb-item">Select Folder...</span>
                        </div>
                        <div class="media-browser-actions">
                            <button id="browse-folder-btn" class="btn-small">📁 Browse</button>
                            <button id="refresh-media-btn" class="btn-small">🔄 Refresh</button>
                        </div>
                    </div>
                    <div class="media-filters">
                        <div class="filter-buttons">
                            <button class="filter-btn active" data-filter="all">All</button>
                            <button class="filter-btn" data-filter="audio">Audio</button>
                            <button class="filter-btn" data-filter="video">Video</button>
                            <button class="filter-btn" data-filter="recent">Recent</button>
                            <button class="filter-btn" data-filter="favorites">Favorites</button>
                        </div>
                        <div class="sort-controls">
                            <select id="media-sort-select">
                                <option value="name">Name</option>
                                <option value="date">Date Modified</option>
                                <option value="size">Size</option>
                                <option value="type">Type</option>
                            </select>
                            <button id="sort-order-btn" class="btn-small" title="Toggle sort order">↑</button>
                        </div>
                    </div>
                </div>
                
                <div class="media-browser-content">
                    <div class="media-list-container">
                        <div id="media-file-list" class="media-file-list">
                            <div class="media-placeholder">
                                <div class="placeholder-icon">📁</div>
                                <div class="placeholder-text">Select a folder to browse media files</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="media-preview-container">
                        <div class="media-preview-header">
                            <h4>Preview</h4>
                            <div class="preview-controls">
                                <button id="preview-play-btn" class="btn-small" disabled>▶️</button>
                                <button id="preview-stop-btn" class="btn-small" disabled>⏹️</button>
                            </div>
                        </div>
                        <div id="media-preview" class="media-preview">
                            <div class="preview-placeholder">
                                <div class="placeholder-icon">🎵</div>
                                <div class="placeholder-text">Select a media file to preview</div>
                            </div>
                        </div>
                        <div class="media-info" id="media-info">
                            <!-- Media metadata will be displayed here -->
                        </div>
                    </div>
                </div>
                
                <div class="media-browser-footer">
                    <div class="media-stats" id="media-stats">
                        No files loaded
                    </div>
                    <div class="media-actions">
                        <button id="add-to-cue-list-btn" class="btn-primary" disabled>Add to Cue List</button>
                        <button id="create-group-from-selection-btn" class="btn-small" disabled>Create Group</button>
                    </div>
                </div>
            </div>
        `;

        // Insert the media browser panel into the DOM
        document.body.insertAdjacentHTML('beforeend', mediaBrowserHTML);
    }

    bindEvents() {
        // Panel controls
        document.getElementById('media-browser-close').addEventListener('click', () => {
            this.hide();
        });

        document.getElementById('browse-folder-btn').addEventListener('click', () => {
            this.openFolderDialog();
        });

        document.getElementById('refresh-media-btn').addEventListener('click', () => {
            this.refreshCurrentFolder();
        });

        // Filters and sorting
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        document.getElementById('media-sort-select').addEventListener('change', (e) => {
            this.setSortBy(e.target.value);
        });

        document.getElementById('sort-order-btn').addEventListener('click', () => {
            this.toggleSortOrder();
        });

        // Preview controls
        document.getElementById('preview-play-btn').addEventListener('click', () => {
            this.togglePreview();
        });

        document.getElementById('preview-stop-btn').addEventListener('click', () => {
            this.stopPreview();
        });

        // Action buttons
        document.getElementById('add-to-cue-list-btn').addEventListener('click', () => {
            this.addSelectedToCueList();
        });

        document.getElementById('create-group-from-selection-btn').addEventListener('click', () => {
            this.createGroupFromSelection();
        });

        // File list interactions
        document.getElementById('media-file-list').addEventListener('click', (e) => {
            const fileItem = e.target.closest('.media-file-item');
            if (fileItem) {
                this.selectMediaFile(fileItem);
            }
        });

        document.getElementById('media-file-list').addEventListener('dblclick', (e) => {
            const fileItem = e.target.closest('.media-file-item');
            if (fileItem) {
                this.addFileToShowAsCue(fileItem.dataset.filePath);
            }
        });
    }

    async openFolderDialog() {
        try {
            // Use Electron's dialog to select a folder
            if (window.electronAPI && window.electronAPI.ipcRenderer) {
                const result = await window.electronAPI.ipcRenderer.invoke('select-media-folder');
                if (result.success && result.folderPath) {
                    await this.loadFolder(result.folderPath);
                }
            } else {
                // Fallback for browser environment
                this.showBrowserFolderWarning();
            }
        } catch (error) {
            console.error('Failed to open folder dialog:', error);
            this.uiManager.showStatusMessage('Failed to open folder browser', 'error');
        }
    }

    async loadFolder(folderPath) {
        try {
            this.currentPath = folderPath;
            this.updateBreadcrumb();
            
            // Get file list from main process
            const result = await window.electronAPI.ipcRenderer.invoke('get-media-files', {
                folderPath: folderPath,
                supportedFormats: this.supportedFormats
            });
            
            if (result.success) {
                this.displayMediaFiles(result.files);
                this.updateMediaStats(result.files.length);
                
                // Start background metadata analysis
                this.analyzeMediaFiles(result.files);
            } else {
                throw new Error(result.error || 'Failed to load folder');
            }
            
        } catch (error) {
            console.error('Failed to load folder:', error);
            this.uiManager.showStatusMessage(`Failed to load folder: ${error.message}`, 'error');
        }
    }

    displayMediaFiles(files) {
        const container = document.getElementById('media-file-list');
        
        if (files.length === 0) {
            container.innerHTML = `
                <div class="media-placeholder">
                    <div class="placeholder-icon">📂</div>
                    <div class="placeholder-text">No supported media files found in this folder</div>
                </div>
            `;
            return;
        }

        // Sort files
        const sortedFiles = this.sortFiles(files);
        
        // Filter files
        const filteredFiles = this.filterFiles(sortedFiles);

        container.innerHTML = '';

        filteredFiles.forEach(file => {
            const fileItem = this.createMediaFileItem(file);
            container.appendChild(fileItem);
        });

        this.updateMediaStats(filteredFiles.length, files.length);
    }

    createMediaFileItem(file) {
        const item = document.createElement('div');
        item.className = 'media-file-item';
        item.dataset.filePath = file.path;
        item.dataset.fileType = file.type;
        
        const typeIcon = this.getFileTypeIcon(file.type, file.extension);
        const fileSize = this.formatFileSize(file.size);
        const lastModified = new Date(file.lastModified).toLocaleDateString();
        
        item.innerHTML = `
            <div class="file-icon">${typeIcon}</div>
            <div class="file-info">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-metadata">
                    <span class="file-size">${fileSize}</span>
                    <span class="file-date">${lastModified}</span>
                    <span class="file-type">${file.extension.toUpperCase()}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn-tiny preview-btn" title="Preview">👁️</button>
                <button class="btn-tiny favorite-btn" title="Add to Favorites">⭐</button>
                <button class="btn-tiny add-btn" title="Add to Cue List">➕</button>
            </div>
        `;

        // Bind file-specific events
        const previewBtn = item.querySelector('.preview-btn');
        const favoriteBtn = item.querySelector('.favorite-btn');
        const addBtn = item.querySelector('.add-btn');

        previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.previewFile(file);
        });

        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(file);
        });

        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addFileToShowAsCue(file.path);
        });

        return item;
    }

    selectMediaFile(fileItem) {
        // Clear previous selection
        document.querySelectorAll('.media-file-item.selected').forEach(item => {
            item.classList.remove('selected');
        });

        // Select new item
        fileItem.classList.add('selected');
        
        // Enable action buttons
        document.getElementById('add-to-cue-list-btn').disabled = false;
        
        // Load file info
        const filePath = fileItem.dataset.filePath;
        this.loadFileInfo(filePath);
    }

    async loadFileInfo(filePath) {
        try {
            const result = await window.electronAPI.ipcRenderer.invoke('get-media-metadata', filePath);
            
            if (result.success) {
                this.displayMediaInfo(result.metadata);
            }
        } catch (error) {
            console.error('Failed to load file info:', error);
        }
    }

    displayMediaInfo(metadata) {
        const infoContainer = document.getElementById('media-info');
        
        let infoHTML = `
            <div class="metadata-section">
                <h5>File Information</h5>
                <div class="metadata-item">
                    <span class="metadata-label">Duration:</span>
                    <span class="metadata-value">${this.formatDuration(metadata.duration)}</span>
                </div>
        `;

        if (metadata.type === 'audio') {
            infoHTML += `
                <div class="metadata-item">
                    <span class="metadata-label">Sample Rate:</span>
                    <span class="metadata-value">${metadata.sampleRate} Hz</span>
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">Bit Depth:</span>
                    <span class="metadata-value">${metadata.bitDepth} bit</span>
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">Channels:</span>
                    <span class="metadata-value">${metadata.channels}</span>
                </div>
            `;
        } else if (metadata.type === 'video') {
            infoHTML += `
                <div class="metadata-item">
                    <span class="metadata-label">Resolution:</span>
                    <span class="metadata-value">${metadata.width}x${metadata.height}</span>
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">Frame Rate:</span>
                    <span class="metadata-value">${metadata.frameRate} fps</span>
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">Codec:</span>
                    <span class="metadata-value">${metadata.codec}</span>
                </div>
            `;
        }

        infoHTML += `
            </div>
        `;

        infoContainer.innerHTML = infoHTML;
    }

    async addFileToShowAsCue(filePath) {
        try {
            // Determine cue type based on file extension
            const extension = filePath.split('.').pop().toLowerCase();
            const audioFormats = ['mp3', 'wav', 'aiff', 'caf', 'm4a', 'aac', 'flac', 'ogg'];
            const videoFormats = ['mov', 'mp4', 'm4v', 'avi', 'webm', 'mkv'];
            
            let cueType;
            if (audioFormats.includes(extension)) {
                cueType = 'audio';
            } else if (videoFormats.includes(extension)) {
                cueType = 'video';
            } else {
                throw new Error(`Unsupported file format: ${extension}`);
            }

            // Get file name without extension for cue name
            const fileName = filePath.split('/').pop().split('\\').pop();
            const cueName = fileName.replace(/\.[^/.]+$/, "");

            // Create the cue
            const cue = this.cueManager.addCue(cueType, {
                name: cueName
            });

            // Set the file target
            if (this.cueManager.setFileTarget(cue.id, filePath, fileName)) {
                this.uiManager.showStatusMessage(`Added ${cueType} cue: ${cueName}`, 'success');
                
                // Select the new cue
                this.cueManager.selectCue(cue.id);
            } else {
                throw new Error('Failed to set file target');
            }

        } catch (error) {
            console.error('Failed to add file as cue:', error);
            this.uiManager.showStatusMessage(`Failed to add file: ${error.message}`, 'error');
        }
    }

    // Utility methods
    getSupportedFormats() {
        return {
            audio: ['mp3', 'wav', 'aiff', 'caf', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma'],
            video: ['mov', 'mp4', 'm4v', 'avi', 'webm', 'mkv', 'wmv', 'flv', 'ogv']
        };
    }

    getFileTypeIcon(type, extension) {
        const icons = {
            audio: '🎵',
            video: '🎬',
            mp3: '🎵', wav: '🎵', aiff: '🎵', flac: '🎵',
            mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬'
        };
        return icons[extension] || icons[type] || '📄';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatDuration(milliseconds) {
        if (!milliseconds) return '--:--';
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        }
        return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    sortFiles(files) {
        return [...files].sort((a, b) => {
            let compareA, compareB;
            
            switch (this.sortBy) {
                case 'name':
                    compareA = a.name.toLowerCase();
                    compareB = b.name.toLowerCase();
                    break;
                case 'date':
                    compareA = new Date(a.lastModified);
                    compareB = new Date(b.lastModified);
                    break;
                case 'size':
                    compareA = a.size;
                    compareB = b.size;
                    break;
                case 'type':
                    compareA = a.extension;
                    compareB = b.extension;
                    break;
                default:
                    return 0;
            }
            
            if (compareA < compareB) return this.sortOrder === 'asc' ? -1 : 1;
            if (compareA > compareB) return this.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    filterFiles(files) {
        switch (this.currentFilter) {
            case 'audio':
                return files.filter(f => this.supportedFormats.audio.includes(f.extension));
            case 'video':
                return files.filter(f => this.supportedFormats.video.includes(f.extension));
            case 'recent':
                // Show files modified in last 7 days
                const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                return files.filter(f => new Date(f.lastModified) > weekAgo);
            case 'favorites':
                // Load from preferences/favorites list
                return files.filter(f => this.isFavorite(f.path));
            default:
                return files;
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update UI
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        // Refresh display
        if (this.currentPath) {
            this.refreshCurrentFolder();
        }
    }

    setSortBy(sortBy) {
        this.sortBy = sortBy;
        if (this.currentPath) {
            this.refreshCurrentFolder();
        }
    }

    toggleSortOrder() {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        const btn = document.getElementById('sort-order-btn');
        btn.textContent = this.sortOrder === 'asc' ? '↑' : '↓';
        
        if (this.currentPath) {
            this.refreshCurrentFolder();
        }
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('media-path-breadcrumb');
        if (this.currentPath) {
            const pathParts = this.currentPath.split(/[/\\]/);
            const displayPath = pathParts.length > 3 
                ? `.../${pathParts.slice(-2).join('/')}`
                : this.currentPath;
            
            breadcrumb.innerHTML = `<span class="breadcrumb-item" title="${this.currentPath}">${displayPath}</span>`;
        } else {
            breadcrumb.innerHTML = '<span class="breadcrumb-item">Select Folder...</span>';
        }
    }

    updateMediaStats(showing, total = null) {
        const statsEl = document.getElementById('media-stats');
        if (total && total !== showing) {
            statsEl.textContent = `Showing ${showing} of ${total} files`;
        } else {
            statsEl.textContent = `${showing} file${showing !== 1 ? 's' : ''}`;
        }
    }

    async refreshCurrentFolder() {
        if (this.currentPath) {
            await this.loadFolder(this.currentPath);
        }
    }

    show() {
        this.isVisible = true;
        document.getElementById('media-browser-panel').style.display = 'flex';
    }

    hide() {
        this.isVisible = false;
        document.getElementById('media-browser-panel').style.display = 'none';
        this.stopPreview();
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // Placeholder methods for future implementation
    analyzeMediaFiles(files) {
        // TODO: Implement background metadata analysis
        console.log('Starting background analysis of', files.length, 'files');
    }

    previewFile(file) {
        // TODO: Implement media preview
        console.log('Previewing file:', file.name);
    }

    togglePreview() {
        // TODO: Implement preview play/pause
    }

    stopPreview() {
        // TODO: Implement preview stop
        document.getElementById('preview-play-btn').disabled = true;
        document.getElementById('preview-stop-btn').disabled = true;
    }

    toggleFavorite(file) {
        // TODO: Implement favorites system
        console.log('Toggle favorite:', file.name);
    }

    isFavorite(filePath) {
        // TODO: Check if file is in favorites
        return false;
    }

    addSelectedToCueList() {
        const selected = document.querySelector('.media-file-item.selected');
        if (selected) {
            this.addFileToShowAsCue(selected.dataset.filePath);
        }
    }

    createGroupFromSelection() {
        // TODO: Implement group creation from multiple selected files
        console.log('Create group from selection');
    }

    loadRecentLocations() {
        // TODO: Load recent folder locations from preferences
    }

    showBrowserFolderWarning() {
        this.uiManager.showStatusMessage(
            'Folder browsing requires the desktop app. Use "Add Cue" buttons for now.',
            'warning'
        );
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MediaBrowser;
} else {
    window.MediaBrowser = MediaBrowser;
}