import React, { useState, useEffect, createContext, useContext } from 'react';
import { Camera, Sparkles, Wand2, Upload, Image as ImageIcon, Loader2, History, Download, Coins, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeHand, analyzeNailReference, generateNailTryOn } from './services/geminiService';
import { saasLaunch, saasVerify, saasConsume } from './services/saasService';
import { fileToBase64 } from './lib/utils';

const SaasContext = createContext<{
  userId: string;
  toolId: string;
  integral: number;
  setIntegral: (val: number) => void;
  refreshIntegral: (uid: string, tid: string) => Promise<void>;
}>({
  userId: '',
  toolId: '',
  integral: 0,
  setIntegral: () => {},
  refreshIntegral: async () => {},
});

const STYLES = ['猫眼', '法式', '渐变', '纯色', '装饰', '手绘'];

const downloadSingleImage = (dataUrl: string, filename: string = `nail-result-${Date.now()}.png`) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const downloadImages = (images: string[]) => {
  images.forEach((img, idx) => {
    setTimeout(() => {
      downloadSingleImage(img, `nail-result-${Date.now()}-${idx + 1}.png`);
    }, idx * 300);
  });
};

const STYLE_PROMPTS: Record<string, string> = {
  '猫眼': 'Medium-length square nails. Base color is a translucent dusty pinkish-purple (mauve) with a magnetic cat-eye shimmer effect. Thumb: Gold crescent moon charm with a gold starburst inside. Index & Ring fingers: A large oval purple gem in the center, framed by an ornate silver vintage border with tiny rhinestones. Middle finger: A gold geometric star/cross charm with a small blue gem at the top. Pinky: A delicate silver rhinestone curved line. The 3D charms, colors, and shape MUST be exactly as described.',
  '法式': 'Medium-length square nails. Sheer nude/blush pink base color. Very thin, precise white French tip line at the very edge of the nails. Extremely glossy finish. Minimalist and clean, NO other decorations.',
  '渐变': 'Long almond-shaped nails. Soft blush pink ombre/gradient effect, starting from a natural sheer nude at the cuticle and blending into a deeper rosy pink towards the tips. Extremely glossy, jelly-like finish. NO decorations, just the smooth gradient.',
  '纯色': 'Medium-length square nails. Solid, opaque Tiffany blue / bright mint green color. Extremely glossy and smooth finish. Clean and simple, NO decorations, NO patterns.',
  '装饰': 'Long almond-shaped nails. Sheer, almost clear nude base. Decorated with fine silver glitter forming a diamond lattice/argyle pattern on some nails. Other nails feature silver chain borders and small square silver diamond/rhinestone charms placed near the cuticles or tips. Highly sparkling and luxurious.',
  '手绘': 'Long almond-shaped nails. Base is a mix of sheer nude and milky white. Features detailed hand-painted nail art: brown teddy bears, ice cream cones, delicate white bows, small red stars, and colorful confetti/sprinkles. Some nails have a milky white French tip section. Playful and cute style.'
};

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'smart' | 'custom'>('smart');
  const [userId, setUserId] = useState<string>('');
  const [toolId, setToolId] = useState<string>('');
  const [integral, setIntegral] = useState<number>(0);
  const [apiStatus, setApiStatus] = useState<{ connected: boolean; message: string } | null>(null);

  const checkApiStatus = async () => {
    try {
      const res = await fetch('/api/health-check');
      const data = await res.json();
      setApiStatus({ connected: data.connected, message: data.message });
    } catch (e) {
      setApiStatus({ connected: false, message: '无法连接到后端服务' });
    }
  };

  const refreshIntegral = async (uid: string, tid: string) => {
    if (!uid || !tid || uid === 'null' || tid === 'null') return;
    try {
      const res = await saasLaunch(uid, tid);
      if (res.success) {
        setIntegral(res.data.user.integral);
      }
    } catch (e) {
      console.error('Launch failed', e);
    }
  };

  useEffect(() => {
    checkApiStatus();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        const { userId: uid, toolId: tid } = event.data;
        if (uid && tid && uid !== 'null' && tid !== 'null') {
          setUserId(uid);
          setToolId(tid);
          refreshIntegral(uid, tid);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <SaasContext.Provider value={{ userId, toolId, integral, setIntegral, refreshIntegral }}>
      <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
        <AnimatePresence>
          {apiStatus && !apiStatus.connected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium sticky top-0 z-50 overflow-hidden"
            >
              <AlertCircle size={16} />
              <span>{apiStatus.message}。核心功能将无法使用，请检查配置。</span>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center text-white">
                <Sparkles size={18} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-semibold tracking-tight">NailAI 美甲工作室</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {apiStatus?.connected ? (
                    <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium uppercase tracking-wider">
                      <Wifi size={10} /> SaaS 接口已通
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium uppercase tracking-wider">
                      <WifiOff size={10} /> SaaS 接口失败
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-100 text-sm font-medium">
                <Coins size={14} className="text-yellow-500" />
                <span>积分余额: {integral}</span>
              </div>
              <nav className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
                <TabButton active={activeTab === 'smart'} onClick={() => setActiveTab('smart')} icon={<Sparkles size={16} />} label="智能推荐" />
                <TabButton active={activeTab === 'custom'} onClick={() => setActiveTab('custom')} icon={<ImageIcon size={16} />} label="自定义款式" />
              </nav>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className={activeTab === 'smart' ? 'block' : 'hidden'}>
            <SmartRecTab />
          </div>
          <div className={activeTab === 'custom' ? 'block' : 'hidden'}>
            <CustomTab />
          </div>
        </main>
      </div>
    </SaasContext.Provider>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
        active ? 'bg-white text-pink-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ImageUpload({ image, onUpload, label }: { image: string | null; onUpload: (file: File) => void; label: string }) {
  return (
    <div className="relative group aspect-[3/4] w-full max-w-sm mx-auto bg-neutral-100 rounded-2xl border-2 border-dashed border-neutral-300 overflow-hidden transition-colors hover:border-pink-400 hover:bg-pink-50/50">
      {image ? (
        <>
          <img src={image} alt="Uploaded" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <label className="cursor-pointer bg-white text-neutral-900 px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2 hover:bg-neutral-100 transition-colors">
              <Camera size={16} />
              更换照片
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
            </label>
          </div>
        </>
      ) : (
        <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center text-neutral-500 gap-3 p-6 text-center">
          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-neutral-400 group-hover:text-pink-500 group-hover:scale-110 transition-all">
            <Upload size={24} />
          </div>
          <div>
            <p className="font-medium text-neutral-700">{label}</p>
            <p className="text-xs text-neutral-400 mt-1">点击或拖拽上传</p>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

function SmartRecTab() {
  const saas = useContext(SaasContext);
  const [handImage, setHandImage] = useState<{ url: string; file: File } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [mode, setMode] = useState<'recommend' | 'manual'>('recommend');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!handImage) return;

    setIsAnalyzing(true);
    try {
      const { base64, mimeType } = await fileToBase64(handImage.file);
      const result = await analyzeHand(base64, mimeType);
      setAnalysis(result);
      setSelectedStyle(result.recommendedStyle);
    } catch (error) {
      console.error(error);
      alert("分析手部特征失败。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!handImage || !selectedStyle) return;

    // Integral Verify
    if (saas.userId && saas.toolId) {
      const verify = await saasVerify(saas.userId, saas.toolId);
      if (!verify.success) {
        alert(verify.message || "积分不足");
        return;
      }
    }

    setIsGenerating(true);
    try {
      const { base64, mimeType } = await fileToBase64(handImage.file);
      const styleDescription = STYLE_PROMPTS[selectedStyle] || `Apply ${selectedStyle} style nails`;
      const prompt = `Strictly generate the nails with the following exact specifications: ${styleDescription}. The result MUST perfectly match this description.`;
      const result = await generateNailTryOn(base64, mimeType, prompt);
      
      if (resultImage) {
        setHistory(prev => [resultImage, ...prev]);
      }
      setResultImage(result);

      // Integral Consume
      if (saas.userId && saas.toolId) {
        const consume = await saasConsume(saas.userId, saas.toolId);
        if (consume.success) {
          saas.setIntegral(consume.data.currentIntegral);
        }
      }
    } catch (error) {
      console.error(error);
      alert("生成图片失败。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">1. 上传手部照片</h2>
            <ImageUpload 
              image={handImage?.url || null} 
              onUpload={(file) => {
                setHandImage({ url: URL.createObjectURL(file), file });
                setAnalysis(null);
                setResultImage(null);
                setHistory([]);
              }} 
              label="上传手部照片"
            />
          </div>

          {!analysis ? (
            <button
              onClick={handleAnalyze}
              disabled={!handImage || isAnalyzing}
              className="w-full py-4 bg-pink-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? <><Loader2 className="animate-spin" size={20} /> 分析手部特征...</> : <><Sparkles size={20} /> 智能分析手部特征</>}
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6">
              <div className="bg-pink-50 p-5 rounded-2xl border border-pink-100">
                <h3 className="font-semibold text-pink-900 mb-3 flex items-center gap-2"><Sparkles size={18} /> 分析结果</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-3 rounded-xl shadow-sm">
                    <p className="text-xs text-neutral-500 mb-1">手型</p>
                    <p className="font-medium text-sm">{analysis.handShape}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl shadow-sm">
                    <p className="text-xs text-neutral-500 mb-1">肤色</p>
                    <p className="font-medium text-sm">{analysis.skinTone}</p>
                  </div>
                </div>
                <p className="text-sm text-pink-800 leading-relaxed">{analysis.explanation}</p>
              </div>

              <div>
                <div className="flex bg-neutral-100 p-1 rounded-lg mb-4">
                  <button onClick={() => { setMode('recommend'); setSelectedStyle(analysis.recommendedStyle); }} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'recommend' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>使用推荐款式</button>
                  <button onClick={() => setMode('manual')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>手动选择款式</button>
                </div>

                {mode === 'recommend' ? (
                  <div className="p-4 border-2 border-pink-500 bg-pink-50 rounded-xl text-center">
                    <p className="text-sm text-pink-600 font-medium mb-1">推荐款式</p>
                    <p className="text-xl font-bold text-pink-900">{analysis.recommendedStyle}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {STYLES.map(style => (
                      <button
                        key={style}
                        onClick={() => setSelectedStyle(style)}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                          selectedStyle === style 
                            ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-sm' 
                            : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-neutral-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? <><Loader2 className="animate-spin" size={20} /> 生成中...</> : <><Wand2 size={20} /> 一键试戴</>}
              </button>
            </motion.div>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col items-center justify-center min-h-[500px]">
          {resultImage ? (
            <div className="w-full h-full flex flex-col items-center gap-4">
              <h3 className="font-medium text-neutral-500 w-full text-center">虚拟试戴效果</h3>
              <div className="relative group w-full max-w-sm aspect-[3/4]">
                <img 
                  src={resultImage} 
                  alt="Result" 
                  className="w-full h-full rounded-2xl shadow-md object-cover cursor-pointer" 
                  onClick={() => setEnlargedImage(resultImage)}
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); downloadSingleImage(resultImage); }}
                  className="absolute top-3 right-3 bg-white/90 text-neutral-700 hover:text-black p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="下载当前图片"
                >
                  <Download size={18} />
                </button>
              </div>
              
              {history.length > 0 && (
                <div className="w-full mt-4 pt-4 border-t border-neutral-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-medium text-neutral-400 flex items-center gap-1"><History size={14} /> 历史记录 (点击放大)</h4>
                    <button 
                      onClick={() => downloadImages([resultImage, ...history])}
                      className="text-xs font-medium text-pink-600 hover:text-pink-700 flex items-center gap-1"
                    >
                      <Download size={14} /> 下载全部
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                    {history.map((img, i) => (
                      <div key={i} className="relative group flex-shrink-0 snap-start w-20 h-28">
                        <img
                          src={img}
                          alt={`History ${i}`}
                          className="w-full h-full object-cover rounded-xl cursor-pointer border border-neutral-200 shadow-sm hover:opacity-80 transition-opacity"
                          onClick={() => setEnlargedImage(img)}
                        />
                        <button 
                          onClick={(e) => { e.stopPropagation(); downloadSingleImage(img); }}
                          className="absolute top-1 right-1 bg-white/90 text-neutral-700 hover:text-black p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="下载"
                        >
                          <Download size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-neutral-400 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center">
                <ImageIcon size={32} className="text-neutral-300" />
              </div>
              <p>生成的试戴效果将显示在这里</p>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {enlargedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setEnlargedImage(null)}
          >
            <img 
              src={enlargedImage} 
              alt="Enlarged Result" 
              className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl" 
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute top-6 right-6 flex gap-3">
              <button 
                className="text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); downloadSingleImage(enlargedImage); }}
                title="下载"
              >
                <Download size={24} />
              </button>
              <button 
                className="text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors flex items-center justify-center"
                onClick={() => setEnlargedImage(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CustomTab() {
  const saas = useContext(SaasContext);
  const [handImage, setHandImage] = useState<{ url: string; file: File } | null>(null);
  const [nailImage, setNailImage] = useState<{ url: string; file: File } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!handImage || !nailImage) return;

    // Integral Verify
    if (saas.userId && saas.toolId) {
      const verify = await saasVerify(saas.userId, saas.toolId);
      if (!verify.success) {
        alert(verify.message || "积分不足");
        return;
      }
    }

    setIsGenerating(true);
    try {
      const { base64, mimeType } = await fileToBase64(handImage.file);
      const { base64: refBase64, mimeType: refMimeType } = await fileToBase64(nailImage.file);
      
      // 首先提取参考图的细节特征，用于强制锚定生图属性
      const analysis = await analyzeNailReference(refBase64, refMimeType);
      const detailedPrompt = `Nail Shape & Length: ${analysis.length}. Base Color: ${analysis.color}. Material/Texture: ${analysis.material}. 3D Decorations & Patterns: ${analysis.details}.`;
      
      const result = await generateNailTryOn(base64, mimeType, detailedPrompt, refBase64, refMimeType);
      
      if (resultImage) {
        setHistory(prev => [resultImage, ...prev]);
      }
      setResultImage(result);

      // Integral Consume
      if (saas.userId && saas.toolId) {
        const consume = await saasConsume(saas.userId, saas.toolId);
        if (consume.success) {
          saas.setIntegral(consume.data.currentIntegral);
        }
      }
    } catch (error) {
      console.error(error);
      alert("生成图片失败。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">手部照片</h2>
              <ImageUpload 
                image={handImage?.url || null} 
                onUpload={(file) => {
                  setHandImage({ url: URL.createObjectURL(file), file });
                  setResultImage(null);
                  setHistory([]);
                }} 
                label="上传手部照片"
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-2">美甲参考图</h2>
              <ImageUpload 
                image={nailImage?.url || null} 
                onUpload={(file) => setNailImage({ url: URL.createObjectURL(file), file })} 
                label="上传美甲参考"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!handImage || !nailImage || isGenerating}
            className="w-full py-4 bg-neutral-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <><Loader2 className="animate-spin" size={20} /> 生成中...</> : <><Wand2 size={20} /> 一键试戴</>}
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col items-center justify-center min-h-[500px]">
          {resultImage ? (
            <div className="w-full h-full flex flex-col items-center gap-4">
              <h3 className="font-medium text-neutral-500 w-full text-center">虚拟试戴效果</h3>
              <div className="relative group w-full max-w-sm aspect-[3/4]">
                <img 
                  src={resultImage} 
                  alt="Result" 
                  className="w-full h-full rounded-2xl shadow-md object-cover cursor-pointer" 
                  onClick={() => setEnlargedImage(resultImage)}
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); downloadSingleImage(resultImage); }}
                  className="absolute top-3 right-3 bg-white/90 text-neutral-700 hover:text-black p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="下载当前图片"
                >
                  <Download size={18} />
                </button>
              </div>
              
              {history.length > 0 && (
                <div className="w-full mt-4 pt-4 border-t border-neutral-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-medium text-neutral-400 flex items-center gap-1"><History size={14} /> 历史记录 (点击放大)</h4>
                    <button 
                      onClick={() => downloadImages([resultImage, ...history])}
                      className="text-xs font-medium text-pink-600 hover:text-pink-700 flex items-center gap-1"
                    >
                      <Download size={14} /> 下载全部
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                    {history.map((img, i) => (
                      <div key={i} className="relative group flex-shrink-0 snap-start w-20 h-28">
                        <img
                          src={img}
                          alt={`History ${i}`}
                          className="w-full h-full object-cover rounded-xl cursor-pointer border border-neutral-200 shadow-sm hover:opacity-80 transition-opacity"
                          onClick={() => setEnlargedImage(img)}
                        />
                        <button 
                          onClick={(e) => { e.stopPropagation(); downloadSingleImage(img); }}
                          className="absolute top-1 right-1 bg-white/90 text-neutral-700 hover:text-black p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="下载"
                        >
                          <Download size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-neutral-400 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center">
                <ImageIcon size={32} className="text-neutral-300" />
              </div>
              <p>上传图片后点击生成</p>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {enlargedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setEnlargedImage(null)}
          >
            <img 
              src={enlargedImage} 
              alt="Enlarged Result" 
              className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl" 
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute top-6 right-6 flex gap-3">
              <button 
                className="text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); downloadSingleImage(enlargedImage); }}
                title="下载"
              >
                <Download size={24} />
              </button>
              <button 
                className="text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors flex items-center justify-center"
                onClick={() => setEnlargedImage(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
