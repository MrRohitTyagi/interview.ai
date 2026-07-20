const WebSocket = require('ws');

const apiKey = process.env.GEMINI_API_KEY;
const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  const dynamicInstruction = "You are an interviewer.";
  const setupMsg = {
    setup: {
      model: "models/gemini-2.5-flash-native-audio-latest",
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Puck",
            },
          },
        },
      },
      systemInstruction: {
        parts: [{ text: dynamicInstruction }],
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: "record_turn",
              description: "Records the question you just asked.",
              parameters: {
                type: "OBJECT",
                properties: {
                  nextQuestion: { type: "STRING" },
                  topic: { type: "STRING" },
                },
                required: ["nextQuestion", "topic"],
              },
            },
          ],
        },
      ],
    }
  };
  ws.send(JSON.stringify(setupMsg));
});

ws.on('message', (data) => {
  let text = data.toString();
  try {
    const msg = JSON.parse(text);
    if (msg.setupComplete || msg.setup_complete) {
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: "user",
            parts: [{text: "Hello! Please ask me a question."}]
          }],
          turnComplete: true
        }
      }));
    }
    const serverContent = msg.serverContent || msg.server_content;
    if (serverContent) {
      const modelTurn = serverContent.modelTurn || serverContent.model_turn;
      const parts = modelTurn?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.text) {
            console.log("TEXT PART:", part.text);
          }
          if (part.inlineData) {
            console.log("AUDIO PART length:", part.inlineData.data.length);
          }
        }
      }
    }
  } catch(e) {}
});

ws.on('close', (code, reason) => {
  console.log("Closed:", code, reason.toString());
  process.exit(1);
});
