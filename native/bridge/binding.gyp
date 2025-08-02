{
  "targets": [
    {
      "target_name": "cueforge_audio",
      "sources": [
        "../src/AudioEngine.cpp",
        "../src/AudioCue.cpp", 
        "../src/MatrixMixer.cpp",
        "../src/OutputPatch.cpp",
        "../src/CommandProcessor.cpp",
        "audio_bridge.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "../include",
        "../third_party/JUCE/modules"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ 
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "JUCE_STANDALONE_APPLICATION=0"
      ],
      "conditions": [
        ["OS=='win'", {
          "defines": [
            "JUCE_WIN32=1",
            "JUCE_ASIO=1"
          ],
          "libraries": [
            "winmm.lib",
            "ole32.lib",
            "user32.lib"
          ]
        }],
        ["OS=='mac'", {
          "defines": [
            "JUCE_MAC=1"
          ],
          "libraries": [
            "-framework CoreAudio",
            "-framework CoreMIDI", 
            "-framework AudioUnit",
            "-framework AudioToolbox"
          ]
        }],
        ["OS=='linux'", {
          "defines": [
            "JUCE_LINUX=1",
            "JUCE_ALSA=1"
          ],
          "libraries": [
            "-lasound",
            "-ljack",
            "-lpthread"
          ]
        }]
      ]
    }
  ]
}