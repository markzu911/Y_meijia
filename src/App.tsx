import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Coins, Download, History, Image as ImageIcon, Loader2, Sparkles, Upload, Wand2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { fileToBase64 } from './lib/utils';
import { analyzeHand, analyzeNailReference, generateNailTryOn } from './services/geminiService';
import { consumeIntegral, launchTool, type InitPayload, verifyIntegral } from './services/saasService';

const STYLES = ['猫眼', '法式', '渐变', '纯色', '装饰', '手绘'];

const STYLE_PROMPTS: Record<string, string> = {
  猫眼: 'Medium-length square nails. Base color is a translucent dusty pinkish-purple (mauve) with a magnetic cat-eye shimmer effect. Thumb: Gold crescent moon charm with a gold starburst inside. Index & Ring fingers: A large oval purple gem in the center, framed by an ornate silver vintage border with tiny rhinestones. Middle finger: A gold geometric star/cross charm with a small blue gem at the top. Pinky: A delicate silver rhinestone curved line. The 3D charms, colors, and shape MUST be exactly as described.',
  法式: 'Medium-length square nails. Sheer nude/blush pink base color. Very thin, precise white French tip line at the very edge of the nails. Extremely glossy finish. Minimalist and clean, NO other decorations.',
  渐变: 'Long almond-shaped nails. Soft blush pink ombre/gradient effect, starting from a natural sheer nude at the cuticle and blending into a deeper rosy pink towards the tips. Extremely glossy, jelly-like finish. NO decorations, just the smooth gradient.',
  纯色: 'Medium-length square nails. Solid, opaque Tiffany blue / bright mint green color. Extremely glossy and smooth finish. Clean and simple, NO decorations, NO patterns.',
  装饰: 'Long almond-shaped nails. Sheer, almost clear nude base. Decorated with fine silver glitter forming a diamond lattice/argyle pattern on some nails. Other nails feature silver chain borders and small square silver diamond/rhinestone charms placed near the cuticles or tips. Highly sparkling and luxurious.',
  手绘: 'Long almond-shaped nails. Base is a mix of sheer nude and milky white. Features detailed hand-painted nail art: brown teddy bears, ice cream cones, delicate white bows, small red stars, and colorful confetti/sprinkles. Some nails have a milky white French tip section. Playful and cute style.',
};

type ToolSession = InitPayload & {
  userName?: string;
  enterprise?: string;
  integral: number;
  requiredIntegral: number;
};

declare global {
  interface Window {
    __NAILAI_INIT__?: InitPayload;
  }
}

const isValidId = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.trim();
  return normalized !== '' && normalized !== 'null' && normalized !== 'undefined';
};

const getInitFromUrl = (): InitPayload | null => {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('userId');
  const toolId = params.get('toolId');

  if (!isValidId(userId) || !isValidId(toolId)) {
    return null;
  }

  const context = params.get('context') || undefined;
  const prompt = params.getAll('prompt');
  const callbackUrl = params.get('callbackUrl') || undefined;

  return {
    userId: userId!.trim(),
    toolId: toolId!.trim(),
    context,
    prompt: prompt.length > 0 ? prompt : undefined,
    callbackUrl,
  };
};

const normalizeInitPayload = (payload: unknown): InitPayload | null => {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const userId = typeof raw.userId === 'string' ? raw.userId.trim() : '';
  const toolId = typeof raw.toolId === 'string' ? raw.toolId.trim() : '';

  if (!isValidId(userId) || !isValidId(toolId)) {
    return null;
  }

  const context = typeof raw.context === 'string' ? raw.context : undefined;
  const callbackUrl = typeof raw.callbackUrl === 'string' ? raw.callbackUrl : undefined;
  const prompt = Array.isArray(raw.prompt)
    ? raw.prompt.filter((item): item is string => typeof item === 'string')
    : typeof raw.prompt === 'string'
      ? raw.prompt
      : undefined;

  return { userId, toolId, context, prompt, callbackUrl };
};

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

