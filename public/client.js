const logDiv = document.getElementById('log');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const talkBtn = document.getElementById('talkBtn'); 
const halEye = document.getElementById('halEye'); // Get HAL eye element

let socket;
let audioContext;
let analyser; // For visualization
let visualizerDataArray;
let mediaStream;
let processor;
let inputNode;
let responseQueue = [];
let isPlaying = false;
let isTalkPressed = false; // Flag for PTT

function log(message) {
    const p = document.createElement('p');
    p.textContent = message;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
}

async function startAssistant() {
    try {
        log("Connecting to server...");
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${protocol}//${window.location.host}/`);

        socket.onopen = async () => {
            log("Connected to server");
            startBtn.disabled = true;
            stopBtn.disabled = false;
            talkBtn.disabled = false; // Enable talk button
            
            // Initialize Audio
            await startAudio();
        };

        socket.onmessage = async (event) => {
            let data;
            try {
                if (event.data instanceof Blob) {
                    const text = await event.data.text();
                    data = JSON.parse(text);
                } else {
                    data = JSON.parse(event.data);
                }
            } catch (e) {
                console.error("Error parsing message:", e, event.data);
                return;
            }

            const content = data.serverContent || data.server_content;
            
            if (content) {
                if (content.modelTurn && content.modelTurn.parts) {
                    for (const part of content.modelTurn.parts) {
                        handlePart(part);
                    }
                } else if (content.model_turn && content.model_turn.parts) {
                     for (const part of content.model_turn.parts) {
                        handlePart(part);
                    }
                }
            }
        };

        function handlePart(part) {
             let mimeType = part.inlineData?.mimeType || part.inline_data?.mime_type;
             let data = part.inlineData?.data || part.inline_data?.data;
             
             if (mimeType && mimeType.startsWith('audio/pcm')) {
                 queueAudio(data);
             }
             if (part.text) {
                 log("Assistant: " + part.text);
             }
        }

        socket.onclose = () => {
            log("Disconnected from server");
            stopAssistant();
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
            log("Error connecting to server");
        };

    } catch (error) {
        console.error("Error starting assistant:", error);
        log("Error: " + error.message);
    }
}

function stopAssistant() {
    if (socket) {
        socket.close();
        socket = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    startBtn.disabled = false;
    stopBtn.disabled = true;
    talkBtn.disabled = true; // Disable talk button
    isPlaying = false;
    responseQueue = [];
}

async function startAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 }); // Goal: 16kHz
    
    // Create Analyser for visualization
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    visualizerDataArray = new Uint8Array(bufferLength);
    
    // Start visualization loop
    visualize();

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: {
            channelCount: 1,
            sampleRate: 16000
        } });
        
        if (!audioContext) return;

        const source = audioContext.createMediaStreamSource(mediaStream);
        
        // Use ScriptProcessorNode for simplicity (deprecated but works broadly for demos)
        // Buffer size 4096 gives ~0.25s latency at 16kHz
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            if (!isTalkPressed) return; // Only process audio if button is pressed

            const inputData = e.inputBuffer.getChannelData(0);
            
            // Convert float32 (Web Audio) to int16 (PCM)
            const pcmData = floatTo16BitPCM(inputData);
            
            // Convert to Base64
            const base64Audio = arrayBufferToBase64(pcmData);

            // Send to Server
            // The structure for Multimodal Live API (BidiGenerateContent)
            // Note: The API usually expects camelCase for keys in JSON over WebSocket
            const msg = {
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Audio
                    }]
                }
            };
            
            // Log audio volume for debugging
            if (Math.random() < 0.05) {
                // Calculate RMS volume
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                if (rms > 0.01) {
                    console.log("Sending audio chunk, RMS:", rms.toFixed(4));
                }
            }

            socket.send(JSON.stringify(msg));
        };

    } catch (err) {
        console.error("Error accessing microphone:", err);
        log("Error accessing microphone: " + err.message);
    }
}

// Helper to convert Float32Array to Int16Array
function floatTo16BitPCM(input) {
    let output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output.buffer;
}

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// --- Audio Playback ---

function queueAudio(base64Data) {
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(int16Data.length);
    
    for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
    }
    
    responseQueue.push(float32Data);
    if (!isPlaying) {
        playQueue();
    }
}

async function playQueue() {
    if (responseQueue.length === 0) {
        isPlaying = false;
        return;
    }

    isPlaying = true;
    const audioData = responseQueue.shift();
    
    const audioBuffer = audioContext.createBuffer(1, audioData.length, 24000); // Update to 24kHz (Gemini Live API default)
    audioBuffer.getChannelData(0).set(audioData);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Connect source to analyser AND destination
    source.connect(analyser); // Connect to visualizer
    analyser.connect(audioContext.destination); // Connect visualizer to speakers
    
    source.onended = () => {
        playQueue();
    };
    
    source.start();
}

// --- Visualization ---
function visualize() {
    if (!audioContext) return;
    
    requestAnimationFrame(visualize);
    
    // Default resting state
    let glowSize = 20; 
    let centerOpacity = 0.8;
    
    if (isPlaying && analyser) {
        analyser.getByteFrequencyData(visualizerDataArray);
        
        // Calculate average volume
        let avg = 0;
        // Focus on lower frequencies for voice
        const range = visualizerDataArray.length / 2;
        for(let i = 0; i < range; i++) {
            avg += visualizerDataArray[i];
        }
        avg = avg / range;
        
        // Map average volume (0-255) to glow intensity
        // Amplify the effect
        const intensity = avg / 255;
        
        // Base glow + dynamic glow
        glowSize = 20 + (intensity * 100); 
        centerOpacity = 0.8 + (intensity * 0.2);
    }
    
    if (halEye) {
        halEye.style.boxShadow = `0 0 ${glowSize}px #ff0000`;
        const pupil = halEye.querySelector('.hal-pupil');
        if (pupil) {
            pupil.style.opacity = centerOpacity;
            pupil.style.boxShadow = `0 0 ${glowSize/2}px #fff`;
        }
    }
}

startBtn.addEventListener('click', startAssistant);
stopBtn.addEventListener('click', stopAssistant);

// --- PTT Listeners ---
const handleTalkStart = (e) => {
    e.preventDefault(); // Prevent text selection/context menu
    isTalkPressed = true;
    talkBtn.classList.add('active'); // Add active style
    log("Listening...");

    if (socket && socket.readyState === WebSocket.OPEN) {
        // Send a message with activityStart to signal start of audio input
        const msg = {
            realtimeInput: {
                mediaChunks: [],
                activityStart: {}
            }
        };
        socket.send(JSON.stringify(msg));
    }
};

const handleTalkEnd = (e) => {
    e.preventDefault();
    isTalkPressed = false;
    talkBtn.classList.remove('active'); // Remove active style
    log("Processing response..."); 
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        // Send a message with activityEnd to signal end of audio input
        // This is valid when automaticActivityDetection is disabled
        const msg = {
            realtimeInput: {
                mediaChunks: [],
                activityEnd: {}
            }
        };
        socket.send(JSON.stringify(msg));
    }
};

talkBtn.addEventListener('mousedown', handleTalkStart);
talkBtn.addEventListener('touchstart', handleTalkStart);

talkBtn.addEventListener('mouseup', handleTalkEnd);
talkBtn.addEventListener('touchend', handleTalkEnd);
talkBtn.addEventListener('mouseleave', handleTalkEnd); // Handle dragging off button
