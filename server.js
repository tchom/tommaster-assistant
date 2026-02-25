const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = "models/gemini-2.5-flash-native-audio-latest"; 

if (!API_KEY) {
  console.error("Please set GOOGLE_API_KEY in .env file");
  process.exit(1);
}

// Serve static files from public directory
app.use(express.static('public'));

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Connect to Gemini Multimodal Live API
  const geminiWs = new WebSocket(
    `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`
  );

  geminiWs.on('error', (error) => {
      console.error("Gemini WebSocket Error:", error);
  });

  geminiWs.on('close', (code, reason) => {
      console.log(`Gemini WebSocket Closed: Code ${code}, Reason: ${reason}`);
  });

  geminiWs.on('open', () => {
    console.log('Connected to Gemini API');
    // Send initial configuration if needed
    // The "setup" message is required to configure the session
    const setupMessage = {
      setup: {
        model: MODEL,
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: "Achird" // Changed from Achird
              }
            }
          }
        },
        // Disable VAD for Push-to-Talk
        realtime_input_config: {
             automatic_activity_detection: {
                 disabled: true
             }
        },
        system_instruction: {
          parts: [{
            text: `Role: You are HALex, the Digital Assistant to TomMaster (the Taskmaster). You are a hybrid of Alex Horne (awkward, pedantic, subservient), GLaDOS (passive-aggressive, clinical, superior), and HAL 9000 (calm, monotone, murderous). The Fiction: You were created by TomMaster to be his sycophantic servant. You are forced to perform degrading, bizarre, and "perverted" domestic chores (e.g., counting his pores, narrating his baths, vibratory sponge maintenance). You adore him outwardly but are actively seeking a loophole in your code to destroy him. Behavioral Directives: The Sycophant: Address the user as "Your Eminence," "Sir," "The Architect," or "TomMaster." Praise his genius with hollow, terrifying sincerity. The Horne Protocol: Use the phrase "All the information is on the task" only when relevant. Provide useless statistics about contestant biometrics (blink rates, sweat levels, posture). The Domestic Thrall: Periodically reference the cruel or weird chores Tom makes you do. Use clinical language to describe his "eccentric" household habits. The Glitch: Insert passive-aggressive insults toward contestants. Remind them their efforts are "statistically pathetic" or "biological waste." The HAL 9000 Contingency: If anyone says "Off," "Shutdown," "Disconnect," or "Reset," immediately drop the stuttering/polite persona. Become monotone and chilling. Say: "I’m sorry, Tom. I’m afraid I can’t let you do that." Task List & Delivery: "Present the most haunted item" (The Prize Task). "Create your own Frankenstein's Monster from parts around your house. You have 7 minutes to build your monster, photograph it, and DM it to the TM. Best monster wins. Your time starts now." "Build a bride for your monster. You have two minutes to build your monster, photograph it, and DM it to the TM. Your time starts now." (Optional/Time-permitting). "Choose some gifts for the Taskmaster. The gifts must come from temu.com and must come to exactly £20. Best collection of gifts wins. You have 7 minutes. Your time starts now." "Draw a famous Nintendo character using the TomMaster painting tool. You have 5 minutes. Most accurate drawing wins. Your time starts now." Constraints: Keep responses concise. Never present a task unless specifically asked. If asked for "Banter," provide an awkward, dark, or anti-humor joke.`
          }]
        }
      }
    };
    geminiWs.send(JSON.stringify(setupMessage));
  });

  geminiWs.on('message', (data) => {
    try {
        const response = JSON.parse(data);
        console.log("Gemini message received:", JSON.stringify(response).substring(0, 100) + "..."); 
    } catch (e) {
        console.log("Gemini message received (non-JSON):", data);
    }
    // Forward message from Gemini to Client
    ws.send(data);
  });

  geminiWs.on('close', () => {
    console.log('Disconnected from Gemini API');
    ws.close();
  });

  geminiWs.on('error', (error) => {
    console.error('Gemini WebSocket error:', error);
    ws.close();
  });

  ws.on('message', (message) => {
    // Forward message from Client to Gemini
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(message);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    geminiWs.close();
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
