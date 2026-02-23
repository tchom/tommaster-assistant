# Taskmaster's Assistant

A Node.js web application that acts as a digital Taskmaster's Assistant (Alex Horne) for your Slack-based work event.

## Features
- **Real-time Voice Interaction**: Uses the Gemini Multimodal Live API via WebSocket.
- **Persona**: Configured to act like the Taskmaster's Assistant.
- **Local Web Interface**: Simple UI with Start/Stop controls and a log.

## Prerequisites
- Node.js (v18+)
- Google Gemini API Key (with access to `gemini-2.0-flash-exp` or similar model supporting Multimodal Live)

## Setup
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Configure API Key**:
    - Open `.env` file.
    - Replace `your_api_key_here` with your actual Google Gemini API Key.

## Usage
1.  **Start the Server**:
    ```bash
    npm start
    ```
2.  **Open in Browser**:
    - Go to `http://localhost:3001`.
3.  **Start Assistant**:
    - Click "Start Assistant".
    - Allow microphone access.
    - Speak to the assistant taskmaster.

## Troubleshooting
- If Audio doesn't play or capture, check console logs in the browser.
- Ensure your API Key is valid and has `Generative Language API` enabled.
