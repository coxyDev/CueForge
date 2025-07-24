/**
 * Audio Patch Manager
 * Manages multiple output patches for professional audio routing
 */
class AudioPatchManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.patches = new Map();
        this.defaultPatchName = null;
        
        console.log('Audio Patch Manager initialized');
    }
    
    /**
     * Create a new output patch
     */
    createPatch(name, deviceId = 'default', numCueOutputs = 64) {
        if (this.patches.has(name)) {
            console.warn(`Patch "${name}" already exists`);
            return this.patches.get(name);
        }
        
        const patch = new AudioOutputPatch(name, deviceId, numCueOutputs, this.audioEngine);
        this.patches.set(name, patch);
        
        // Set as default if it's the first patch
        if (this.patches.size === 1) {
            this.defaultPatchName = name;
        }
        
        console.log(`Created output patch: ${name} (${numCueOutputs} cue outputs)`);
        return patch;
    }
    
    /**
     * Get a patch by name
     */
    getPatch(name) {
        return this.patches.get(name);
    }
    
    /**
     * Get the default patch
     */
    getDefaultPatch() {
        if (this.defaultPatchName) {
            return this.patches.get(this.defaultPatchName);
        }
        return null;
    }
    
    /**
     * Set the default patch
     */
    setDefaultPatch(patchName) {
        if (this.patches.has(patchName)) {
            this.defaultPatchName = patchName;
            console.log(`Default patch set to: ${patchName}`);
            return true;
        }
        console.warn(`Cannot set default patch - "${patchName}" not found`);
        return false;
    }
    
    /**
     * Get all patches
     */
    getAllPatches() {
        return Array.from(this.patches.values());
    }
    
    /**
     * Get all patch names
     */
    getPatchNames() {
        return Array.from(this.patches.keys());
    }
    
    /**
     * Delete a patch
     */
    deletePatch(name) {
        if (!this.patches.has(name)) {
            console.warn(`Cannot delete patch - "${name}" not found`);
            return false;
        }
        
        const patch = this.patches.get(name);
        patch.destroy();
        this.patches.delete(name);
        
        // If this was the default patch, clear the default
        if (this.defaultPatchName === name) {
            this.defaultPatchName = null;
            
            // Set a new default if other patches exist
            if (this.patches.size > 0) {
                this.defaultPatchName = this.patches.keys().next().value;
            }
        }
        
        console.log(`Deleted patch: ${name}`);
        return true;
    }
    
    /**
     * Route audio from a cue to patches
     */
    routeCueToPatches(cue, patchNames = null) {
        // If no specific patches specified, use default
        if (!patchNames) {
            const defaultPatch = this.getDefaultPatch();
            if (defaultPatch) {
                defaultPatch.routeCue(cue);
            }
            return;
        }
        
        // Route to specified patches
        if (Array.isArray(patchNames)) {
            patchNames.forEach(patchName => {
                const patch = this.getPatch(patchName);
                if (patch) {
                    patch.routeCue(cue);
                } else {
                    console.warn(`Cannot route to patch - "${patchName}" not found`);
                }
            });
        }
    }
    
    /**
     * Get patch configuration for saving
     */
    getConfiguration() {
        const config = {
            defaultPatch: this.defaultPatchName,
            patches: {}
        };
        
        this.patches.forEach((patch, name) => {
            config.patches[name] = patch.getConfiguration();
        });
        
        return config;
    }
    
    /**
     * Load patch configuration
     */
    loadConfiguration(config) {
        try {
            // Clear existing patches
            this.patches.forEach(patch => patch.destroy());
            this.patches.clear();
            
            // Create patches from configuration
            Object.entries(config.patches || {}).forEach(([name, patchConfig]) => {
                const patch = this.createPatch(name, patchConfig.deviceId, patchConfig.numCueOutputs);
                patch.loadConfiguration(patchConfig);
            });
            
            // Set default patch
            if (config.defaultPatch && this.patches.has(config.defaultPatch)) {
                this.defaultPatchName = config.defaultPatch;
            }
            
            console.log('Patch configuration loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load patch configuration:', error);
            return false;
        }
    }
    
    /**
     * Get patch usage statistics
     */
    getUsageStatistics() {
        const stats = {
            totalPatches: this.patches.size,
            defaultPatch: this.defaultPatchName,
            patchDetails: {}
        };
        
        this.patches.forEach((patch, name) => {
            stats.patchDetails[name] = {
                numCueOutputs: patch.numCueOutputs,
                deviceId: patch.deviceId,
                activeRoutes: patch.getActiveRouteCount(),
                isDefault: name === this.defaultPatchName
            };
        });
        
        return stats;
    }
    
    /**
     * Cleanup all patches
     */
    destroy() {
        console.log('Destroying Audio Patch Manager...');
        
        this.patches.forEach(patch => {
            patch.destroy();
        });
        
        this.patches.clear();
        this.defaultPatchName = null;
        
        console.log('Audio Patch Manager destroyed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioPatchManager;
} else {
    window.AudioPatchManager = AudioPatchManager;
}