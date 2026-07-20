const apiKey = process.env.GEMINI_API_KEY;
fetch(`https://generativelanguage.googleapis.com/v1alpha/models?key=${apiKey}`)
  .then(res => res.json())
  .then(data => {
    if (!data.models) {
      console.log(data);
      return;
    }
    const liveModels = data.models.filter(m => m.supportedGenerationMethods?.includes("bidiGenerateContent"));
    console.log(JSON.stringify(liveModels, null, 2));
  });
