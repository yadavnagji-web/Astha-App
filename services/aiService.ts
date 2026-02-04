import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, Subject, ExplanationResponse } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getTeacherExplanation = async (
  language: Language,
  subject: Subject,
  text: string,
  imageBuffer: string | null = null
): Promise<ExplanationResponse> => {
  const ai = getAI();
  const systemInstruction = `
    You are a caring and expert Indian school teacher (Didi or Masterji) for Class 5 students (Age 9-11).
    Your goal is to explain educational topics in a very simple, friendly way using Indian daily life examples.
    
    Current Subject: ${subject}
    Preferred Language: ${language}
    
    Role Guidelines:
    1. Language: Explain in ${language}. If Hindi, use simple Hindi words kids understand.
    2. Context: Use examples from Indian homes, schools, or villages.
    3. Tone: Polite, encouraging, and patient.
    
    Output strictly in JSON format only.
  `;

  const parts: any[] = [{ text: `Topic/Question: ${text || "Please explain what is in the image"}` }];
  
  if (imageBuffer) {
    const base64Data = imageBuffer.split(',')[1];
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data
      }
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          spokenStyle: { type: Type.STRING, description: "A conversational greeting and explanation." },
          writtenStyle: {
            type: Type.OBJECT,
            properties: {
              topicName: { type: Type.STRING },
              simpleMeaning: { type: Type.STRING },
              stepByStep: { type: Type.ARRAY, items: { type: Type.STRING } },
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

  return JSON.parse(response.text) as ExplanationResponse;
};

export const getTeacherSpeech = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this aloud like a kind Indian school teacher teaching a class: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, 
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Could not generate teacher's voice.");
  return base64Audio;
};

export const getTeacherDiagram = async (topic: string): Promise<string> => {
  const ai = getAI();
  const prompt = `A simple, colorful educational diagram for a 10-year-old student about "${topic}". 
  Style: Hand-drawn classroom blackboard style with clear labels in English. 
  Bright colors, friendly illustrations, easy to understand. No complex text.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      imageConfig: {
        aspectRatio: "4:3"
      }
    }
  });

  let imageUrl = "";
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageUrl) throw new Error("Could not create diagram.");
  return imageUrl;
};
