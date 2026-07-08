import React, { useState, useEffect, createContext, useContext } from 'react';
import { Camera, Sparkles, Wand2, Upload, Image as ImageIcon, Loader2, History, Download, Coins, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeHand, analyzeNailReference, generateNailTryOn, generateVideoStart, checkVideoStatus, downloadVideoUrl } from './services/geminiService';
import { saasLaunch, saasVerify, saasConsume } from './services/saasService';
import { fileToBase64, compressImage } from './lib/utils';
import AgentTab from './components/AgentTab';

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
  const [viewMode, setViewMode] = useState<'portal' | 'agent' | 'expert'>('portal');
  const [activeTab, setActiveTab] = useState<'smart' | 'custom'>('smart');
  
  const [userId, setUserId] = useState<string>('');
  const [toolId, setToolId] = useState<string>('');
  const [integral, setIntegral] = useState<number>(0);

  // Core Business Shared States (双向无缝同步)
  const [handImage, setHandImage] = useState<{ url: string; file: File } | null>(null); // 状态A - 主体手部图
  const [nailImage, setNailImage] = useState<{ url: string; file: File } | null>(null); // 状态B - 参照图 / 参考款式图
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1'); // 参数C - 画面比例
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K'); // 参数D - 清晰度
  
  // Results History States (状态E)
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  
  // Video and analysis states (shared to enable real-time UI reactions across views)
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoStep, setVideoStep] = useState<string>('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'image' | 'video'>('image');
  
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<'recommend' | 'manual'>('recommend');

  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const refreshIntegral = async (uid: string, tid: string) => {
    if (!uid || !tid || uid === 'null' || tid === 'null' || uid === 'undefined' || tid === 'undefined') return;
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
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        const { userId: uid, toolId: tid } = event.data;
        if (uid && tid && uid !== 'null' && tid !== 'null' && uid !== 'undefined' && tid !== 'undefined') {
          setUserId(uid);
          setToolId(tid);
          refreshIntegral(uid, tid);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleResetAll = () => {
    setHandImage(null);
    setNailImage(null);
    setAspectRatio('1:1');
    setResolution('1K');
    setResultImage(null);
    setHistory([]);
    setVideoUrl(null);
    setVideoLoading(false);
    setVideoStep('');
    setVideoError(null);
    setDisplayMode('image');
    setSelectedStyle('');
    setAnalysis(null);
    setIsAnalyzing(false);
    setIsGenerating(false);
    setMode('recommend');
  };

  const triggerVideoGeneration = async (imageBase64: string, styleDetails: string) => {
    setVideoLoading(true);
    setVideoError(null);
    setVideoStep('✨ 正在融合您的试戴款式...');
    
    try {
      setVideoStep('🎨 启动 Gemini Veo 视频生成任务...');
      const videoPrompt = `A continuous, ultra-high-quality close-up 8-second video showcasing a beautiful manicure. CRITICAL: The hand, skin tone, and specifically the custom manicure design, nail shape, and decorations MUST remain 100% identical to the starting state throughout the entire video. Do not add or remove any jewelry, rings, or nail decorations. For the first 4 seconds, the video strictly shows the palm side of the elegant hand. At the 4-second mark, the hand smoothly executes a natural, physical 3D flipping rotation of the wrist in mid-air to reveal the back of the hand. The side profile of the hand must be visible during this turn; it cannot instantly morph or cut from front to back. For the remaining 4 seconds, the hand is shown from the back with all fingers fully extended, spread out, and open wide, completely showcasing the entire back of the hand while keeping the gorgeous fingernails and custom manicure facing the camera. Throughout the entire video, there are subtle dynamic pulses and light rhythmic movements of the fingers to make the hand look lifelike, with absolutely no frame cuts or sudden jumps. Consistent hand shape, skin tone, and clear studio lighting.`;
      
      const { operationName } = await generateVideoStart(imageBase64, videoPrompt);
      
      let attempts = 0;
      const maxAttempts = 120; // 10 mins limit
      const messages = [
        "✨ 正在融合您的试戴款式和底图...",
        "✍️ Gemini Veo 正在精确塑形手部的翻转姿态结构...",
        "💅 正在雕琢指尖美甲的立体反光和 3D 设计细节...",
        "🎨 正在智能模拟指套折射及细腻的手部屈伸动作...",
        "🎬 正在渲染高精度的光影追光，并拼合并优化视频...",
        "🏁 视频即将就绪，正在封装至播放器..."
      ];
      
      while (attempts < maxAttempts) {
        attempts++;
        const msgIndex = Math.min(Math.floor(attempts / 8), messages.length - 1);
        setVideoStep(`${messages[msgIndex]} (第 ${attempts * 5} 秒 / 预计 1 分钟)`);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const { done } = await checkVideoStatus(operationName);
        if (done) {
          break;
        }
      }
      
      setVideoStep('🎬 视频渲染完毕，正在下载与加载播放器...');
      const videoBlobUrl = await downloadVideoUrl(operationName);
      setVideoUrl(videoBlobUrl);
      setDisplayMode('video'); // Auto switch to video tab
    } catch (e: any) {
      console.error('Video generation failed:', e);
      setVideoError(e.message || '视频生成遇到了些问题，请重试');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleGenerate = async (
    additionalPrompt?: string,
    styleOverride?: string,
    nailImageOverride?: any | null
  ) => {
    if (!handImage) return { success: false, error: "请上传手部底图。" };

    const actualNailImage = nailImageOverride !== undefined ? nailImageOverride : nailImage;
    const actualSelectedStyle = styleOverride !== undefined ? styleOverride : selectedStyle;

    const isCustom = !!actualNailImage;
    if (isCustom && !actualNailImage) return { success: false, error: "请上传参考图。" };
    if (!isCustom && !actualSelectedStyle) return { success: false, error: "请选择一个款式。" };

    if (userId && toolId) {
      const verify = await saasVerify(userId, toolId);
      if (!verify.success) {
        return { success: false, error: verify.message || "积分不足" };
      }
    }

    setIsGenerating(true);
    setVideoUrl(null);
    setVideoError(null);
    setDisplayMode('image');

    try {
      const { base64, mimeType } = await fileToBase64(handImage.file);
      let promptText = '';
      let refBase64: string | undefined = undefined;
      let refMimeType: string | undefined = undefined;
      let styleDescription = '';

      if (isCustom && actualNailImage) {
        const fileData = await fileToBase64(actualNailImage.file);
        refBase64 = fileData.base64;
        refMimeType = fileData.mimeType;
        
        const nailAnalysis = await analyzeNailReference(refBase64, refMimeType);
        styleDescription = `Nail Shape & Length: ${nailAnalysis.length}. Base Color: ${nailAnalysis.color}. Material/Texture: ${nailAnalysis.material}. 3D Decorations & Patterns: ${nailAnalysis.details}.`;
        promptText = styleDescription;
      } else {
        styleDescription = STYLE_PROMPTS[actualSelectedStyle] || `Apply ${actualSelectedStyle} style nails`;
        promptText = `Strictly generate the nails with the following exact specifications: ${styleDescription}. The result MUST perfectly match this description.`;
      }

      if (additionalPrompt) {
        promptText += ` Additional custom instructions: ${additionalPrompt}.`;
      }

      // Append resolution & aspect ratio parameters to prompt as specified
      promptText += ` Render formatted in ${aspectRatio} aspect ratio and optimized with ${resolution} detail quality.`;

      const result = await generateNailTryOn(base64, mimeType, promptText, refBase64, refMimeType, userId, toolId);
      
      if (resultImage) {
        setHistory(prev => [resultImage, ...prev]);
      }
      setResultImage(result);

      if (userId && toolId) {
        setTimeout(() => refreshIntegral(userId, toolId), 1000);
      }

      // Synchronously trigger video generation in background (only if not in agent mode)
      if (viewMode !== 'agent') {
        triggerVideoGeneration(result, styleDescription);
      }
      return { success: true, result };
    } catch (error: any) {
      console.error(error);
      return { success: false, error: error.message || "生成试戴效果失败。" };
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SaasContext.Provider value={{ userId, toolId, integral, setIntegral, refreshIntegral }}>
      <div className="min-h-screen bg-[#FAF8F5] text-[#4A443D] font-sans pb-12">
        <header className="bg-white border-b border-[#EAE6DF] sticky top-0 z-10 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2">
            
            <div className="flex items-center justify-between w-full sm:w-auto">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('portal')}>
                <div className="w-8 h-8 bg-[#9C7A63] rounded-lg flex items-center justify-center text-white shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap text-[#4A443D]">NailAI 美甲工作室</h1>
                </div>
              </div>

              <div className="sm:hidden flex items-center gap-2 px-3 py-1 bg-[#F2EFE9] text-[#696158] rounded-full border border-[#EAE6DF] text-xs font-semibold">
                <Coins size={12} className="text-[#9C7A63]" />
                <span>积分: {integral}</span>
              </div>
            </div>

            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#F2EFE9] text-[#696158] rounded-full border border-[#EAE6DF] text-sm font-semibold">
                <Coins size={14} className="text-[#9C7A63]" />
                <span>积分余额: {integral}</span>
              </div>
              
              {viewMode !== 'portal' && (
                <button
                  onClick={() => setViewMode('portal')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF] text-xs font-bold text-[#696158] hover:text-[#7A5B45] hover:border-[#D5CFC4] hover:shadow-xs transition-all cursor-pointer shrink-0"
                >
                  返回首页
                </button>
              )}
            </div>

          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 mt-8">
          {viewMode === 'portal' ? (
            <div className="py-12 flex flex-col items-center justify-center animate-fade-in text-center max-w-5xl mx-auto">
              <div className="px-3 py-1 bg-white text-[#9C7A63] rounded-full border border-[#EAE6DF] text-xs font-semibold shadow-xs flex items-center gap-1">
                <span>💅</span> NailAI 智能美甲助手 V4.0
              </div>
              
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[#4A443D] tracking-tight mt-6">
                开启您的 AI 美甲试戴之旅
              </h2>
              
              <p className="text-[#968F85] text-sm max-w-2xl mx-auto mt-4 leading-relaxed px-4">
                无论您是希望得到贴心的智能 design 助理引导，还是渴望在全功能的专业面板上精细调校，我们都为您提供了专属的使用方案。
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-12 px-4">
                {/* Agent Card */}
                <div className="bg-white border border-[#EAE6DF] rounded-3xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#D5CFC4] transition-all text-left">
                  <div>
                    <div className="w-14 h-14 bg-[#FAF8F5] border border-[#EAE6DF] rounded-2xl flex items-center justify-center text-[#9C7A63] mb-6 shadow-xs">
                      <Sparkles size={28} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-[#4A443D]">智能体模式</h3>
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                        推荐新手
                      </span>
                    </div>
                    
                    <p className="text-sm text-[#968F85] mt-4 leading-relaxed">
                      对话式交互，像和专业设计师聊天一样。AI 将一步步引导您选择手部照片、美甲照片，直接在聊天框内返回生成效果。
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setViewMode('agent')}
                    className="w-full py-4 bg-[#6E6458] hover:bg-[#5A5146] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-8 shadow-xs cursor-pointer"
                  >
                    <Sparkles size={16} />
                    开启智能对话引导
                  </button>
                </div>

                {/* Expert Card */}
                <div className="bg-white border border-[#EAE6DF] rounded-3xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#D5CFC4] transition-all text-left">
                  <div>
                    <div className="w-14 h-14 bg-[#FAF8F5] border border-[#EAE6DF] rounded-2xl flex items-center justify-center text-[#9C7A63] mb-6 shadow-xs">
                      <Wand2 size={28} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-[#4A443D]">专家工作台</h3>
                      <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                        高阶微调
                      </span>
                    </div>
                    
                    <p className="text-sm text-[#968F85] mt-4 leading-relaxed">
                      经典分步流程。提供高可控性的输出设置、画面比例调节，支持高清原图下载及多视角一次性生成。
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setViewMode('expert')}
                    className="w-full py-4 bg-[#FAF8F5] border border-[#EAE6DF] hover:bg-[#FAF8F5]/80 text-[#4A443D] rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-8 shadow-xs cursor-pointer"
                  >
                    <Wand2 size={16} />
                    进入工程师工作台
                  </button>
                </div>
              </div>
            </div>
          ) : viewMode === 'agent' ? (
            <div className="max-w-4xl mx-auto animate-fade-in">
              <AgentTab
                handImage={handImage}
                setHandImage={setHandImage}
                nailImage={nailImage}
                setNailImage={setNailImage}
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
                resolution={resolution}
                setResolution={setResolution}
                resultImage={resultImage}
                setResultImage={setResultImage}
                history={history}
                setHistory={setHistory}
                videoUrl={videoUrl}
                setVideoUrl={setVideoUrl}
                videoLoading={videoLoading}
                setVideoLoading={setVideoLoading}
                videoStep={videoStep}
                setVideoStep={setVideoStep}
                videoError={videoError}
                setVideoError={setVideoError}
                displayMode={displayMode}
                setDisplayMode={setDisplayMode}
                selectedStyle={selectedStyle}
                setSelectedStyle={setSelectedStyle}
                analysis={analysis}
                setAnalysis={setAnalysis}
                isAnalyzing={isAnalyzing}
                setIsAnalyzing={setIsAnalyzing}
                isGenerating={isGenerating}
                setIsGenerating={setIsGenerating}
                handleGenerate={handleGenerate}
                handleResetAll={handleResetAll}
                integral={integral}
                setIntegral={setIntegral}
                setEnlargedImage={setEnlargedImage}
                triggerVideoGeneration={triggerVideoGeneration}
                userId={userId}
                toolId={toolId}
              />
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-[#EAE6DF] shadow-xs">
                <div>
                  <h2 className="font-semibold text-base text-[#4A443D]">专家精细化设计</h2>
                  <p className="text-xs text-[#968F85] mt-0.5">多合一精细化控制面板，让您可以精准上传并自主定制所有生图属性参数。</p>
                </div>
                <nav className="flex gap-1 bg-[#EAE6DF]/40 p-1 rounded-xl w-full sm:w-auto self-stretch sm:self-auto shrink-0">
                  <TabButton active={activeTab === 'smart'} onClick={() => setActiveTab('smart')} icon={<Sparkles size={14} />} label="智能推荐" />
                  <TabButton active={activeTab === 'custom'} onClick={() => setActiveTab('custom')} icon={<ImageIcon size={14} />} label="自定义" />
                </nav>
              </div>

              {activeTab === 'smart' ? (
                <SmartRecTab
                  handImage={handImage}
                  setHandImage={setHandImage}
                  analysis={analysis}
                  setAnalysis={setAnalysis}
                  isAnalyzing={isAnalyzing}
                  setIsAnalyzing={setIsAnalyzing}
                  selectedStyle={selectedStyle}
                  setSelectedStyle={setSelectedStyle}
                  isGenerating={isGenerating}
                  setIsGenerating={setIsGenerating}
                  resultImage={resultImage}
                  setResultImage={setResultImage}
                  history={history}
                  setHistory={setHistory}
                  videoUrl={videoUrl}
                  setVideoUrl={setVideoUrl}
                  videoLoading={videoLoading}
                  setVideoLoading={setVideoLoading}
                  videoStep={videoStep}
                  setVideoStep={setVideoStep}
                  videoError={videoError}
                  setVideoError={setVideoError}
                  displayMode={displayMode}
                  setDisplayMode={setDisplayMode}
                  triggerVideoGeneration={triggerVideoGeneration}
                  handleGenerate={handleGenerate}
                  mode={mode}
                  setMode={setMode}
                  setEnlargedImage={setEnlargedImage}
                />
              ) : (
                <CustomTab
                  handImage={handImage}
                  setHandImage={setHandImage}
                  nailImage={nailImage}
                  setNailImage={setNailImage}
                  isGenerating={isGenerating}
                  setIsGenerating={setIsGenerating}
                  resultImage={resultImage}
                  setResultImage={setResultImage}
                  history={history}
                  setHistory={setHistory}
                  handleGenerate={handleGenerate}
                  setEnlargedImage={setEnlargedImage}
                />
              )}
            </div>
          )}
        </main>
      </div>

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
                className="text-white bg-black/50 hover:bg-black/80 rounded-full p-2.5 transition-colors flex items-center justify-center cursor-pointer"
                onClick={(e) => { e.stopPropagation(); downloadSingleImage(enlargedImage); }}
                title="下载"
              >
                <Download size={24} />
              </button>
              <button 
                className="text-white bg-black/50 hover:bg-black/80 rounded-full p-2.5 transition-colors flex items-center justify-center cursor-pointer"
                onClick={() => setEnlargedImage(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SaasContext.Provider>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
        active ? 'bg-white text-[#7A5B45] shadow-xs' : 'text-[#968F85] hover:text-[#696158] hover:bg-[#EAE6DF]/30'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ImageUpload({ image, onUpload, label, className = "aspect-[3/4] w-full max-w-sm" }: { image: string | null; onUpload: (file: File) => void; label: string; className?: string }) {
  return (
    <div className={`relative group mx-auto bg-[#F2EFE9] rounded-2xl border-2 border-dashed border-[#D5CFC4] overflow-hidden transition-colors hover:border-[#9C7A63] hover:bg-[#EAE6DF]/30 ${className}`}>
      {image ? (
        <>
          <img src={image} alt="Uploaded" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <label className="cursor-pointer bg-white text-[#4A443D] px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 hover:bg-[#F2EFE9] transition-colors">
              <Camera size={16} />
              更换照片
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
            </label>
          </div>
        </>
      ) : (
        <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center text-[#968F85] gap-3 p-6 text-center">
          <div className="w-12 h-12 bg-white rounded-full shadow-xs flex items-center justify-center text-[#B0A9A0] group-hover:text-[#7A5B45] group-hover:scale-110 transition-all">
            <Upload size={24} />
          </div>
          <div>
            <p className="font-semibold text-[#696158]">{label}</p>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

// DRYYY Results Preview and Video generation panel component
function ResultsPreviewPanel({
  resultImage,
  displayMode,
  setDisplayMode,
  videoLoading,
  videoStep,
  videoError,
  videoUrl,
  selectedStyle,
  triggerVideoGeneration,
  history,
  setEnlargedImage
}: {
  resultImage: string | null;
  displayMode: 'image' | 'video';
  setDisplayMode: (mode: 'image' | 'video') => void;
  videoLoading: boolean;
  videoStep: string;
  videoError: string | null;
  videoUrl: string | null;
  selectedStyle: string;
  triggerVideoGeneration: (imageBase64: string, styleDetails: string) => Promise<void>;
  history: string[];
  setEnlargedImage: (img: string | null) => void;
}) {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#EAE6DF] shadow-sm flex flex-col items-center justify-center min-h-[520px] sm:min-h-[620px] h-full">
      {resultImage ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
          <div className="flex bg-[#F2EFE9] p-1 rounded-lg w-full max-w-sm mb-2 shrink-0">
            <button
              type="button"
              onClick={() => setDisplayMode('image')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                displayMode === 'image' ? 'bg-white shadow-xs text-[#7A5B45]' : 'text-[#968F85] hover:text-[#696158]'
              }`}
            >
              <ImageIcon size={14} />
              试戴效果图
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('video')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 relative cursor-pointer ${
                displayMode === 'video' ? 'bg-white shadow-xs text-[#7A5B45]' : 'text-[#968F85] hover:text-[#696158]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className={videoLoading ? "animate-spin text-[#9C7A63]" : "text-amber-500"} />
                3D 试戴视频
              </span>
              {videoLoading && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </button>
          </div>

          {displayMode === 'image' ? (
            <div className="w-full flex flex-col items-center gap-4">
              <h3 className="font-medium text-[#968F85] w-full text-center text-sm">虚拟试戴效果</h3>
              <div className="relative group w-full max-w-sm aspect-[3/4]">
                <img 
                  src={resultImage} 
                  alt="Result" 
                  className="w-full h-full rounded-2xl shadow-md object-cover cursor-pointer" 
                  onClick={() => setEnlargedImage(resultImage)}
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); downloadSingleImage(resultImage); }}
                  className="absolute top-3 right-3 bg-white/90 text-[#696158] hover:text-[#7A5B45] p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                  title="下载当前图片"
                >
                  <Download size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center min-h-[300px]">
              {videoLoading ? (
                <div className="text-center p-6 bg-[#FAF8F5] rounded-2xl border border-[#EAE6DF] max-w-sm w-full shadow-xs flex flex-col items-center gap-4 animate-fade-in">
                  <div className="relative">
                    <Loader2 className="animate-spin text-[#9C7A63]" size={36} />
                    <Sparkles className="absolute -top-1 -right-1 text-amber-500 animate-pulse" size={16} />
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold text-sm text-[#4A443D]">{videoStep}</p>
                    <p className="text-[11px] text-[#968F85] leading-relaxed text-left">
                      Gemini Veo 视频模型正在深度解析您的试戴美甲，为您生成精美的 3D 手部动作视频。由于需要对旋转、折射及细节进行对齐，生成过程通常仅需 1 分钟左右，请您耐心等候，精美指尖艺术值得等待 ✨
                    </p>
                  </div>
                </div>
              ) : videoError ? (
                <div className="text-center p-6 bg-red-50/50 rounded-2xl border border-red-100 max-w-sm w-full flex flex-col items-center gap-3">
                  <AlertCircle className="text-red-500" size={32} />
                  <p className="text-xs font-semibold text-red-700">{videoError}</p>
                  <button
                    onClick={() => triggerVideoGeneration(resultImage!, STYLE_PROMPTS[selectedStyle] || selectedStyle || 'Manicure')}
                    className="px-4 py-2 bg-[#9C7A63] text-white rounded-xl text-xs font-semibold hover:bg-[#856550] transition-colors cursor-pointer"
                  >
                    重新生成视频
                  </button>
                </div>
              ) : videoUrl ? (
                <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
                  <h3 className="font-medium text-[#968F85] w-full text-center text-sm flex items-center justify-center gap-1">
                    <Sparkles size={14} className="text-amber-500" />
                    Veo 3D 手部旋转展示视频
                  </h3>
                  <div className="relative group w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden shadow-md bg-stone-900 border border-stone-200">
                    <video
                      src={videoUrl}
                      className="w-full h-full object-cover"
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadSingleImage(videoUrl, `nail-video-${Date.now()}.mp4`); }}
                      className="absolute top-3 right-3 bg-white/90 text-[#696158] hover:text-[#7A5B45] p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 cursor-pointer"
                      title="下载视频"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                  <button
                    onClick={() => downloadSingleImage(videoUrl!, `nail-video-${Date.now()}.mp4`)}
                    className="w-full py-2.5 max-w-sm bg-stone-100 text-stone-700 font-semibold rounded-xl border border-stone-200 text-xs flex items-center justify-center gap-2 hover:bg-stone-200 transition-colors cursor-pointer"
                  >
                    <Download size={14} />
                    保存 3D 试戴视频 (MP4格式)
                  </button>
                </div>
              ) : (
                <div className="text-center p-6 bg-[#FAF8F5] rounded-2xl border border-[#EAE6DF] max-w-sm w-full flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-[#9C7A63]" size={36} />
                  <p className="text-xs text-[#696158]">正在获取视频生成信息...</p>
                </div>
              )}
            </div>
          )}
          
          {history.length > 0 && (
            <div className="w-full mt-4 pt-4 border-t border-neutral-100 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-medium text-[#B0A9A0] flex items-center gap-1"><History size={14} /> 历史记录 (点击放大)</h4>
                <button 
                  onClick={() => downloadImages([resultImage, ...history])}
                  className="text-xs font-medium text-[#4A443D] hover:text-[#7A5B45] flex items-center gap-1 underline underline-offset-2 cursor-pointer"
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
                      className="w-full h-full object-cover rounded-xl cursor-pointer border border-[#EAE6DF] shadow-sm hover:opacity-80 transition-opacity"
                      onClick={() => setEnlargedImage(img)}
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); downloadSingleImage(img); }}
                      className="absolute top-1 right-1 bg-white/90 text-[#696158] hover:text-[#7A5B45] p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
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
        <div className="text-center text-[#B0A9A0] flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-[#FAF8F5] rounded-full flex items-center justify-center">
            <ImageIcon size={32} className="text-[#D5CFC4]" />
          </div>
          <p className="text-xs">生成的试戴效果和 3D 视频将显示在这里</p>
        </div>
      )}
    </div>
  );
}

interface SmartRecTabProps {
  handImage: { url: string; file: File } | null;
  setHandImage: React.Dispatch<React.SetStateAction<{ url: string; file: File } | null>>;
  analysis: any;
  setAnalysis: React.Dispatch<React.SetStateAction<any>>;
  isAnalyzing: boolean;
  setIsAnalyzing: React.Dispatch<React.SetStateAction<boolean>>;
  selectedStyle: string;
  setSelectedStyle: React.Dispatch<React.SetStateAction<string>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  resultImage: string | null;
  setResultImage: React.Dispatch<React.SetStateAction<string | null>>;
  history: string[];
  setHistory: React.Dispatch<React.SetStateAction<string[]>>;
  videoUrl: string | null;
  setVideoUrl: React.Dispatch<React.SetStateAction<string | null>>;
  videoLoading: boolean;
  setVideoLoading: React.Dispatch<React.SetStateAction<boolean>>;
  videoStep: string;
  setVideoStep: React.Dispatch<React.SetStateAction<string>>;
  videoError: string | null;
  setVideoError: React.Dispatch<React.SetStateAction<string | null>>;
  displayMode: 'image' | 'video';
  setDisplayMode: React.Dispatch<React.SetStateAction<'image' | 'video'>>;
  triggerVideoGeneration: (imageBase64: string, styleDetails: string) => Promise<void>;
  handleGenerate: (additionalPrompt?: string) => Promise<{ success: boolean; result?: string; error?: string }>;
  mode: 'recommend' | 'manual';
  setMode: React.Dispatch<React.SetStateAction<'recommend' | 'manual'>>;
  setEnlargedImage: (img: string | null) => void;
}

function SmartRecTab({
  handImage,
  setHandImage,
  analysis,
  setAnalysis,
  isAnalyzing,
  setIsAnalyzing,
  selectedStyle,
  setSelectedStyle,
  isGenerating,
  setIsGenerating,
  resultImage,
  setResultImage,
  history,
  setHistory,
  videoUrl,
  setVideoUrl,
  videoLoading,
  setVideoLoading,
  videoStep,
  setVideoStep,
  videoError,
  setVideoError,
  displayMode,
  setDisplayMode,
  triggerVideoGeneration,
  handleGenerate,
  mode,
  setMode,
  setEnlargedImage
}: SmartRecTabProps) {
  const saas = useContext(SaasContext);

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

  const handleSmartGenerate = async () => {
    const res = await handleGenerate();
    if (!res.success) {
      alert(res.error || "生成失败");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid md:grid-cols-[1.1fr_0.9fr] lg:grid-cols-[1.2fr_1fr] gap-8">
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#EAE6DF] shadow-sm flex flex-col justify-between min-h-[520px] sm:min-h-[620px]">
        <div className="space-y-6 flex-1 flex flex-col">
          <div>
            <h2 className="text-lg font-semibold mb-2">上传手部照片</h2>
            <ImageUpload 
              image={handImage?.url || null} 
              onUpload={async (file) => {
                try {
                  const compressed = await compressImage(file);
                  setHandImage({ url: URL.createObjectURL(compressed), file: compressed });
                  setAnalysis(null);
                  setResultImage(null);
                  setVideoUrl(null);
                  setVideoError(null);
                  setHistory([]);
                } catch (e) {
                  console.error('Compression failed', e);
                  setHandImage({ url: URL.createObjectURL(file), file });
                }
              }} 
              label="上传手部照片"
              className="h-[480px] w-full max-w-md"
            />
          </div>

          {analysis && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6 flex-1 mt-6">
              <div className="bg-[#F2EFE9]/80 p-5 rounded-2xl border border-[#EAE6DF]">
                <h3 className="font-semibold text-[#4A443D] mb-3 flex items-center gap-2"><Sparkles size={18} className="text-[#7D756A]" /> 分析结果</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-3 rounded-xl shadow-xs border border-neutral-100">
                    <p className="text-xs text-[#968F85] mb-1">手型</p>
                    <p className="font-semibold text-sm">{analysis.handShape}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl shadow-xs border border-neutral-100">
                    <p className="text-xs text-[#968F85] mb-1">肤色</p>
                    <p className="font-semibold text-sm">{analysis.skinTone}</p>
                  </div>
                </div>
                <p className="text-sm text-[#696158] leading-relaxed">{analysis.explanation}</p>
              </div>

              <div>
                <div className="flex bg-[#F2EFE9] p-1 rounded-lg mb-4">
                  <button onClick={() => { setMode('recommend'); setSelectedStyle(analysis.recommendedStyle); }} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all cursor-pointer ${mode === 'recommend' ? 'bg-white shadow-xs text-[#4A443D]' : 'text-[#968F85] hover:text-[#696158]'}`}>使用推荐款式</button>
                  <button onClick={() => setMode('manual')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all cursor-pointer ${mode === 'manual' ? 'bg-white shadow-xs text-[#4A443D]' : 'text-[#968F85] hover:text-[#696158]'}`}>手动选择款式</button>
                </div>

                {mode === 'recommend' ? (
                  <div className="p-4 border-2 border-[#9C7A63] bg-[#4A443D] rounded-xl text-center shadow-inner">
                    <p className="text-xs text-[#B0A9A0] font-semibold mb-1 uppercase tracking-wider">推荐款式</p>
                    <p className="text-xl font-bold text-white">{analysis.recommendedStyle}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {STYLES.map(style => (
                      <button
                        key={style}
                        onClick={() => setSelectedStyle(style)}
                        className={`p-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                          selectedStyle === style 
                            ? 'border-[#9C7A63] bg-[#9C7A63] text-white shadow-xs' 
                            : 'border-[#EAE6DF] bg-white hover:border-[#D5CFC4] hover:bg-[#FAF8F5] text-[#696158]'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSmartGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-[#9C7A63] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#856550] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4 cursor-pointer"
              >
                {isGenerating ? <><Loader2 className="animate-spin" size={20} /> 生成中...</> : <><Wand2 size={20} /> 一键试戴</>}
              </button>
            </motion.div>
          )}
        </div>

        {!analysis && (
          <button
            onClick={handleAnalyze}
            disabled={!handImage || isAnalyzing}
            className="w-full py-4 bg-[#9C7A63] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#856550] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6 cursor-pointer"
          >
            {isAnalyzing ? <><Loader2 className="animate-spin" size={20} /> 分析手部特征...</> : <><Sparkles size={20} /> 智能分析手部特征</>}
          </button>
        )}
      </div>

      <ResultsPreviewPanel
        resultImage={resultImage}
        displayMode={displayMode}
        setDisplayMode={setDisplayMode}
        videoLoading={videoLoading}
        videoStep={videoStep}
        videoError={videoError}
        videoUrl={videoUrl}
        selectedStyle={selectedStyle}
        triggerVideoGeneration={triggerVideoGeneration}
        history={history}
        setEnlargedImage={setEnlargedImage}
      />
    </motion.div>
  );
}

interface CustomTabProps {
  handImage: { url: string; file: File } | null;
  setHandImage: React.Dispatch<React.SetStateAction<{ url: string; file: File } | null>>;
  nailImage: { url: string; file: File } | null;
  setNailImage: React.Dispatch<React.SetStateAction<{ url: string; file: File } | null>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  resultImage: string | null;
  setResultImage: React.Dispatch<React.SetStateAction<string | null>>;
  history: string[];
  setHistory: React.Dispatch<React.SetStateAction<string[]>>;
  handleGenerate: (additionalPrompt?: string) => Promise<{ success: boolean; result?: string; error?: string }>;
  setEnlargedImage: (img: string | null) => void;
}

function CustomTab({
  handImage,
  setHandImage,
  nailImage,
  setNailImage,
  isGenerating,
  setIsGenerating,
  resultImage,
  setResultImage,
  history,
  setHistory,
  handleGenerate,
  setEnlargedImage
}: CustomTabProps) {
  const handleCustomGenerate = async () => {
    const res = await handleGenerate();
    if (!res.success) {
      alert(res.error || "生成失败");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid md:grid-cols-[1.1fr_0.9fr] lg:grid-cols-[1.2fr_1fr] gap-8">
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#EAE6DF] shadow-sm flex flex-col justify-between min-h-[520px] sm:min-h-[620px]">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-2 text-[#4A443D]">手部照片</h2>
            <ImageUpload 
              image={handImage?.url || null} 
              onUpload={async (file) => {
                try {
                  const compressed = await compressImage(file);
                  setHandImage({ url: URL.createObjectURL(compressed), file: compressed });
                } catch (e) {
                  setHandImage({ url: URL.createObjectURL(file), file });
                }
                setResultImage(null);
                setHistory([]);
              }} 
              label="上传手部照片"
              className="h-[480px] w-full"
            />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2 text-[#4A443D]">美甲参考图</h2>
            <ImageUpload 
              image={nailImage?.url || null} 
              onUpload={async (file) => {
                try {
                  const compressed = await compressImage(file);
                  setNailImage({ url: URL.createObjectURL(compressed), file: compressed });
                } catch (e) {
                  setNailImage({ url: URL.createObjectURL(file), file });
                }
              }} 
              label="上传美甲参考"
              className="h-[480px] w-full"
            />
          </div>
        </div>

        <button
          onClick={handleCustomGenerate}
          disabled={!handImage || !nailImage || isGenerating}
          className="w-full py-4 bg-[#9C7A63] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#856550] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isGenerating ? <><Loader2 className="animate-spin" size={20} /> 生成中...</> : <><Wand2 size={20} /> 一键试戴</>}
        </button>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#EAE6DF] shadow-sm flex flex-col items-center justify-center min-h-[520px] sm:min-h-[620px]">
        {resultImage ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="w-full flex flex-col items-center gap-4">
              <h3 className="font-semibold text-[#968F85] w-full text-center text-sm">虚拟试戴效果</h3>
              <div className="relative group w-full max-w-sm aspect-[3/4]">
                <img 
                  src={resultImage} 
                  alt="Result" 
                  className="w-full h-full rounded-2xl shadow-md object-cover cursor-pointer" 
                  onClick={() => setEnlargedImage(resultImage)}
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); downloadSingleImage(resultImage); }}
                  className="absolute top-3 right-3 bg-white/90 text-[#696158] hover:text-[#7A5B45] p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                  title="下载当前图片"
                >
                  <Download size={18} />
                </button>
              </div>
            </div>
            
            {history.length > 0 && (
              <div className="w-full mt-4 pt-4 border-t border-neutral-100 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-medium text-[#B0A9A0] flex items-center gap-1"><History size={14} /> 历史记录 (点击放大)</h4>
                  <button 
                    onClick={() => downloadImages([resultImage, ...history])}
                    className="text-xs font-semibold text-[#4A443D] hover:text-[#7A5B45] flex items-center gap-1 underline underline-offset-2 cursor-pointer"
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
                         className="w-full h-full object-cover rounded-xl cursor-pointer border border-[#EAE6DF] shadow-sm hover:opacity-80 transition-opacity"
                         onClick={() => setEnlargedImage(img)}
                      />
                      <button 
                        onClick={(e) => { e.stopPropagation(); downloadSingleImage(img); }}
                        className="absolute top-1 right-1 bg-white/90 text-[#696158] hover:text-[#7A5B45] p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
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
          <div className="text-center text-[#B0A9A0] flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-[#FAF8F5] rounded-full flex items-center justify-center animate-pulse">
              <ImageIcon size={32} className="text-[#D5CFC4]" />
            </div>
            <p className="text-xs">上传图片及参考后点击一键试戴</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
