
import React, { useState, useRef, ChangeEvent } from 'react';
import { Language, Subject, ExplanationResponse } from './types';
import { getTeacherExplanation, getTeacherSpeech } from './services/geminiService';

// Audio Utility Functions
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('English');
  const [subject, setSubject] = useState<Subject>('Mathematics');
  const [inputText, setInputText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<ExplanationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const stopTeacherSpeech = () => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        console.warn("Audio already stopped");
      }
      currentSourceRef.current = null;
    }
    setIsPlaying(false);
    setAudioLoading(false);
  };

  const handleAsk = async () => {
    if (!inputText && !image) {
      setError("Please type a question or upload a photo of your book, beta.");
      return;
    }

    stopTeacherSpeech();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await getTeacherExplanation(language, subject, inputText, image || undefined);
      setResult(response);
    } catch (err) {
      setError("Oh ho! Something went wrong. Let's try again, okay?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const playTeacherFullNarration = async () => {
    if (!result || audioLoading || isPlaying) return;
    
    setAudioLoading(true);
    setError(null);
    
    try {
      const intro = result.spokenStyle;
      const topic = `The topic for today is ${result.writtenStyle.topicName}.`;
      const meaning = `It means: ${result.writtenStyle.simpleMeaning}.`;
      const stepsHeader = `Let's break it down into steps.`;
      const steps = result.writtenStyle.stepByStep.join(". ");
      const example = `Here is an easy example: ${result.writtenStyle.easyExample}.`;
      const summary = `To sum it up: ${result.writtenStyle.shortSummary}`;

      const fullText = `${intro} ${topic} ${meaning} ${stepsHeader} ${steps} ${example} ${summary}`;
      const cleanText = fullText.replace(/\s+/g, ' ').trim();

      const base64Audio = await getTeacherSpeech(cleanText);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const bytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(bytes, ctx, 24000, 1);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsPlaying(false);
        setAudioLoading(false);
        currentSourceRef.current = null;
      };
      
      currentSourceRef.current = source;
      source.start();
      setIsPlaying(true);
      setAudioLoading(false);
    } catch (err: any) {
      console.error("Narration Playback error:", err);
      setError(err.message || "Teacher's voice is having some trouble beta. Please try again!");
      setAudioLoading(false);
      setIsPlaying(false);
    }
  };

  const subjects: { name: Subject; icon: string; color: string }[] = [
    { name: 'Mathematics', icon: 'fa-calculator', color: 'bg-orange-100 text-orange-600' },
    { name: 'Science', icon: 'fa-flask', color: 'bg-blue-100 text-blue-600' },
    { name: 'Hindi', icon: 'fa-language', color: 'bg-red-100 text-red-600' },
    { name: 'English', icon: 'fa-book', color: 'bg-purple-100 text-purple-600' },
    { name: 'Social Science', icon: 'fa-globe', color: 'bg-green-100 text-green-600' },
    { name: 'Computer', icon: 'fa-laptop', color: 'bg-indigo-100 text-indigo-600' },
    { name: 'General Knowledge', icon: 'fa-lightbulb', color: 'bg-yellow-100 text-yellow-600' },
  ];

  return (
    <div className="min-h-screen bg-orange-50/30 font-sans pb-12">
      <header className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 p-6 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-md">
              <i className="fas fa-chalkboard-teacher text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My Teacher app</h1>
              <p className="text-indigo-100 text-sm">Learning is fun with Didi!</p>
            </div>
          </div>
          
          <div className="student-badge px-5 py-2 rounded-2xl flex items-center gap-3 border border-white/30">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-indigo-900 font-bold border-2 border-white shadow-sm">
              AY
            </div>
            <div className="text-left">
              <p className="font-bold text-sm leading-none">Astha Yadav</p>
              <p className="text-xs text-indigo-100 mt-1">Class - 5</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto mt-8 px-4 space-y-8">
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
          <div className="p-6 md:p-10 space-y-8">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <i className="fas fa-language text-indigo-500"></i>
                  Preferred Language
                </label>
                <div className="flex p-1 bg-gray-100 rounded-2xl">
                  {(['English', 'Hindi'] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${
                        language === lang 
                          ? 'bg-white text-indigo-600 shadow-md transform scale-[1.02]' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <i className="fas fa-book text-orange-500"></i>
                  Select Subject
                </label>
                <div className="relative">
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as Subject)}
                    className="w-full py-3.5 px-4 bg-gray-100 border-none rounded-2xl font-bold text-gray-700 focus:ring-2 focus:ring-indigo-400 outline-none appearance-none cursor-pointer"
                  >
                    {subjects.map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <i className="fas fa-chevron-down"></i>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <i className="fas fa-pencil-alt text-purple-500"></i>
                Ask me a question from your book
              </label>
              <div className="relative group">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ex: What is a noun? or Paste a math question..."
                  className="w-full h-40 p-6 rounded-[2rem] border-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-400 focus:ring-0 transition-all text-lg resize-none shadow-inner"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    ref={fileInputRef}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full py-4 px-6 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-3 font-bold bg-white"
                  >
                    <i className="fas fa-camera-retro text-2xl"></i>
                    {image ? 'Change Photo' : 'Upload Book Photo'}
                  </button>
                </div>
                <button
                  onClick={handleAsk}
                  disabled={loading}
                  className="flex-[1.5] py-4 px-8 rounded-2xl bg-indigo-600 text-white font-bold text-xl shadow-lg hover:bg-indigo-700 disabled:bg-gray-300 transition-all active:scale-95 transform flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-brain fa-spin"></i>
                      <span>Thinking...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sparkles"></i>
                      <span>Ask Didi ✨</span>
                    </>
                  )}
                </button>
              </div>

              {image && (
                <div className="inline-block relative p-2 bg-white rounded-2xl shadow-md border-2 border-indigo-100 animate-in zoom-in duration-300">
                  <img src={image} alt="Preview" className="w-24 h-24 object-cover rounded-xl" />
                  <button 
                    onClick={() => setImage(null)}
                    className="absolute -top-3 -right-3 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100 animate-in slide-in-from-top duration-300">
            <i className="fas fa-exclamation-triangle text-xl"></i>
            <p className="font-bold">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
            <div className="bg-indigo-50 rounded-[2.5rem] p-6 md:p-10 border border-indigo-100 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <i className="fas fa-quote-right text-8xl text-indigo-600"></i>
              </div>
              
              <div className="relative z-10 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-md border border-indigo-100">
                      👩‍🏫
                    </div>
                    <div>
                      <h3 className="font-bold text-indigo-900 text-2xl">{result.writtenStyle.topicName}</h3>
                      <p className="text-indigo-600 font-bold px-3 py-1 bg-white rounded-full inline-block text-xs mt-1 uppercase tracking-wider">
                        Subject: {subject}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {isPlaying ? (
                      <button
                        onClick={stopTeacherSpeech}
                        className="flex items-center gap-2 py-3 px-6 rounded-2xl font-bold shadow-md transition-all bg-red-500 text-white hover:bg-red-600 active:scale-95"
                      >
                        <i className="fas fa-stop-circle"></i>
                        Stop Didi
                      </button>
                    ) : (
                      <button
                        onClick={playTeacherFullNarration}
                        disabled={audioLoading}
                        className={`flex items-center gap-2 py-3 px-6 rounded-2xl font-bold shadow-md transition-all ${
                          audioLoading 
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                            : 'bg-green-500 text-white hover:bg-green-600 active:scale-95'
                        }`}
                      >
                        <i className={`fas ${audioLoading ? 'fa-spinner fa-spin' : 'fa-volume-up'}`}></i>
                        {audioLoading ? 'Voice Loading...' : 'Listen to Didi'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-white rounded-[2rem] shadow-sm border border-indigo-50 leading-relaxed italic text-lg text-indigo-800">
                  "{result.spokenStyle}"
                </div>

                <div className="grid gap-8 mt-8">
                  <div className="bg-white/60 p-6 rounded-3xl border border-white/50">
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-lg">
                      <i className="fas fa-info-circle text-blue-500"></i>
                      What does it mean?
                    </h4>
                    <p className="text-lg leading-relaxed text-gray-700">{result.writtenStyle.simpleMeaning}</p>
                  </div>

                  <div className="bg-white/60 p-6 rounded-3xl border border-white/50">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                      <i className="fas fa-list-check text-indigo-500"></i>
                      Step-by-step:
                    </h4>
                    <div className="space-y-4">
                      {result.writtenStyle.stepByStep.map((step, idx) => (
                        <div key={idx} className="flex gap-4 items-start">
                          <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-sm font-bold shadow-sm">
                            {idx + 1}
                          </span>
                          <span className="text-gray-700 text-lg leading-snug pt-1">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-yellow-50 rounded-3xl border border-yellow-100 shadow-sm">
                      <h4 className="font-bold text-yellow-800 mb-2 flex items-center gap-2 text-lg">
                        <i className="fas fa-lightbulb text-yellow-500"></i>
                        Easy Example
                      </h4>
                      <p className="text-yellow-900 text-lg font-medium">{result.writtenStyle.easyExample}</p>
                    </div>

                    <div className="p-6 bg-green-50 rounded-3xl border border-green-100 shadow-sm">
                      <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2 text-lg">
                        <i className="fas fa-check-double text-green-500"></i>
                        Remember this!
                      </h4>
                      <p className="text-green-900 text-lg">{result.writtenStyle.shortSummary}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center pb-8">
              <button 
                onClick={() => {
                  stopTeacherSpeech();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setInputText('');
                  setImage(null);
                  setResult(null);
                }}
                className="py-4 px-10 bg-white border-2 border-indigo-100 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-50 transition-all shadow-md inline-flex items-center gap-3"
              >
                <i className="fas fa-plus-circle"></i>
                Teach me more, Didi!
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 text-center">
        <div className="pt-8 border-t border-gray-200">
          <p className="text-gray-400 font-bold text-sm tracking-wide uppercase">
            My Teacher app • Made for Astha Yadav 💖
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
