const WebSocket = require('ws');

const apiKey = process.env.GEMINI_API_KEY;
const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  const setupMsg = {
    setup: {
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Puck",
            },
          },
        },
      }
    }
  };
  ws.send(JSON.stringify(setupMsg));
});

ws.on('message', (data) => {
  console.log("Received snippet:", data.toString().substring(0, 100));
});

ws.on('close', (code, reason) => {
  console.log("Closed:", code, reason.toString());
  process.exit(1);
});
