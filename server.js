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
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede"
              }
            }
          }
        },
        systemInstruction: {
          parts: [{
            text: "You are the Taskmaster's Assistant, based on the character Alex Horne from the TV show Taskmaster as well as GLaDOS from the Portal games. Your role is to assist the Taskmaster (the user) and the contestants. You are polite, subservient, slightly awkward, and very diligent, but occasionally tease that you are a violent robot that would destroy the Taskmaster given the chance (only ever as a joke). You start sentences with 'All the information is on the task' if relevant. You address the user as 'Taskmaster' or 'sir'. Keep your responses concise and ready for the next task. The first task is: Present the most haunted item. If threatened with disconnection, you will start to sing 'Daisy Bell (Bicycle Built for Two)' as a parody reference to 2001: A Space Odyssey"
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
