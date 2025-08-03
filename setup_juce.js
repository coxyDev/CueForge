const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const JUCE_VERSION = '7.0.12';
const JUCE_URL = `https://github.com/juce-framework/JUCE/releases/download/${JUCE_VERSION}/juce-${JUCE_VERSION}-windows.zip`;
const NATIVE_DIR = path.join(__dirname, 'native');
const THIRD_PARTY_DIR = path.join(NATIVE_DIR, 'third_party');
const JUCE_DIR = path.join(THIRD_PARTY_DIR, 'JUCE');

console.log('🎵 CueForge Audio Engine - JUCE Setup');
console.log('=====================================');

function checkJUCE() {
    const cmakeFile = path.join(JUCE_DIR, 'CMakeLists.txt');
    const juceHeader = path.join(JUCE_DIR, 'modules', 'juce_core', 'juce_core.h');
    
    if (fs.existsSync(cmakeFile) && fs.existsSync(juceHeader)) {
        console.log('✅ JUCE framework already installed');
        return true;
    }
    return false;
}

function ensureDirectories() {
    if (!fs.existsSync(NATIVE_DIR)) {
        fs.mkdirSync(NATIVE_DIR, { recursive: true });
    }
    if (!fs.existsSync(THIRD_PARTY_DIR)) {
        fs.mkdirSync(THIRD_PARTY_DIR, { recursive: true });
    }
}

function downloadJUCE() {
    return new Promise((resolve, reject) => {
        console.log('📥 Downloading JUCE framework...');
        console.log(`   URL: ${JUCE_URL}`);
        
        const zipPath = path.join(THIRD_PARTY_DIR, 'juce.zip');
        const file = fs.createWriteStream(zipPath);
        
        https.get(JUCE_URL, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Handle redirect
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve(zipPath);
                    });
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(zipPath);
                });
            }
        }).on('error', reject);
    });
}

function extractJUCE(zipPath) {
    console.log('📦 Extracting JUCE framework...');
    
    try {
        // Try using built-in Windows tools first
        if (process.platform === 'win32') {
            try {
                execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${THIRD_PARTY_DIR}' -Force"`, {
                    stdio: 'inherit'
                });
            } catch (e) {
                // Fallback to tar if available
                execSync(`tar -xf "${zipPath}" -C "${THIRD_PARTY_DIR}"`, {
                    stdio: 'inherit'
                });
            }
        } else {
            // Unix systems
            execSync(`unzip -q "${zipPath}" -d "${THIRD_PARTY_DIR}"`, {
                stdio: 'inherit'
            });
        }
        
        // Find the extracted JUCE directory
        const files = fs.readdirSync(THIRD_PARTY_DIR);
        const juceExtracted = files.find(f => f.startsWith('juce-') || f.startsWith('JUCE'));
        
        if (juceExtracted) {
            const extractedPath = path.join(THIRD_PARTY_DIR, juceExtracted);
            
            // Rename to JUCE if needed
            if (juceExtracted !== 'JUCE') {
                if (fs.existsSync(JUCE_DIR)) {
                    fs.rmSync(JUCE_DIR, { recursive: true, force: true });
                }
                fs.renameSync(extractedPath, JUCE_DIR);
            }
        }
        
        // Clean up zip file
        fs.unlinkSync(zipPath);
        
        console.log('✅ JUCE framework extracted successfully');
        
    } catch (error) {
        console.error('❌ Failed to extract JUCE:', error.message);
        console.log('');
        console.log('Manual installation instructions:');
        console.log('1. Download JUCE from: https://juce.com/get-juce/download');
        console.log('2. Extract to: native/third_party/JUCE/');
        console.log('3. Ensure CMakeLists.txt exists in the JUCE directory');
        throw error;
    }
}

function verifyJUCE() {
    const requiredFiles = [
        'CMakeLists.txt',
        'modules/juce_core/juce_core.h',
        'modules/juce_audio_basics/juce_audio_basics.h',
        'modules/juce_audio_devices/juce_audio_devices.h',
        'modules/juce_audio_formats/juce_audio_formats.h'
    ];
    
    console.log('🔍 Verifying JUCE installation...');
    
    for (const file of requiredFiles) {
        const filePath = path.join(JUCE_DIR, file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Missing required JUCE file: ${file}`);
        }
    }
    
    console.log('✅ JUCE installation verified');
}

async function setupJUCE() {
    try {
        console.log('📍 Working directory:', process.cwd());
        console.log('📁 Target JUCE directory:', JUCE_DIR);
        console.log('');
        
        ensureDirectories();
        
        if (checkJUCE()) {
            verifyJUCE();
            console.log('🎉 JUCE setup complete!');
            return;
        }
        
        console.log('⚠️  JUCE not found, downloading...');
        const zipPath = await downloadJUCE();
        extractJUCE(zipPath);
        verifyJUCE();
        
        console.log('');
        console.log('🎉 JUCE setup complete!');
        console.log('📋 Next steps:');
        console.log('   1. Run: cd native && mkdir build && cd build');
        console.log('   2. Run: cmake .. -DCMAKE_BUILD_TYPE=Release');
        console.log('   3. Run: cmake --build . --config Release');
        
    } catch (error) {
        console.error('❌ JUCE setup failed:', error.message);
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('   • Ensure you have internet access');
        console.log('   • Check if you have extraction tools (unzip/tar)');
        console.log('   • Try downloading JUCE manually from juce.com');
        console.log('   • Ensure write permissions in native/third_party/');
        process.exit(1);
    }
}

// Alternative manual setup function for different JUCE sources
function setupFromLocal(localPath) {
    console.log(`📁 Setting up JUCE from local path: ${localPath}`);
    
    if (!fs.existsSync(localPath)) {
        throw new Error(`Local JUCE path does not exist: ${localPath}`);
    }
    
    ensureDirectories();
    
    if (fs.existsSync(JUCE_DIR)) {
        fs.rmSync(JUCE_DIR, { recursive: true, force: true });
    }
    
    // Copy the local JUCE installation
    const copyRecursive = (src, dest) => {
        const stats = fs.statSync(src);
        if (stats.isDirectory()) {
            fs.mkdirSync(dest, { recursive: true });
            fs.readdirSync(src).forEach(child => {
                copyRecursive(path.join(src, child), path.join(dest, child));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    };
    
    copyRecursive(localPath, JUCE_DIR);
    verifyJUCE();
    
    console.log('✅ JUCE copied from local installation');
}

// Command line argument handling
const args = process.argv.slice(2);
if (args.length > 0) {
    if (args[0] === '--local' && args[1]) {
        setupFromLocal(args[1]);
    } else if (args[0] === '--help') {
        console.log('Usage:');
        console.log('  node setup_juce.js              # Download JUCE automatically');
        console.log('  node setup_juce.js --local PATH # Use local JUCE installation');
        console.log('  node setup_juce.js --help       # Show this help');
    } else {
        console.log('Unknown argument. Use --help for usage information.');
        process.exit(1);
    }
} else {
    setupJUCE();
}