// Comprehensive test suite for audio engine
async function runAudioEngineTests() {
    console.log('🧪 Running Audio Engine Tests...');
    
    const tests = [
        testAudioContextInitialization,
        testMatrixMixerFunctionality,
        testEffectsChainProcessing,
        testFadeAutomation,
        testVSTIntegration,
        testPerformanceUnderLoad
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            await test();
            console.log(`✅ ${test.name} - PASSED`);
            passed++;
        } catch (error) {
            console.error(`❌ ${test.name} - FAILED:`, error);
            failed++;
        }
    }
    
    console.log(`🏁 Tests complete: ${passed} passed, ${failed} failed`);
}

async function testAudioContextInitialization() {
    const engine = new ProfessionalAudioEngine();
    await engine.initializeAudioContext();
    
    if (engine.audioContext.state !== 'running') {
        throw new Error('Audio context not running');
    }
}

async function testMatrixMixerFunctionality() {
    const context = new AudioContext();
    const matrix = new MatrixMixer(4, 8);
    
    // Test crosspoint setting
    matrix.setCrosspoint(0, 0, -6);
    const level = matrix.getCrosspoint(0, 0);
    
    if (level !== -6) {
        throw new Error('Matrix crosspoint not set correctly');
    }
    
    // Test gain calculation
    const gain = matrix.calculateGain(0, 0);
    const expectedGain = Math.pow(10, -6 / 20);
    
    if (Math.abs(gain - expectedGain) > 0.001) {
        throw new Error('Matrix gain calculation incorrect');
    }
}

// Add more test functions...