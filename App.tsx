
import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { BackgroundType, Season, ImageFormat, TransformationType, Ornament } from './types';
import { getArtTransformation } from './services/aiService';

type View = 'home' | 'workshop' | 'how-to-use' | 'payment' | 'terms' | 'contact';
type AppMode = 'splash' | 'main';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('splash');
  const [activeView, setActiveView] = useState<View>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [artWork, setArtWork] = useState<string | null>(null);
  const [artLoading, setArtLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingLocal, setIsProcessingLocal] = useState<boolean>(false);
  const [walletBalance, setWalletBalance] = useState<number>(100); 
  const pricePerImage = 10;

  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  
  const [selectedBackground, setSelectedBackground] = useState<BackgroundType>('Drawing Sheet');
  const [selectedSeason, setSelectedSeason] = useState<Season>('None');
  const [selectedFormat, setSelectedFormat] = useState<ImageFormat>('Standard');
  const [selectedOrnaments, setSelectedOrnaments] = useState<Ornament[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (appMode === 'splash') {
      const timer = setTimeout(() => setAppMode('main'), 2500);
      return () => clearTimeout(timer);
    }
  }, [appMode]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  const navigateTo = (view: View) => {
    setActiveView(view);
    setIsSidebarOpen(false);
  };

  const handleDownloadAndReturn = (label: string) => {
    if (!artWork) return;
    const link = document.createElement('a');
    link.href = artWork;
    link.download = `DigitalPainter_Art_${label}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Return to Home Page as requested
    setArtWork(null);
    setSelectedImages([]);
    setActiveView('home');
  };

  const handleBackToHome = () => {
    setArtWork(null);
    setSelectedImages([]);
    setActiveView('home');
  };

  const toggleOrnament = (o: Ornament) => {
    setSelectedOrnaments(prev => 
      prev.includes(o) ? prev.filter(item => item !== o) : [...prev, o]
    );
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessingLocal(true);
    try {
      const processed: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((res) => {
          reader.onload = (ev) => res(ev.target?.result as string);
          reader.readAsDataURL(files[i] as Blob);
        });
        processed.push(dataUrl);
      }
      setSelectedImages(prev => [...prev, ...processed]);
    } catch (err) { setError("Error selecting images."); }
    finally { setIsProcessingLocal(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacingMode } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { setError("Camera error."); setIsCameraOpen(false); }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      setSelectedImages(prev => [...prev, canvas.toDataURL('image/jpeg', 0.85)]);
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraOpen(false);
    }
  };

  const handleCreateArt = async () => {
    if (walletBalance < pricePerImage) {
      setError("Insufficient Balance. Please top up your wallet.");
      return;
    }
    if (selectedImages.length === 0) {
      setError("Please select a photo first.");
      return;
    }
    setArtLoading(true);
    setError(null);
    try {
      const response = await getArtTransformation(
        selectedImages, 
        'Best Matching',
        selectedBackground, 
        selectedSeason,
        selectedFormat,
        selectedOrnaments
      );
      setArtWork(response.data);
      setWalletBalance(prev => prev - pricePerImage);
    } catch (err) { setError("Generation failed. Try again."); }
    finally { setArtLoading(false); }
  };

  if (appMode === 'splash') {
    return (
      <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="text-center animate-pulse">
          <div className="w-48 h-48 bg-white rounded-[4rem] shadow-2xl flex items-center justify-center mx-auto mb-10 border-4 border-pink-100">
            <i className="fas fa-palette text-pink-600 text-8xl"></i>
          </div>
          <h1 className="text-5xl font-black text-indigo-950 tracking-tighter uppercase mb-2">Digital Painter</h1>
          <p className="text-pink-600 font-bold uppercase tracking-[0.2em] text-sm">Professional AI Studio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fefcf3] flex flex-col relative overflow-x-hidden">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] transition-opacity" onClick={toggleSidebar} />
      )}

      {/* Side Navigation Panel */}
      <aside className={`fixed top-0 left-0 h-full w-80 bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <div className="font-black text-indigo-950 uppercase tracking-tighter text-xl">Menu</div>
          <button onClick={toggleSidebar} className="text-slate-400 hover:text-pink-600 text-2xl transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <nav className="p-4 flex flex-col gap-2">
          {[
            { id: 'home', label: 'Home', icon: 'fa-home' },
            { id: 'workshop', label: 'Workshop', icon: 'fa-magic' },
            { id: 'how-to-use', label: 'How To Use (कैसे उपयोग करें)', icon: 'fa-book-open' },
            { id: 'payment', label: 'Payment Details', icon: 'fa-credit-card' },
            { id: 'terms', label: 'Terms & Conditions (नियम व शर्तें)', icon: 'fa-file-contract' },
            { id: 'contact', label: 'Contact Us', icon: 'fa-envelope' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id as View)}
              className={`w-full flex items-center gap-4 p-5 rounded-3xl font-bold text-sm uppercase transition-all ${activeView === item.id ? 'bg-black text-white shadow-xl translate-x-2' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <i className={`fas ${item.icon} w-6`}></i>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Header */}
      <header className="p-6 bg-black text-white shadow-xl sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={toggleSidebar} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
            <i className="fas fa-bars text-xl"></i>
          </button>
          <div className="hidden sm:block">
            <h1 className="font-black uppercase tracking-tighter text-xl">Digital Painter</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-white/10 px-4 py-2 rounded-full border border-white/20 flex items-center gap-2">
              <i className="fas fa-wallet text-yellow-400"></i>
              <span className="font-black">₹{walletBalance}</span>
           </div>
           <button onClick={() => setWalletBalance(prev => prev + 100)} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
             <i className="fas fa-plus"></i>
           </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-5xl mx-auto w-full p-4 md:p-8">
        
        {/* VIEW: HOME */}
        {activeView === 'home' && (
          <div className="animate-in space-y-12 py-10">
            <div className="text-center space-y-6">
              <div className="inline-block px-6 py-2 bg-pink-100 text-pink-600 rounded-full text-xs font-black uppercase tracking-widest">Masterpiece Studio</div>
              <h1 className="text-6xl md:text-8xl font-black text-indigo-950 uppercase tracking-tighter leading-none">Vibrant <span className="text-pink-600">Art</span> Transformations</h1>
              <p className="text-xl text-slate-500 font-bold max-w-2xl mx-auto">Turn your photos into luminous hand-drawn illustrations with perfect color matching and radiant face lighting.</p>
              <div className="pt-8">
                <button onClick={() => navigateTo('workshop')} className="px-12 py-8 bg-black text-white rounded-[3rem] font-black text-2xl shadow-2xl hover:bg-pink-600 transition-all active:scale-95 flex items-center gap-4 mx-auto">
                  <i className="fas fa-paint-brush"></i> Start Workshop
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 text-center space-y-4">
                <div className="w-16 h-16 bg-pink-50 text-pink-600 rounded-3xl flex items-center justify-center mx-auto"><i className="fas fa-palette text-2xl"></i></div>
                <h3 className="text-xl font-black uppercase">Color Match</h3>
                <p className="text-slate-500 font-medium">Clothing designs and colors are matched perfectly without dark outlines.</p>
              </div>
              <div className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 text-center space-y-4">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto"><i className="fas fa-sun text-2xl"></i></div>
                <h3 className="text-xl font-black uppercase">Radiant Faces</h3>
                <p className="text-slate-500 font-medium">No harsh shadows. Luminous and beautiful face lighting guaranteed.</p>
              </div>
              <div className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 text-center space-y-4">
                <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-3xl flex items-center justify-center mx-auto"><i className="fas fa-image text-2xl"></i></div>
                <h3 className="text-xl font-black uppercase">Ultra HD Result</h3>
                <p className="text-slate-500 font-medium">Download in high resolution for printing or social media status.</p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: WORKSHOP */}
        {activeView === 'workshop' && (
          <div className="animate-in space-y-8">
            {artLoading ? (
              /* GENERATING SCREEN */
              <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-8">
                <div className="relative">
                  <div className="w-32 h-32 border-8 border-pink-100 border-t-pink-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-magic text-pink-600 text-2xl"></i>
                  </div>
                </div>
                <div>
                  <h2 className="text-4xl font-black text-indigo-950 uppercase tracking-tighter mb-2">Generating Art...</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Matching colors and enhancing face lighting</p>
                </div>
                <div className="max-w-xs bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Please wait. Do not close or refresh the page.</p>
                </div>
              </div>
            ) : artWork ? (
              /* RESULT SCREEN */
              <div className="space-y-10">
                <div className="flex justify-between items-center">
                   <button onClick={handleBackToHome} className="flex items-center gap-2 font-black uppercase text-slate-400 hover:text-pink-600 transition-colors">
                      <i className="fas fa-arrow-left"></i> Home Page
                   </button>
                   <div className="bg-emerald-100 text-emerald-700 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <i className="fas fa-check-circle text-lg"></i> Complete
                   </div>
                </div>

                <div className="bg-white p-6 md:p-12 rounded-[5rem] shadow-2xl border-4 border-emerald-50 text-center relative overflow-hidden">
                  <h3 className="text-4xl font-black text-indigo-950 uppercase tracking-tighter mb-10">Your Luminous Art</h3>
                  <div className="relative max-w-lg mx-auto">
                    <img src={artWork} className="w-full rounded-[4rem] shadow-2xl border-8 border-white block" alt="Result" />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
                    <button onClick={() => handleDownloadAndReturn('UltraHD')} className="group p-6 bg-black text-white rounded-[3rem] font-black shadow-xl hover:bg-pink-600 transition-all hover:-translate-y-2">
                      <i className="fas fa-crown mb-2 text-xl block"></i>
                      <span className="block text-sm">Download</span>
                      <span className="block text-lg">Ultra HD</span>
                    </button>
                    <button onClick={() => handleDownloadAndReturn('A4')} className="group p-6 bg-white border-4 border-slate-100 text-indigo-950 rounded-[3rem] font-black shadow-xl hover:border-pink-500 transition-all hover:-translate-y-2">
                      <i className="fas fa-file-alt mb-2 text-xl block text-pink-500"></i>
                      <span className="block text-sm uppercase">A4 Print</span>
                    </button>
                    <button onClick={() => handleDownloadAndReturn('DP')} className="group p-6 bg-white border-4 border-slate-100 text-indigo-950 rounded-[3rem] font-black shadow-xl hover:border-pink-500 transition-all hover:-translate-y-2">
                      <i className="fas fa-expand mb-2 text-xl block text-indigo-500"></i>
                      <span className="block text-sm">Download</span>
                      <span className="block text-lg">WhatsApp DP</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* FORM SCREEN */
              <div className="bg-white rounded-[3rem] shadow-2xl p-6 md:p-12 border border-slate-100">
                <div className="mb-10 text-center">
                  <h2 className="text-4xl font-black text-indigo-950 uppercase tracking-tighter">Workshop</h2>
                  <p className="text-slate-500 font-bold text-sm mt-2">Vibrant markers & perfect face detail</p>
                </div>

                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Background Style</label>
                    <select 
                      value={selectedBackground} 
                      onChange={(e) => setSelectedBackground(e.target.value as BackgroundType)} 
                      className="w-full py-5 px-6 bg-black text-white border-2 border-black rounded-3xl font-black text-sm appearance-none focus:ring-4 ring-pink-500/20 transition-all outline-none cursor-pointer"
                    >
                      {['Drawing Sheet', 'Spiral Notebook', 'Poster', 'Canvas', 'Elegant Frame', 'Old Book Page'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Atmosphere</label>
                    <select 
                      value={selectedSeason} 
                      onChange={(e) => setSelectedSeason(e.target.value as Season)} 
                      className="w-full py-5 px-6 bg-black text-white border-2 border-black rounded-3xl font-black text-sm appearance-none focus:ring-4 ring-pink-500/20 transition-all outline-none cursor-pointer"
                    >
                      {['None', 'Monsoon', 'Diwali', 'Holi', 'Winter'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Image Format (Ratio)</label>
                    <select 
                      value={selectedFormat} 
                      onChange={(e) => setSelectedFormat(e.target.value as ImageFormat)} 
                      className="w-full py-5 px-6 bg-black text-white border-2 border-black rounded-3xl font-black text-sm appearance-none focus:ring-4 ring-pink-500/20 transition-all outline-none cursor-pointer"
                    >
                      {['Standard', 'WhatsApp DP', 'WhatsApp Status', 'Instagram Image', 'Facebook Image'].map(fmt => <option key={fmt} value={fmt}>{fmt}</option>)}
                    </select>
                  </div>
                </section>

                <section className="mb-12 p-8 bg-pink-50/50 rounded-[3rem] border-2 border-pink-100 text-center">
                  <label className="text-[11px] font-black text-pink-800 uppercase tracking-widest mb-6 block">Add Traditional Ornaments</label>
                  <div className="flex flex-wrap justify-center gap-4">
                    {['Maang Tikka', 'Nath (Nose Ring)', 'Jhumka (Earrings)', 'Haar (Necklace)', 'Bangles'].map(o => (
                      <button 
                        key={o} 
                        onClick={() => toggleOrnament(o as Ornament)} 
                        className={`py-4 px-6 rounded-full font-black text-[12px] transition-all border-2 ${selectedOrnaments.includes(o as Ornament) ? 'bg-pink-600 border-pink-600 text-white shadow-xl' : 'bg-white border-white text-pink-900 hover:border-pink-200'}`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button onClick={startCamera} className="py-10 rounded-[3rem] bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 font-black flex flex-col items-center gap-4 hover:bg-slate-100 transition-all">
                      <i className="fas fa-camera text-4xl text-pink-500"></i>
                      <span className="text-xs uppercase tracking-widest">Take Photo</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="py-10 rounded-[3rem] bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 font-black flex flex-col items-center gap-4 hover:bg-slate-100 transition-all">
                      <i className="fas fa-images text-4xl text-indigo-500"></i>
                      <span className="text-xs uppercase tracking-widest">Gallery</span>
                    </button>
                    <input type="file" accept="image/*" multiple onChange={handleImageChange} ref={fileInputRef} className="hidden" />
                  </div>

                  {selectedImages.length > 0 && (
                    <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
                      {selectedImages.map((img, idx) => (
                        <div key={idx} className="relative flex-shrink-0 animate-in">
                          <img src={img} className="w-32 h-44 object-cover rounded-[2rem] shadow-xl border-4 border-white" />
                          <button onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-3 -right-3 bg-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center text-sm border-4 border-white"><i className="fas fa-times"></i></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button 
                    onClick={handleCreateArt} 
                    disabled={artLoading || isProcessingLocal} 
                    className="w-full py-8 rounded-[2.5rem] text-white font-black text-2xl shadow-2xl bg-black hover:bg-pink-700 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-4"
                  >
                    Generate Masterpiece (₹{pricePerImage})
                  </button>
                </section>
              </div>
            )}
          </div>
        )}

        {/* OTHER VIEWS (HOW TO USE, PAYMENT, TERMS, CONTACT) */}
        {activeView === 'how-to-use' && (
          <div className="animate-in bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100">
             <h2 className="text-4xl font-black text-indigo-950 uppercase mb-8">How to use</h2>
             <p className="text-slate-600 font-medium text-lg leading-relaxed">
               1. Select your best photo from camera or gallery.<br/>
               2. Choose your background and ornaments.<br/>
               3. Click Generate. Our AI will match your clothing colors and light up your face.<br/>
               4. Download in high resolution!
             </p>
             <button onClick={() => navigateTo('home')} className="mt-10 px-10 py-5 bg-black text-white rounded-3xl font-black">BACK HOME</button>
          </div>
        )}

        {activeView === 'payment' && (
          <div className="animate-in bg-white rounded-[4rem] p-10 shadow-2xl text-center">
             <i className="fas fa-credit-card text-6xl text-yellow-500 mb-6"></i>
             <h2 className="text-4xl font-black text-indigo-950 uppercase mb-4">Payment Policy</h2>
             <p className="text-slate-600 font-bold mb-8 italic">Non-refundable policy applies to all artistic generations.</p>
             <div className="text-3xl font-black text-pink-600 mb-10">₹10 / Generation</div>
             <button onClick={() => navigateTo('home')} className="px-10 py-5 bg-black text-white rounded-3xl font-black">BACK HOME</button>
          </div>
        )}

        {activeView === 'terms' && (
          <div className="animate-in bg-white rounded-[4rem] p-10 shadow-2xl">
             <h2 className="text-4xl font-black text-indigo-950 uppercase mb-8">Terms & Conditions</h2>
             <div className="space-y-6 text-slate-700 font-medium">
                <p><strong>Privacy:</strong> Your images are processed in real-time and deleted immediately after generation. We do not store your data.</p>
                <p><strong>Copyright:</strong> The generated artwork is for personal use only. No commercial distribution without licensing.</p>
             </div>
             <button onClick={() => navigateTo('home')} className="mt-10 px-10 py-5 bg-black text-white rounded-3xl font-black">BACK HOME</button>
          </div>
        )}

        {activeView === 'contact' && (
          <div className="animate-in bg-white rounded-[4rem] p-10 shadow-2xl text-center">
             <i className="fas fa-address-card text-6xl text-pink-600 mb-6"></i>
             <h2 className="text-4xl font-black text-indigo-950 uppercase mb-2">Nagji Yadav</h2>
             <p className="text-slate-400 font-bold mb-8">Professional AI Infrastructure - Sakodara</p>
             <a href="mailto:yadavnagji@gmail.com" className="text-2xl font-black text-pink-600 hover:underline">yadavnagji@gmail.com</a>
             <button onClick={() => navigateTo('home')} className="block mx-auto mt-12 px-10 py-5 bg-black text-white rounded-3xl font-black">BACK HOME</button>
          </div>
        )}

      </main>

      {/* Footer Branding */}
      <footer className="mt-auto bg-black py-12 text-white text-center">
         <div className="max-w-7xl mx-auto px-6">
            <h3 className="text-xl font-black uppercase tracking-tighter">Digital Painter</h3>
            <p className="text-white/30 font-bold tracking-widest text-[8px] uppercase mt-2">Professional 4K Creative Infrastructure - Sakodara</p>
         </div>
      </footer>

      {/* Camera Fullscreen View */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <video ref={videoRef} autoPlay playsInline className="w-full flex-grow object-cover" />
          <div className="p-10 flex justify-between items-center bg-black/90">
            <button onClick={() => {
              const stream = videoRef.current?.srcObject as MediaStream;
              stream?.getTracks().forEach(track => track.stop());
              setIsCameraOpen(false);
            }} className="text-white text-4xl"><i className="fas fa-times"></i></button>
            <button onClick={capturePhoto} className="w-24 h-24 bg-white rounded-full border-8 border-slate-400 shadow-2xl"></button>
            <button onClick={() => setCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="text-white text-4xl"><i className="fas fa-sync"></i></button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-10 py-5 rounded-[2rem] shadow-2xl font-black text-sm z-[200] flex items-center gap-4">
          <i className="fas fa-exclamation-triangle"></i> {error}
          <button onClick={() => setError(null)}><i className="fas fa-times"></i></button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