type PageHeaderProps = {
  activeTab: 'smart' | 'custom';
  onTabChange: (tab: 'smart' | 'custom') => void;
  session: ToolSession | null;
  launchLoading: boolean;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'smart' | 'custom'>('smart');
  const [session, setSession] = useState<ToolSession | null>(null);
  const [launchLoading, setLaunchLoading] = useState(true);
  const [initError, setInitError] = useState<string>('');

  const initToolSession = async (payload: InitPayload) => {
    setLaunchLoading(true);
    setInitError('');

    try {
      const result = await launchTool(payload.userId, payload.toolId);
      if (!result.success || !result.data) {
        throw new Error(result.message || '获取用户信息失败');
      }

      setSession({
        ...payload,
        userName: result.data.user?.name,
        enterprise: result.data.user?.enterprise,
        integral: result.data.user?.integral ?? 0,
        requiredIntegral: result.data.tool?.integral ?? 0,
      });
    } catch (error) {
      console.error(error);
      setSession(null);
      setInitError(error instanceof Error ? error.message : '获取用户信息失败');
    } finally {
      setLaunchLoading(false);
    }
  };

  useEffect(() => {
    const initialPayload = window.__NAILAI_INIT__ || getInitFromUrl();
    if (initialPayload) {
      void initToolSession(initialPayload);
    } else {
      setLaunchLoading(false);
      setInitError('未获取到 userId 和 toolId，请通过 SaaS 容器或 URL 参数初始化页面。');
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } & InitPayload;
      if (data?.type !== 'SAAS_INIT') return;
      const normalized = normalizeInitPayload(data);
      if (!normalized) {
        setInitError('收到的初始化参数无效。');
        return;
      }
      window.__NAILAI_INIT__ = normalized;
      void initToolSession(normalized);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const promptContext = useMemo(() => {
    if (!session) return '';
    const promptText = Array.isArray(session.prompt) ? session.prompt.join('，') : session.prompt || '';
    return [session.context, promptText].filter(Boolean).join('；');
  }, [session]);

  const verifyBeforeAction = async () => {
    if (!session) {
      throw new Error('用户信息未初始化，暂时无法操作。');
    }

    const result = await verifyIntegral(session.userId, session.toolId);
    if (!result.success) {
      throw new Error(result.message || '积分不足');
    }

    setSession((current) => current ? {
      ...current,
      integral: result.data?.currentIntegral ?? current.integral,
      requiredIntegral: result.data?.requiredIntegral ?? current.requiredIntegral,
    } : current);
  };

  const consumeAfterGeneration = async () => {
    if (!session) {
      throw new Error('用户信息未初始化，无法扣除积分。');
    }

    const result = await consumeIntegral(session.userId, session.toolId);
    if (!result.success) {
      throw new Error(result.message || '扣积分失败');
    }

    setSession((current) => current ? {
      ...current,
      integral: result.data?.currentIntegral ?? current.integral,
    } : current);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <PageHeader activeTab={activeTab} onTabChange={setActiveTab} session={session} launchLoading={launchLoading} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {initError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{initError}</div>
        ) : (
          <>
            <div className={activeTab === 'smart' ? 'block' : 'hidden'}>
              <SmartRecTab
                promptContext={promptContext}
                disabled={launchLoading || !session}
                onVerify={verifyBeforeAction}
                onConsume={consumeAfterGeneration}
              />
            </div>
            <div className={activeTab === 'custom' ? 'block' : 'hidden'}>
              <CustomTab
                promptContext={promptContext}
                disabled={launchLoading || !session}
                onVerify={verifyBeforeAction}
                onConsume={consumeAfterGeneration}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PageHeader({ activeTab, onTabChange, session, launchLoading }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500 text-white">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">NailAI 美甲工作室</h1>
            {session?.userName ? (
              <p className="text-xs text-neutral-500">
                {session.userName}
                {session.enterprise ? ` · ${session.enterprise}` : ''}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden rounded-lg bg-neutral-100 p-1 sm:flex">
            <TabButton active={activeTab === 'smart'} onClick={() => onTabChange('smart')} icon={<Sparkles size={16} />} label="智能推荐" />
            <TabButton active={activeTab === 'custom'} onClick={() => onTabChange('custom')} icon={<ImageIcon size={16} />} label="自定义款式" />
          </nav>
          <div className="flex min-w-[110px] items-center justify-end gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
            <Coins size={16} />
            {launchLoading ? '加载中...' : `积分 ${session?.integral ?? '--'}`}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-3 sm:hidden">
        <nav className="flex rounded-lg bg-neutral-100 p-1">
          <TabButton active={activeTab === 'smart'} onClick={() => onTabChange('smart')} icon={<Sparkles size={16} />} label="智能推荐" />
          <TabButton active={activeTab === 'custom'} onClick={() => onTabChange('custom')} icon={<ImageIcon size={16} />} label="自定义款式" />
        </nav>
      </div>
    </header>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
        active ? 'bg-white text-pink-600 shadow-sm' : 'text-neutral-500 hover:bg-neutral-200/50 hover:text-neutral-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ImageUpload({ image, onUpload, label }: { image: string | null; onUpload: (file: File) => void; label: string }) {
  return (
    <div className="group relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-100 transition-colors hover:border-pink-400 hover:bg-pink-50/50">
      {image ? (
        <>
          <img src={image} alt="Uploaded" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100">
              <Camera size={16} />
              更换照片
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
            </label>
          </div>
        </>
      ) : (
        <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 p-6 text-center text-neutral-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-400 shadow-sm transition-all group-hover:scale-110 group-hover:text-pink-500">
            <Upload size={24} />
          </div>
          <div>
            <p className="font-medium text-neutral-700">{label}</p>
            <p className="mt-1 text-xs text-neutral-400">点击或拖拽上传</p>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

type SharedActionProps = {
  promptContext: string;
  disabled: boolean;
  onVerify: () => Promise<void>;
  onConsume: () => Promise<void>;
};

function SmartRecTab({ promptContext, disabled, onVerify, onConsume }: SharedActionProps) {
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
    if (!handImage || disabled) return;
    setIsAnalyzing(true);
    try {
      await onVerify();
      const { base64, mimeType } = await fileToBase64(handImage.file);
      const result = await analyzeHand(base64, mimeType);
      setAnalysis(result);
      setSelectedStyle(result.recommendedStyle);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '分析手部特征失败。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!handImage || !selectedStyle || disabled) return;
    setIsGenerating(true);
    try {
      await onVerify();
      const { base64, mimeType } = await fileToBase64(handImage.file);
      const styleDescription = STYLE_PROMPTS[selectedStyle] || `Apply ${selectedStyle} style nails`;
      const mergedPrompt = [styleDescription, promptContext].filter(Boolean).join('. ');
      const prompt = `Strictly generate the nails with the following exact specifications: ${mergedPrompt}. The result MUST perfectly match this description.`;
      const result = await generateNailTryOn(base64, mimeType, prompt);
      await onConsume();

      if (resultImage) {
        setHistory((prev) => [resultImage, ...prev]);
      }
      setResultImage(result);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '生成图片失败。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-semibold">1. 上传手部照片</h2>
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
              disabled={!handImage || isAnalyzing || disabled}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 py-4 font-medium text-white transition-colors hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? <><Loader2 className="animate-spin" size={20} /> 分析手部特征中...</> : <><Sparkles size={20} /> 分析手部特征</>}
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6">
              <div className="rounded-2xl border border-pink-100 bg-pink-50 p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-pink-900"><Sparkles size={18} /> 分析结果</h3>
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="mb-1 text-xs text-neutral-500">手型</p>
                    <p className="text-sm font-medium">{analysis.handShape}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="mb-1 text-xs text-neutral-500">肤色</p>
                    <p className="text-sm font-medium">{analysis.skinTone}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-pink-800">{analysis.explanation}</p>
              </div>

              <div>
                <div className="mb-4 flex rounded-lg bg-neutral-100 p-1">
                  <button onClick={() => { setMode('recommend'); setSelectedStyle(analysis.recommendedStyle); }} className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${mode === 'recommend' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>使用推荐款式</button>
                  <button onClick={() => setMode('manual')} className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>手动选择款式</button>
                </div>

                {mode === 'recommend' ? (
                  <div className="rounded-xl border-2 border-pink-500 bg-pink-50 p-4 text-center">
                    <p className="mb-1 text-sm font-medium text-pink-600">推荐款式</p>
                    <p className="text-xl font-bold text-pink-900">{analysis.recommendedStyle}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {STYLES.map((style) => (
                      <button
                        key={style}
                        onClick={() => setSelectedStyle(style)}
                        className={`rounded-xl border p-3 text-sm font-medium transition-all ${
                          selectedStyle === style
                            ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-sm'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
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
                disabled={isGenerating || disabled}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-4 font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? <><Loader2 className="animate-spin" size={20} /> 试戴生成中...</> : <><Wand2 size={20} /> 一键试戴</>}
              </button>
            </motion.div>
          )}
        </div>

        <ResultPanel
          resultImage={resultImage}
          history={history}
          emptyText="生成的试戴效果将显示在这里"
          enlargedImage={enlargedImage}
          onOpenImage={setEnlargedImage}
          onCloseImage={() => setEnlargedImage(null)}
        />
      </motion.div>
    </>
  );
}

function CustomTab({ promptContext, disabled, onVerify, onConsume }: SharedActionProps) {
  const [handImage, setHandImage] = useState<{ url: string; file: File } | null>(null);
  const [nailImage, setNailImage] = useState<{ url: string; file: File } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!handImage || !nailImage || disabled) return;
    setIsGenerating(true);
    try {
      await onVerify();
      const { base64, mimeType } = await fileToBase64(handImage.file);
      const { base64: refBase64, mimeType: refMimeType } = await fileToBase64(nailImage.file);

      const analysis = await analyzeNailReference(refBase64, refMimeType);
      const details = `Nail Shape & Length: ${analysis.length}. Base Color: ${analysis.color}. Material/Texture: ${analysis.material}. 3D Decorations & Patterns: ${analysis.details}.`;
      const detailedPrompt = [details, promptContext].filter(Boolean).join('. ');
      const result = await generateNailTryOn(base64, mimeType, detailedPrompt, refBase64, refMimeType);
      await onConsume();

      if (resultImage) {
        setHistory((prev) => [resultImage, ...prev]);
      }
      setResultImage(result);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '生成图片失败。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h2 className="mb-2 text-lg font-semibold">手部照片</h2>
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
              <h2 className="mb-2 text-lg font-semibold">美甲参考图</h2>
              <ImageUpload
                image={nailImage?.url || null}
                onUpload={(file) => setNailImage({ url: URL.createObjectURL(file), file })}
                label="上传美甲参考图"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!handImage || !nailImage || isGenerating || disabled}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-4 font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? <><Loader2 className="animate-spin" size={20} /> 试戴生成中...</> : <><Wand2 size={20} /> 一键试戴</>}
          </button>
        </div>

        <ResultPanel
          resultImage={resultImage}
          history={history}
          emptyText="上传图片后点击生成"
          enlargedImage={enlargedImage}
          onOpenImage={setEnlargedImage}
          onCloseImage={() => setEnlargedImage(null)}
        />
      </motion.div>
    </>
  );
}

type ResultPanelProps = {
  resultImage: string | null;
  history: string[];
  emptyText: string;
  enlargedImage: string | null;
  onOpenImage: (image: string) => void;
  onCloseImage: () => void;
};

function ResultPanel({ resultImage, history, emptyText, enlargedImage, onOpenImage, onCloseImage }: ResultPanelProps) {
  return (
    <>
      <div className="flex min-h-[500px] flex-col items-center justify-center rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        {resultImage ? (
          <div className="flex h-full w-full flex-col items-center gap-4">
            <h3 className="w-full text-center font-medium text-neutral-500">虚拟试戴效果</h3>
            <div className="group relative aspect-[3/4] w-full max-w-sm">
              <img
                src={resultImage}
                alt="Result"
                className="h-full w-full cursor-pointer rounded-2xl object-cover shadow-md"
                onClick={() => onOpenImage(resultImage)}
              />
              <button
                onClick={(e) => { e.stopPropagation(); downloadSingleImage(resultImage); }}
                className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-neutral-700 opacity-0 shadow-sm transition-opacity hover:text-black group-hover:opacity-100"
                title="下载当前图片"
              >
                <Download size={18} />
              </button>
            </div>

            {history.length > 0 && (
              <div className="mt-4 w-full border-t border-neutral-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-1 text-xs font-medium text-neutral-400"><History size={14} /> 历史记录（点击放大）</h4>
                  <button
                    onClick={() => downloadImages([resultImage, ...history])}
                    className="flex items-center gap-1 text-xs font-medium text-pink-600 hover:text-pink-700"
                  >
                    <Download size={14} /> 下载全部
                  </button>
                </div>
                <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                  {history.map((img, i) => (
                    <div key={i} className="group relative h-28 w-20 flex-shrink-0 snap-start">
                      <img
                        src={img}
                        alt={`History ${i}`}
                        className="h-full w-full cursor-pointer rounded-xl border border-neutral-200 object-cover shadow-sm transition-opacity hover:opacity-80"
                        onClick={() => onOpenImage(img)}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadSingleImage(img); }}
                        className="absolute right-1 top-1 rounded-full bg-white/90 p-1.5 text-neutral-700 opacity-0 shadow-sm transition-opacity hover:text-black group-hover:opacity-100"
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
          <div className="flex flex-col items-center gap-3 text-center text-neutral-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-50">
              <ImageIcon size={32} className="text-neutral-300" />
            </div>
            <p>{emptyText}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {enlargedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={onCloseImage}
          >
            <img
              src={enlargedImage}
              alt="Enlarged Result"
              className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute right-6 top-6 flex gap-3">
              <button
                className="flex items-center justify-center rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/80"
                onClick={(e) => { e.stopPropagation(); downloadSingleImage(enlargedImage); }}
                title="下载"
              >
                <Download size={24} />
              </button>
              <button
                className="flex items-center justify-center rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/80"
                onClick={onCloseImage}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
