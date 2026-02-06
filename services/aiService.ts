
import { GoogleGenAI } from "@google/genai";
import { BackgroundType, Season, ImageFormat, TransformationType, Ornament } from "../types";

// Explicit initialization using process.env.API_KEY as per mandatory requirements
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AIResponse<T> {
  data: T;
  usage?: {
    totalTokenCount: number;
    promptTokenCount: number;
    candidatesTokenCount: number;
  };
}

export const getArtTransformation = async (
  imageBuffers: string[], 
  transformationType: TransformationType,
  background: BackgroundType = 'Spiral Notebook',
  season: Season = 'None',
  format: ImageFormat = 'Standard',
  ornaments: Ornament[] = []
): Promise<AIResponse<string>> => {
  const ai = getAI();
  const imageParts = imageBuffers.map(buffer => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: buffer.split(',')[1]
    }
  }));
  
  const formatMap: Record<ImageFormat, string> = {
    'Standard': '3:4',
    'WhatsApp DP': '1:1',
    'WhatsApp Status': '9:16',
    'Instagram Image': '1:1',
    'Facebook Image': '16:9'
  };

  const ornamentList = ornaments.length > 0 ? ornaments.join(", ") : "Minimal traditional jewelry";

  const prompt = `AUTHENTIC HAND-DRAWN MASTERPIECE. 
  STYLE: High-end alcohol marker and fine-liner pen illustration on ${background}. 
  TEXTURE: Visible traditional paper grain, ink bleed, and hand-sketched pen strokes. 
  IMPORTANT: ABSOLUTELY NO digital CGI effects. It must look like a physical drawing made with markers and pens.
  
  CLOTHING COLOR MATCHING: Match the colors and design of the clothing from the source photo exactly. 
  CRITICAL: DO NOT use black lines or black ink to define patterns on colorful clothes. For example, if the dress is pink, use darker pink or magenta tones for details/patterns, NOT black. Keep the colors vibrant and true to the original image.
  
  AESTHETICS: Use "Light and Happy" tones. The overall color palette should be vibrant, bright, and cheerful. Use dark colors ONLY if absolutely necessary for essential contrast.
  
  FACE & REALITY: The face must be LUMINOUS, GLOWING, and beautifully lit. REMOVE all harsh shadows from the face. The face should appear radiant and "damakta hua" (shining). Maintain 100% facial reality and likeness—the person must look like themselves, but professionally illustrated.
  
  ORNAMENTS: Render ${ornamentList} with elegant marker shading.
  SEASON: ${season === 'None' ? 'Joyful sunny lighting' : season + ' atmosphere with vibrant marker strokes'}.
  
  STRICT NO SIGNATURE: Do not write any names, signatures, watermarks, or text overlays on the image. The drawing must be completely clean.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [ ...imageParts, { text: prompt } ]
    },
    config: {
      imageConfig: {
        aspectRatio: formatMap[format] as any,
        imageSize: "4K"
      }
    }
  });

  for (const candidate of response.candidates || []) {
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return {
          data: `data:image/png;base64,${part.inlineData.data}`,
          usage: response.usageMetadata
        };
      }
    }
  }
  throw new Error("Workshop failed.");
};
