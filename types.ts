
export type Language = 'English' | 'Hindi';

export type Subject = 
  | 'Mathematics' 
  | 'Hindi' 
  | 'English' 
  | 'Sanskrit' 
  | 'Science' 
  | 'Social Science' 
  | 'Computer' 
  | 'General Knowledge';

export type Region = 'Original' | 'Rajasthani';

export type BackgroundType = 
  | 'Spiral Notebook'
  | 'Drawing Sheet'
  | 'Poster' 
  | 'Canvas'
  | 'Elegant Frame'
  | 'Old Book Page';

export type WorkshopMode = 'Standard' | 'Group Photo';

export type Season = 'None' | 'Monsoon' | 'Diwali' | 'Holi' | 'Winter';

export type ImageFormat = 'Standard' | 'WhatsApp DP' | 'WhatsApp Status' | 'Instagram Image' | 'Facebook Image';

export type Gender = 'man' | 'woman' | 'both';

export type TransformationType = 'Standard' | 'Best Matching';

export type Ornament = 
  | 'Maang Tikka' 
  | 'Nath (Nose Ring)' 
  | 'Jhumka (Earrings)' 
  | 'Haar (Necklace)' 
  | 'Bangles' 
  | 'Bajuband' 
  | 'Kamarpatti' 
  | 'Payal';

export interface ExplanationResponse {
  spokenStyle: string;
  writtenStyle: {
    topicName: string;
    simpleMeaning: string;
    stepByStep: string[];
    easyExample: string;
    shortSummary: string;
  };
}
