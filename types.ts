
export type Language = 'English' | 'Hindi';

export type Subject = 
  | 'Mathematics' 
  | 'Hindi' 
  | 'English' 
  | 'Science' 
  | 'Social Science' 
  | 'Computer' 
  | 'General Knowledge';

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
