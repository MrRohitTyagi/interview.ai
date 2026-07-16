const https = require('https');
require('dotenv').config({path: '.env.local'});

const key = process.env.GEMINI_API_KEY;

function fetchModels(version) {
  const url = `https://generativelanguage.googleapis.com/${version}/models?key=${key}`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const parsed = JSON.parse(data);
      if (parsed.models) {
        const bidiModels = parsed.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('bidiGenerateContent'));
        console.log(`--- ${version} Models with bidiGenerateContent ---`);
        bidiModels.forEach(m => console.log(m.name));
      } else {
        console.log(`Error on ${version}:`, parsed);
      }
    });
  }).on('error', err => console.log("Error:", err.message));
}

fetchModels('v1alpha');
fetchModels('v1beta');
