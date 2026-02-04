
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, Subject } from "../types";

export const getTeacherExplanation = async (
  language: Language,
  subject: Subject,
  text: string,
  imageBuffer?: string // Base64
) => {
  // Fix: Use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    You are a caring and expert Indian school teacher (Didi or Masterji) for Class 5 students (Age 9-11).
    Your goal is to explain educational topics in a very simple, friendly way using Indian daily life examples.
    
    Current Subject: ${subject}
    Preferred Language: ${language}
    
    Role Guidelines:
    1. Language: If Hindi is selected, explain in simple, clear Hindi. If English, use simple English.
    2. Context: Use examples from Indian homes, schools, villages, or cities.
    3. Tone: Polite, encouraging, patient, and motivating.
    
    Output JSON format only:
    {
      "spokenStyle": "A friendly conversational explanation as if you are speaking to the student.",
      "writtenStyle": {
        "topicName": "Name of the topic",
        "simpleMeaning": "Intro in 1-2 easy sentences",
        "stepByStep": ["Step 1", "Step 2", "..."],
        "easyExample": "Relatable example",
        "shortSummary": "2-3 lines of summary"
      }
    }
  `;

  const parts: any[] = [{ text: `Topic/Homework: ${text || "Please explain the content in the image"}` }];
  if (imageBuffer) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBuffer.split(',')[1] || imageBuffer
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            spokenStyle: { type: Type.STRING },
            writtenStyle: {
              type: Type.OBJECT,
              properties: {
                topicName: { type: Type.STRING },
                simpleMeaning: { type: Type.STRING },
                stepByStep: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                easyExample: { type: Type.STRING },
                shortSummary: { type: Type.STRING }
              },
              required: ["topicName", "simpleMeaning", "stepByStep", "easyExample", "shortSummary"]
            }
          },
          required: ["spokenStyle", "writtenStyle"]
        }
      }
    });

    // Fix: response.text is a property, not a method
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const getTeacherSpeech = async (text: string) => {
  // Fix: Use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // Using a warm, friendly voice
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    if (!response.candidates?.[0]?.content?.parts) {
       throw new Error("The teacher couldn't speak right now. No response received.");
    }

    const audioPart = response.candidates[0].content.parts.find(p => p.inlineData && p.inlineData.data);
    
    if (!audioPart || !audioPart.inlineData) {
       throw new Error("Audio data was missing from the teacher's response.");
    }

    return audioPart.inlineData.data;
  } catch (error) {
    console.error("TTS Service Error:", error);
    throw error;
  }
};
