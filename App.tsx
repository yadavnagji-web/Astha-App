import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Language, Subject, ExplanationResponse } from './types';
import { getTeacherExplanation, getTeacherSpeech, getTeacherDiagram } from './services/aiService';

// Audio Decoding Utilities for Gemini raw PCM
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
  const dataInt16 = new Int16Array(data.buffer);
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
  const [inputText, setInputText] = useState<string>('');
  const [image, setImage] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [audioLoading, setAudioLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [result, setResult] = useState<ExplanationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setError(null);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setError("Please allow camera access beta.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      setImage(canvas.toDataURL('image/jpeg'));
      stopCamera();
    }
  };

  const stopTeacherSpeech = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleAsk = async () => {
    const trimmedInput = inputText.trim();
    if (!trimmedInput && !image) {
      setError("Please type something or take a photo, beta.");
      return;
    }

    stopTeacherSpeech();
    setLoading(true);
    setError(null);
    setResult(null);
    setDiagram(null);

    try {
      const response = await getTeacherExplanation(language, subject, trimmedInput, image);
      setResult(response);
      
      // Also generate a diagram based on the topic
      try {
        const diagramImg = await getTeacherDiagram(response.writtenStyle.topicName);
        setDiagram(diagramImg);
      } catch (diagErr) {
        console.warn("Diagram generation skipped:", diagErr);
      }
      
    } catch (err: any) {
      setError("Oh ho! Gemini API is busy. Let's try once more!");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const playTeacherFullNarration = async () => {
    if (!result || isPlaying) return;
    
    setAudioLoading(true);
    try {
      const { spokenStyle, writtenStyle } = result;
      // "Pura padhe": Full sequence of content
      const fullContentToRead = `
        ${spokenStyle}. 
        Today we are learning about ${writtenStyle.topicName}. 
        In simple words, ${writtenStyle.simpleMeaning}. 
        Let me tell you the steps. ${writtenStyle.stepByStep.join(". ")}. 
        For example, ${writtenStyle.easyExample}. 
        To summarize: ${writtenStyle.shortSummary}.
      `;
      
      const base64Audio = await getTeacherSpeech(fullContentToRead);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      const bytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(bytes, ctx, 24000, 1);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      
      audioSourceRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
      setError("Teacher's voice is tired. Please try again later!");
    } finally {
      setAudioLoading(false);
    }
  };

  const subjects: { name: Subject; icon: string }[] = [
    { name: 'Mathematics', icon: 'fa-calculator' },
    { name: 'Science', icon: 'fa-flask' },
    { name: 'Hindi', icon: 'fa-language' },
    { name: 'English', icon: 'fa-book' },
    { name: 'Social Science', icon: 'fa-globe' },
    { name: 'Computer', icon: 'fa-laptop' },
    { name: 'General Knowledge', icon: 'fa-lightbulb' },
  ];

  return (
    <div className="min-h-screen bg-orange-50/30 font-sans pb-12">
      <header className="bg-gradient-to-r from-indigo-600 to-blue-700 p-6 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-md">
              <i className="fas fa-chalkboard-teacher text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Class 5 Guru</h1>
              <p className="text-indigo-100 text-sm">Learning is Fun with Didi!</p>
            </div>
          </div>
          <div className="student-badge px-5 py-2 rounded-2xl flex items-center gap-3 border border-white/30">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-indigo-900 font-bold border-2 border-white shadow-sm">AY</div>
            <div className="text-left">
              <p className="font-bold text-sm leading-none">Astha Yadav</p>
              <p className="text-xs text-indigo-100 mt-1">Class - 5</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto mt-8 px-4 space-y-8">
        <div className="bg-white rounded-[2.5rem] shadow-xl p-6 md:p-10 border border-gray-100">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <i className="fas fa-language text-indigo-500"></i> Language
              </label>
              <div className="flex p-1 bg-gray-100 rounded-2xl">
                {(['English', 'Hindi'] as Language[]).map((lang) => (
                  <button key={lang} onClick={() => setLanguage(lang)} className={`flex-1 py-2 px-4 rounded-xl font-bold transition-all ${language === lang ? 'bg-white text-indigo-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <i className="fas fa-book text-orange-500"></i> Subject
              </label>
              <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)} className="w-full py-3 px-4 bg-gray-100 border-none rounded-2xl font-bold text-gray-700 outline-none cursor-pointer hover:bg-gray-200 transition-colors">
                {subjects.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <i className="fas fa-pencil-alt text-purple-500"></i> Your Question
            </label>
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type here or take a photo of your book..." className="w-full h-32 p-6 rounded-[2rem] bg-gray-50 border-2 border-gray-100 focus:border-indigo-400 outline-none transition-all text-lg resize-none shadow-inner" />
            
            <div className="flex flex-wrap gap-4">
              <button onClick={startCamera} className="flex-1 py-4 px-6 rounded-2xl bg-white border-2 border-indigo-100 text-indigo-600 font-bold flex items-center justify-center gap-3 shadow-sm hover:bg-indigo-50 active:scale-95 transition-transform">
                <i className="fas fa-camera"></i> Take Photo
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 px-6 rounded-2xl bg-white border-2 border-indigo-100 text-indigo-600 font-bold flex items-center justify-center gap-3 shadow-sm hover:bg-indigo-50 active:scale-95 transition-transform">
                <i className="fas fa-image"></i> Gallery
              </button>
              <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} className="hidden" />
              
              <button onClick={handleAsk} disabled={loading} className="w-full py-4 px-8 rounded-2xl bg-indigo-600 text-white font-bold text-xl shadow-lg hover:bg-indigo-700 disabled:bg-gray-300 flex items-center justify-center gap-3 active:scale-[0.98] transition-all">
                {loading ? <><i className="fas fa-brain fa-spin"></i> Didi is thinking...</> : <><i className="fas fa-sparkles"></i> Ask Didi ✨</>}
              </button>
            </div>

            {image && !isCameraOpen && (
              <div className="inline-block relative p-2 bg-white rounded-2xl shadow-md border-2 border-indigo-100 animate-in mt-4">
                <img src={image} alt="Preview" className="w-32 h-32 object-cover rounded-xl" />
                <button onClick={() => setImage(null)} className="absolute -top-3 -right-3 bg-red-500 text-white w-8 h-8 rounded-full shadow-md flex items-center justify-center"><i className="fas fa-times"></i></button>
              </div>
            )}
          </section>
        </div>

        {isCameraOpen && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-lg aspect-[3/4] video-container shadow-2xl overflow-hidden bg-gray-900">
              <video ref={videoRef} autoPlay playsInline muted />
              <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 px-4">
                <button onClick={stopCamera} className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full text-white text-2xl border border-white/30"><i className="fas fa-times"></i></button>
                <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full text-indigo-600 text-3xl shadow-xl border-4 border-white active:scale-90 transition-transform"><i className="fas fa-camera"></i></button>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100 animate-in shadow-sm"><i className="fas fa-exclamation-triangle"></i><p className="font-bold">{error}</p></div>}

        {result && (
          <div className="space-y-8 animate-in pb-20">
            <div className="bg-indigo-50 rounded-[2.5rem] p-6 md:p-10 border border-indigo-100 shadow-xl relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="text-4xl filter drop-shadow-sm">👩‍🏫</div>
                  <div>
                    <h3 className="font-bold text-indigo-900 text-2xl">{result.writtenStyle.topicName}</h3>
                    <p className="text-indigo-600 font-bold text-xs uppercase tracking-wider">Class 5 • {subject}</p>
                  </div>
                </div>
                <button onClick={isPlaying ? stopTeacherSpeech : playTeacherFullNarration} disabled={audioLoading} className={`flex items-center gap-2 py-3 px-6 rounded-2xl font-bold shadow-md transition-all active:scale-95 ${isPlaying ? 'bg-red-500 text-white animate-pulse' : 'bg-green-500 text-white hover:bg-green-600'} disabled:opacity-50`}>
                  <i className={`fas ${audioLoading ? 'fa-spinner fa-spin' : isPlaying ? 'fa-stop-circle' : 'fa-volume-up'}`}></i>
                  {audioLoading ? 'Didi is reading...' : isPlaying ? 'Stop' : 'Listen to Full Lesson'}
                </button>
              </div>

              <div className="p-6 bg-white rounded-[2rem] shadow-sm italic text-lg text-indigo-800 border border-indigo-50 mb-8 leading-relaxed border-l-4 border-l-indigo-400">
                "{result.spokenStyle}"
              </div>

              <div className="grid gap-6 relative z-10">
                {/* Generated Diagram Section */}
                {diagram && (
                  <div className="bg-white rounded-3xl p-4 shadow-sm border border-indigo-100 overflow-hidden">
                    <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                      <i className="fas fa-pencil-ruler text-indigo-500"></i> Visual Diagram
                    </h4>
                    <img src={diagram} alt="Lesson Diagram" className="w-full rounded-2xl border border-gray-100 shadow-inner" />
                    <p className="text-xs text-gray-400 mt-2 text-center italic">Drawing made by Didi to help you understand!</p>
                  </div>
                )}

                <div className="bg-white/60 p-6 rounded-3xl border border-white/40 shadow-sm transition-all hover:bg-white/80">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <i className="fas fa-info-circle text-blue-500"></i> What does it mean?
                  </h4>
                  <p className="text-lg text-gray-700 leading-relaxed">{result.writtenStyle.simpleMeaning}</p>
                </div>

                <div className="bg-white/60 p-6 rounded-3xl border border-white/40 shadow-sm transition-all hover:bg-white/80">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <i className="fas fa-list-ol text-green-500"></i> Steps to remember:
                  </h4>
                  <div className="space-y-4">
                    {result.writtenStyle.stepByStep.map((s, i) => (
                      <div key={i} className="flex gap-4 group">
                        <span className="bg-indigo-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold mt-1 flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">{i+1}</span>
                        <span className="text-gray-700 text-lg leading-snug">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-yellow-50 rounded-3xl border border-yellow-100 shadow-sm transition-all hover:shadow-md">
                    <h4 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                      <i className="fas fa-lightbulb"></i> Daily Example:
                    </h4>
                    <p className="text-yellow-900 font-medium leading-relaxed">{result.writtenStyle.easyExample}</p>
                  </div>
                  <div className="p-6 bg-green-50 rounded-3xl border border-green-100 shadow-sm transition-all hover:shadow-md">
                    <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                      <i className="fas fa-check-circle"></i> In short:
                    </h4>
                    <p className="text-green-900 leading-relaxed">{result.writtenStyle.shortSummary}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center pb-8">
              <button 
                onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setResult(null); setImage(null); setDiagram(null); setInputText(''); }}
                className="py-4 px-10 bg-white border-2 border-indigo-100 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-50 transition-all shadow-md inline-flex items-center gap-2 active:scale-95"
              >
                <i className="fas fa-redo"></i> Teach me another topic, Didi!
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;