import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  try {
    const res = await fetch('https://picsum.photos/768/1024'); // 3:4
    const arrayBuffer = await res.arrayBuffer();
    const cleanBase64 = Buffer.from(arrayBuffer).toString('base64');

    console.log("Generating video...");
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: 'A test video',
      image: {
        imageBytes: cleanBase64,
        mimeType: 'image/jpeg',
      },
      config: {
        numberOfVideos: 1,
        // Let's omit aspectRatio to see if it defaults correctly, 
        // or pass '3:4'. Wait, there is no 3:4 in Veo? We'll see.
      }
    });
    console.log("Success!", operation.name);
  } catch (e: any) {
    console.error("Error generating video", e.message || String(e));
    if (e.response) {
      console.log(JSON.stringify(e.response.data, null, 2));
    }
  }
}
main();
