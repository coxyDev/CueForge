class ProfessionalAudioManager {
    constructor(audioEngine, uiManager) {
        this.audioEngine = audioEngine;
        this.uiManager = uiManager;
        
        this.initializeComponents();
        this.bindEvents();
    }
    
    initializeComponents() {
        // Initialize VST scanner UI
        this.vstScannerUI = new VSTScannerUI(this.audioEngine.vstManager);
        
        // Initialize ASIO configuration
        this.asioConfig = new ASIOConfiguration(this.audioEngine);
        
        // Initialize monitoring displays
        this.monitoringDisplay = new MonitoringDisplay(this.audioEngine);
    }
    
    openProfessionalAudioModal() {
        const modal = document.getElementById('pro-audio-modal');
        if (modal) {
            modal.style.display = 'block';
            this.updateModalContent();
        }
    }
    
    updateModalContent() {
        // Update VST plugin list
        this.updateVSTPluginList();
        
        // Update ASIO device list
        this.updateASIODeviceList();
        
        // Update performance displays
        this.updatePerformanceMeters();
    }
    
    async updateVSTPluginList() {
        const grid = document.getElementById('vst-plugin-grid');
        if (!grid) return;
        
        const plugins = this.audioEngine.vstManager.getPluginList();
        
        let html = '';
        plugins.forEach(plugin => {
            html += `
                <div class="vst-plugin-card" data-plugin-id="${plugin.id}">
                    <div class="plugin-icon">${this.getPluginIcon(plugin.category)}</div>
                    <div class="plugin-info">
                        <h4>${plugin.name}</h4>
                        <p>${plugin.vendor} - ${plugin.format}</p>
                        <span class="plugin-category">${plugin.category}</span>
                    </div>
                    <div class="plugin-actions">
                        <button class="btn-small" data-action="test-plugin">Test</button>
                        <button class="btn-small" data-action="favorite">★</button>
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html || '<p>No VST plugins found. Click "Rescan Plugins" to search.</p>';
    }
    
    getPluginIcon(category) {
        const icons = {
            'Reverb': '🔊',
            'Delay': '⏰',
            'Dynamics': '🎚️',
            'EQ': '📊',
            'Distortion': '🔥',
            'Modulation': '🌀',
            'Instrument': '🎹',
            'Effect': '🎛️'
        };
        return icons[category] || '🎛️';
    }
}