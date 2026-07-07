import React, { useState, useEffect, useRef } from 'react';
import { Upload, ImageIcon, Sparkles, Wand2, RefreshCw, Send, Loader2, AlertCircle, Coins, Download, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeHand, analyzeNailReference, chatWithAgent } from '../services/geminiService';
import { saasConsume, saasVerify } from '../services/saasService';
import { compressImage, fileToBase64 } from '../lib/utils';

export interface ChatMessage {
  id: string;
  sender: 'agent' | 'user' | 'system';
  type: 'text' | 'image' | 'action' | 'error';
  content?: string;
  actionType?: 'upload_hand' | 'upload_nail' | 'parameters' | 'confirm_generate';
  timestamp: Date;
}

const STYLES = ['猫眼', '法式', '渐变', '纯色', '装饰', '手绘'];

interface AgentTabProps {
  handImage: { url: string; file: File } | null;
  setHandImage: React.Dispatch<React.SetStateAction<{ url: string; file: File } | null>>;
  nailImage: { url: string; file: File } | null;
  setNailImage: React.Dispatch<React.SetStateAction<{ url: string; file: File } | null>>;
  aspectRatio: '1:1' | '16:9' | '9:16';
  setAspectRatio: React.Dispatch<React.SetStateAction<'1:1' | '16:9' | '9:16'>>;
  resolution: '1K' | '2K' | '4K';
  setResolution: React.Dispatch<React.SetStateAction<'1K' | '2K' | '4K'>>;
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
  selectedStyle: string;
  setSelectedStyle: React.Dispatch<React.SetStateAction<string>>;
  analysis: any;
  setAnalysis: React.Dispatch<React.SetStateAction<any>>;
  isAnalyzing: boolean;
  setIsAnalyzing: React.Dispatch<React.SetStateAction<boolean>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  handleGenerate: (additionalPrompt?: string) => Promise<{ success: boolean; result?: string; error?: string }>;
  handleResetAll: () => void;
  integral: number;
  setIntegral: React.Dispatch<React.SetStateAction<number>>;
  setEnlargedImage: (img: string | null) => void;
  triggerVideoGeneration: (imageBase64: string, styleDetails: string) => Promise<void>;
  userId: string;
  toolId: string;
}

function ChatMessageItem({
  msg,
  resultImage,
  videoLoading,
  videoStep,
  videoError,
  videoUrl,
  triggerVideoGeneration,
  selectedStyle,
  setEnlargedImage,
  aspectRatio,
  resolution,
}: {
  msg: ChatMessage;
  resultImage: string | null;
  videoLoading: boolean;
  videoStep: string;
  videoError: string | null;
  videoUrl: string | null;
  triggerVideoGeneration: (imageBase64: string, styleDetails: string) => Promise<void>;
  selectedStyle: string;
  setEnlargedImage: (img: string | null) => void;
  aspectRatio: string;
  resolution: string;
  key?: string;
}) {
  const isAgent = msg.sender === 'agent';
  const [cardTab, setCardTab] = useState<'image' | 'video'>('image');

  // If agent image message, it's the custom design generation result
  if (msg.type === 'image' && isAgent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="flex justify-start w-full"
      >
        <div className="max-w-[90%] sm:max-w-[80%] bg-white p-4 rounded-3xl border border-[#EAE6DF] shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-[#FAF8F5] pb-2">
            <span className="text-xs font-bold text-[#9C7A63] flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#9C7A63]" />
              美甲试戴成品
            </span>
            <span className="text-[10px] text-[#B0A9A0]">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="space-y-3">
            <div className="relative group max-w-sm aspect-[3/4] rounded-2xl overflow-hidden shadow-inner bg-stone-50 border border-stone-200">
              <img
                src={msg.content}
                alt="Generated Try-on"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setEnlargedImage(msg.content || null)}
              />
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const a = document.createElement('a');
                    a.href = msg.content!;
                    a.download = `nail-result-${Date.now()}.png`;
                    a.click();
                  }}
                  className="bg-white/95 hover:bg-white text-[#696158] hover:text-[#7A5B45] p-2 rounded-full shadow-md transition-all cursor-pointer"
                  title="下载图片"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-[#968F85] bg-[#FAF8F5] px-3 py-2 rounded-xl">
              <span>画面比例: <span className="font-semibold text-[#4A443D]">{aspectRatio}</span></span>
              <span>清晰度: <span className="font-semibold text-[#4A443D]">{resolution}</span></span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Fallbacks for other message types
  if (msg.type === 'text') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
      >
        <div
          className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-xs leading-relaxed text-sm ${
            isAgent
              ? 'bg-white border border-[#EAE6DF] text-[#4A443D] rounded-tl-none'
              : 'bg-[#9C7A63] text-white rounded-tr-none'
          }`}
        >
          <p className="whitespace-pre-line">{msg.content}</p>
          <span className={`text-[10px] block mt-1.5 text-right ${isAgent ? 'text-[#B0A9A0]' : 'text-white/75'}`}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </motion.div>
    );
  }

  if (msg.type === 'image') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
      >
        <div className="max-w-[70%] bg-white p-2 rounded-2xl border border-[#EAE6DF] shadow-xs">
          <img
            src={msg.content}
            alt="Uploaded"
            className="rounded-xl w-full max-h-56 object-cover shadow-inner cursor-pointer"
            onClick={() => setEnlargedImage(msg.content || null)}
          />
          <div className="flex justify-between items-center mt-2 px-1">
            <span className="text-[10px] text-[#B0A9A0]">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = msg.content!;
                a.download = `nail-upload-${Date.now()}.png`;
                a.click();
              }}
              className="p-1 rounded-full bg-stone-100 hover:bg-stone-200 text-[#696158] hover:text-[#4A443D] transition-colors cursor-pointer"
              title="下载此图片"
            >
              <Download size={12} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (msg.type === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="flex justify-start"
      >
        <div className="max-w-[85%] bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-2xl rounded-tl-none flex items-start gap-2.5 shadow-xs">
          <AlertCircle size={18} className="shrink-0 text-red-500 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-red-800">识别/生成出错</h4>
            <p className="text-xs mt-1 leading-relaxed">{msg.content}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}

export default function AgentTab({
  handImage,
  setHandImage,
  nailImage,
  setNailImage,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
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
  selectedStyle,
  setSelectedStyle,
  analysis,
  setAnalysis,
  isAnalyzing,
  setIsAnalyzing,
  isGenerating,
  setIsGenerating,
  handleGenerate,
  handleResetAll,
  integral,
  setIntegral,
  setEnlargedImage,
  triggerVideoGeneration,
  userId,
  toolId,
}: AgentTabProps) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize and load chat history when component mounts
  useEffect(() => {
    if (chatHistory.length === 0) {
      syncChatWithStates();
    }
  }, []);

  // Sync state-machine when switching views or after deep changes
  const syncChatWithStates = () => {
    const newHistory: ChatMessage[] = [];
    newHistory.push({
      id: 'welcome',
      sender: 'agent',
      type: 'text',
      content: "你好！我是您的 NailAI 智能美甲助手。现在，让我们开始第一步，请点击下方按钮上传您的手部照片吧！",
      timestamp: new Date(),
    });

    if (!handImage) {
      newHistory.push({
        id: 'action-1',
        sender: 'agent',
        type: 'action',
        actionType: 'upload_hand',
        timestamp: new Date(),
      });
      setChatHistory(newHistory);
      return;
    }

    // Hand photo exists
    newHistory.push({
      id: 'user-hand',
      sender: 'user',
      type: 'image',
      content: handImage.url,
      timestamp: new Date(),
    });

    if (analysis) {
      newHistory.push({
        id: 'analysis-report',
        sender: 'agent',
        type: 'text',
        content: `🎯 **手部特征分析完成！**\n\n👋 **手型特点**：${analysis.handShape}\n🎨 **肤色基调**：${analysis.skinTone}\n🌟 **最强匹配推荐**：【${analysis.recommendedStyle}】\n\n💡 *建议理由*：${analysis.explanation}`,
        timestamp: new Date(),
      });
    } else {
      newHistory.push({
        id: 'agent-hand-received',
        sender: 'agent',
        type: 'text',
        content: "手部照片已收到，真好看！接下来，请点击下方按钮上传您心仪的美甲款式或参考图片。",
        timestamp: new Date(),
      });
    }

    if (!nailImage && !selectedStyle) {
      newHistory.push({
        id: 'action-2',
        sender: 'agent',
        type: 'action',
        actionType: 'upload_nail',
        timestamp: new Date(),
      });
      setChatHistory(newHistory);
      return;
    }

    // Nail photo or style selection exists
    if (nailImage) {
      newHistory.push({
        id: 'user-nail',
        sender: 'user',
        type: 'image',
        content: nailImage.url,
        timestamp: new Date(),
      });
    } else if (selectedStyle) {
      newHistory.push({
        id: 'user-style',
        sender: 'user',
        type: 'text',
        content: `我选择推荐款式: 【${selectedStyle}】`,
        timestamp: new Date(),
      });
    }

    newHistory.push({
      id: 'agent-params-req',
      sender: 'agent',
      type: 'text',
      content: "非常棒！所需图片已备齐。在生成之前，您需要调整比例和清晰度吗？您可以在下方卡片中直接点选，也可以随时输入诸如 '16:9' 或 '4K' 来告诉我。",
      timestamp: new Date(),
    });

    newHistory.push({
      id: 'action-3',
      sender: 'agent',
      type: 'action',
      actionType: 'parameters',
      timestamp: new Date(),
    });

    setChatHistory(newHistory);
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAnalyzing, isGenerating]);

  const addMessage = (
    sender: 'agent' | 'user' | 'system',
    type: 'text' | 'image' | 'action' | 'error',
    content: string,
    actionType?: ChatMessage['actionType']
  ) => {
    const newMsg: ChatMessage = {
      id: `${sender}-${type}-${Date.now()}`,
      sender,
      type,
      content,
      actionType,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, newMsg]);
  };

  const handleUploadHand = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      const url = URL.createObjectURL(compressed);
      setHandImage({ url, file: compressed });

      addMessage('user', 'image', url);
      setIsAnalyzing(true);
      addMessage('agent', 'text', "✨ 正在深度分析您的手部特征（手型、肤色及最适美甲款式配对），请稍候...");

      const { base64, mimeType } = await fileToBase64(compressed);
      const res = await analyzeHand(base64, mimeType);

      setAnalysis(res);
      setSelectedStyle(res.recommendedStyle);
      setIsAnalyzing(false);

      addMessage('agent', 'text', `🎯 **分析完成！**\n\n👋 **手型特点**：${res.handShape}\n🎨 **肤色基调**：${res.skinTone}\n🌟 **最强匹配推荐**：【${res.recommendedStyle}】\n\n💡 *建议理由*：${res.explanation}`);
      addMessage('agent', 'text', "手部模型就绪！接下来，请点击下方按钮上传美甲参考图，或者直接在智能推荐款式中点击选用。");
      addMessage('agent', 'action', '', 'upload_nail');
    } catch (err: any) {
      setIsAnalyzing(false);
      console.error(err);
      addMessage('agent', 'error', `检测失败：未能成功识别手部特征。请重试，并确保手掌平放、拍摄清晰。`);
      addMessage('agent', 'action', '', 'upload_hand');
    }
  };

  const handleUploadNail = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      const url = URL.createObjectURL(compressed);
      setNailImage({ url, file: compressed });
      setSelectedStyle(''); // clear selected style preset

      addMessage('user', 'image', url);
      addMessage('agent', 'text', "✨ 正在智能分析您的美甲参考图，提取色彩、材质与 3D 配饰细节...");

      const { base64, mimeType } = await fileToBase64(compressed);
      const nailAnalysis = await analyzeNailReference(base64, mimeType);

      addMessage('agent', 'text', `🎨 **美甲特征提取成功！**\n\n💅 **长度甲型**：${nailAnalysis.length}\n🌸 **底色主调**：${nailAnalysis.color}\n✨ **表面质感**：${nailAnalysis.material}\n💎 **配饰设计**：${nailAnalysis.details}`);
      addMessage('agent', 'text', "非常棒！所需图片已备齐。在生成之前，您需要调整比例和清晰度吗？您可以在下方卡片中直接点选，也可以随时输入诸如 '16:9' 或 '4K' 来告诉我。");
      addMessage('agent', 'action', '', 'parameters');
    } catch (err: any) {
      console.error(err);
      addMessage('agent', 'error', "检测失败：未能解析美甲参考图细节，请重新上传清晰的美甲款式照片。");
      addMessage('agent', 'action', '', 'upload_nail');
    }
  };

  const handleSelectPresetStyle = (style: string) => {
    setSelectedStyle(style);
    setNailImage(null);

    addMessage('user', 'text', `我选择推荐款式: 【${style}】`);
    addMessage('agent', 'text', `收到！已锁定经典款式：【${style}】。`);
    addMessage('agent', 'text', "非常棒！所需图片已备齐。在生成之前，您需要调整比例和清晰度吗？您可以在下方卡片中直接点选，也可以随时输入诸如 '16:9' 或 '4K' 来告诉我。");
    addMessage('agent', 'action', '', 'parameters');
  };

  const handleConfirmParameters = () => {
    addMessage('user', 'text', `已确认参数：比例 [${aspectRatio}]，清晰度 [${resolution}]`);
    addMessage('agent', 'text', `一切准备就绪！本次生成将消耗 10 积分。\n\n如果您有其他特定的文字补充要求（例如："添加些许闪粉"或"款式低调一些"），可以直接在下方输入框中发消息告诉我。\n\n准备好后，请点击下方按钮开始试戴生成。`);
    addMessage('agent', 'action', '', 'confirm_generate');
  };

  const triggerAgentGenerate = async () => {
    addMessage('agent', 'text', "🚀 正在为您拼合并生成美甲虚拟试戴图，请稍后...");
    const res = await handleGenerate(additionalPrompt);
    if (res.success && res.result) {
      addMessage('agent', 'text', "🎉 生成成功！美甲虚拟试戴效果非常惊艳，图片已显示！");
      addMessage('agent', 'image', res.result);
    } else {
      addMessage('agent', 'error', `生成失败：${res.error || '未知错误，请检查积分余额并重试'}`);
      addMessage('agent', 'action', '', 'confirm_generate');
    }
  };

  const handleNewConversation = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      handleResetAll();
      setChatHistory([]);
      setAdditionalPrompt('');
      setInputText('');
      
      const resetHistory: ChatMessage[] = [{
        id: 'welcome',
        sender: 'agent',
        type: 'text',
        content: "你好！我是您的 NailAI 智能美甲助手。现在，让我们开始第一步，请点击下方按钮上传您的手部照片吧！",
        timestamp: new Date(),
      }, {
        id: 'action-1',
        sender: 'agent',
        type: 'action',
        actionType: 'upload_hand',
        timestamp: new Date(),
      }];
      setChatHistory(resetHistory);
      setIsRefreshing(false);
    }, 600);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const trimmed = inputText.trim();
    setInputText('');
    addMessage('user', 'text', trimmed);

    // 0. Check Integral
    const verifyRes = await saasVerify(userId, toolId);
    if (!verifyRes.success || (verifyRes.data && verifyRes.data.currentIntegral < verifyRes.data.requiredIntegral)) {
        addMessage('agent', 'text', "抱歉，您的积分不足，无法继续对话。请先获取更多积分。");
        return;
    }

    // 1. Check change reference
    if (/换.*衣服|换.*服装|换.*美甲|换.*款式|换.*参考|换.*图|换.*参照|换参照|换.*(猫眼|法式|渐变|纯色|装饰|手绘)/.test(trimmed)) {
      const styleMatch = trimmed.match(/(猫眼|法式|渐变|纯色|装饰|手绘)/);
      if (styleMatch) {
        const style = styleMatch[1];
        setNailImage(null);
        setSelectedStyle(style);
        setAdditionalPrompt('');
        addMessage('agent', 'text', `好的，已为您切换为 [${style}] 款式。`);
        addMessage('agent', 'text', "🚀 正在为您拼合并生成美甲虚拟试戴图，请稍后...");
        const res = await handleGenerate('', style, null);
        if (res.success && res.result) {
          addMessage('agent', 'text', "🎉 生成成功！美甲虚拟试戴效果非常惊艳，图片已显示！");
          addMessage('agent', 'image', res.result);
        } else {
          addMessage('agent', 'text', `抱歉，切换失败：${res.error}`);
        }
        return;
      }
      // Custom style
      setNailImage(null);
      setSelectedStyle('custom');
      setAdditionalPrompt(trimmed);
      addMessage('agent', 'text', `好的，已为您切换为自定义款式：[${trimmed}]。`);
      addMessage('agent', 'text', "🚀 正在为您拼合并生成美甲虚拟试戴图，请稍后...");
      const res = await handleGenerate(trimmed, 'custom', null);
      if (res.success && res.result) {
        addMessage('agent', 'text', "🎉 生成成功！美甲虚拟试戴效果非常惊艳，图片已显示！");
        addMessage('agent', 'image', res.result);
      } else {
        addMessage('agent', 'text', `抱歉，切换失败：${res.error}`);
      }
      return;
    }

    // 2. Check change subject / hand
    if (/换.*主体|换.*宠物|换.*猫|换.*狗|换.*手|换.*底图|换底图/.test(trimmed)) {
      setHandImage(null);
      setAnalysis(null);
      addMessage('agent', 'text', "好的，已为您重置手部照片！请重新上传您的手部照片。");
      addMessage('agent', 'action', '', 'upload_hand');
      return;
    }

    // 3. Reset all
    if (/重新|重来|全换/.test(trimmed)) {
      addMessage('agent', 'text', "收到，正在为您重置全部数据并重新开启对话...");
      handleNewConversation();
      return;
    }

    // 4. Aspect Ratio match
    const ratioMatch = trimmed.match(/(16:9|9:16|1:1|3:4|4:3)/);
    if (ratioMatch) {
      const val = ratioMatch[1];
      setAspectRatio(val as any);
      addMessage('agent', 'text', `已为您将比例调整为 [${val}]`);
      return;
    }

    // 5. Resolution match
    const resMatch = trimmed.match(/(1k|2k|4k)/i);
    if (resMatch) {
      const val = resMatch[1].toUpperCase() as any;
      setResolution(val);
      addMessage('agent', 'text', `已为您将清晰度调整为 [${val}]`);
      return;
    }

    // 6. Generate match
    if (/生成|开始|作图|画/.test(trimmed)) {
      if (!handImage) {
        addMessage('agent', 'text', "您还没有上传手部照片哦，请点击下方按钮先上传手部照片。");
        addMessage('agent', 'action', '', 'upload_hand');
        return;
      }
      if (!nailImage && !selectedStyle) {
        addMessage('agent', 'text', "您还没有提供美甲参考图，请先上传或选择一款设计。");
        addMessage('agent', 'action', '', 'upload_nail');
        return;
      }
      triggerAgentGenerate();
      return;
    }

    // 7. General text - Intelligent Chat
    try {
      const messagesForGemini = chatHistory.concat({
          id: Date.now().toString(),
          sender: 'user',
          type: 'text',
          content: trimmed,
          timestamp: new Date()
      }).map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          content: m.content || ''
      }));

      const response = await chatWithAgent(messagesForGemini);
      
      // Consume Integral
      const consumeRes = await saasConsume(userId, toolId);
      if (consumeRes.success) {
          setIntegral(consumeRes.data.currentIntegral);
          addMessage('agent', 'text', response.response);
      } else {
          addMessage('agent', 'text', "积分扣除失败，请稍后再试。");
      }
    } catch (error) {
      addMessage('agent', 'text', "抱歉，刚才连接有点问题，能再说一次吗？");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[650px] bg-white rounded-3xl border border-[#EAE6DF] shadow-sm overflow-hidden">
      {/* Agent Chat Header */}
      <div className="bg-[#FAF8F5] border-b border-[#EAE6DF] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#9C7A63] rounded-full flex items-center justify-center text-white shrink-0 shadow-xs relative">
            <Sparkles size={20} className="text-white" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
          </div>
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-[#4A443D] flex items-center gap-1.5">
              NailAI 智能顾问
            </h3>
            <p className="text-xs text-[#968F85] flex items-center gap-1">
              <span>智能体在线</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleNewConversation}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#EAE6DF] text-xs font-semibold text-[#696158] hover:text-[#7A5B45] hover:border-[#D5CFC4] hover:shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
        >
          <RefreshCw size={14} className={`${isRefreshing ? 'animate-spin' : ''}`} />
          开启新对话
        </button>
      </div>

      {/* Message scroll viewport */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#FAF8F5]/30 space-y-6">
        <AnimatePresence initial={false}>
          {chatHistory.map((msg) => {
            if (msg.type !== 'action') {
              return (
                <ChatMessageItem
                  key={msg.id}
                  msg={msg}
                  resultImage={resultImage}
                  videoLoading={videoLoading}
                  videoStep={videoStep}
                  videoError={videoError}
                  videoUrl={videoUrl}
                  triggerVideoGeneration={triggerVideoGeneration}
                  selectedStyle={selectedStyle}
                  setEnlargedImage={setEnlargedImage}
                  aspectRatio={aspectRatio}
                  resolution={resolution}
                />
              );
            }

            if (msg.type === 'action') {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start w-full"
                >
                  <div className="w-full max-w-[90%] bg-white border border-[#EAE6DF] p-5 rounded-2xl rounded-tl-none shadow-xs space-y-4">
                    {msg.actionType === 'upload_hand' && (
                      <div className="space-y-2">
                        <label className="cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#D5CFC4] bg-[#FAF8F5] rounded-xl hover:border-[#9C7A63] hover:bg-[#FAF8F5]/80 active:scale-[0.98] transition-all group">
                          <Upload className="text-[#968F85] group-hover:text-[#9C7A63] mb-2 group-hover:scale-110 transition-transform" size={24} />
                          <span className="text-xs font-semibold text-[#696158]">点击选择或拖拽上传手部照片</span>
                          <span className="text-[10px] text-stone-400 mt-1">支持 PNG, JPG 等通用格式</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadHand(file);
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {msg.actionType === 'upload_nail' && (
                      <div className="space-y-4">
                        <label className="cursor-pointer flex flex-col items-center justify-center p-5 border-2 border-dashed border-[#D5CFC4] bg-[#FAF8F5] rounded-xl hover:border-[#9C7A63] hover:bg-[#FAF8F5]/80 active:scale-[0.98] transition-all group">
                          <ImageIcon className="text-[#968F85] group-hover:text-[#9C7A63] mb-2 group-hover:scale-110 transition-transform" size={24} />
                          <span className="text-xs font-semibold text-[#696158]">点击选择或上传美甲参考图</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadNail(file);
                            }}
                          />
                        </label>
                        <div className="relative flex items-center justify-center">
                          <span className="absolute inset-x-0 h-px bg-[#EAE6DF]"></span>
                          <span className="relative px-3 bg-white text-[10px] text-[#B0A9A0] font-bold tracking-wider uppercase">或直接点击选择推荐款式</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {STYLES.map((style) => (
                            <button
                              key={style}
                              onClick={() => handleSelectPresetStyle(style)}
                              className="py-2 px-1 rounded-lg border border-[#EAE6DF] hover:border-[#9C7A63] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#696158] active:scale-95 transition-all text-center cursor-pointer"
                            >
                              {style}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.actionType === 'parameters' && (
                      <div className="space-y-4">
                        <div>
                          <span className="text-[10px] font-bold text-[#B0A9A0] uppercase tracking-wider block mb-2">
                            画面比例 (Aspect Ratio)
                          </span>
                          <div className="grid grid-cols-5 gap-2">
                            {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map((ratio) => (
                              <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                  aspectRatio === ratio
                                    ? 'border-[#9C7A63] bg-[#9C7A63] text-white shadow-xs'
                                    : 'border-[#EAE6DF] bg-white text-[#696158] hover:border-[#9C7A63]'
                                }`}
                              >
                                {ratio}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-[#B0A9A0] uppercase tracking-wider block mb-2">
                            清晰度 (Resolution)
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {(['1K', '2K', '4K'] as const).map((res) => (
                              <button
                                key={res}
                                onClick={() => setResolution(res)}
                                className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                  resolution === res
                                    ? 'border-[#9C7A63] bg-[#9C7A63] text-white shadow-xs'
                                    : 'border-[#EAE6DF] bg-white text-[#696158] hover:border-[#9C7A63]'
                                }`}
                              >
                                {res}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleConfirmParameters}
                          className="w-full py-2.5 bg-[#9C7A63] hover:bg-[#856550] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          确认当前参数
                        </button>
                      </div>
                    )}

                    {msg.actionType === 'confirm_generate' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-[#696158]">
                          <span className="font-semibold">本次生成消耗积分:</span>
                          <span className="font-bold text-[#9C7A63] flex items-center gap-1">
                            <Coins size={12} /> 10 积分
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                          点击下方按钮后，我们将启动高分辨率美甲渲染流程（画面比例：{aspectRatio}，画质清晰度：{resolution}）。生成完毕后会自动渲染专属 3D 试戴旋转展示视频。
                        </p>
                        <button
                          onClick={triggerAgentGenerate}
                          disabled={isGenerating}
                          className="w-full py-3 bg-gradient-to-r from-[#9C7A63] to-[#856550] text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="animate-spin" size={14} />
                              生成中...
                            </>
                          ) : (
                            <>
                              <Wand2 size={14} />
                              一键开始试戴生成
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            }

            return null;
          })}
        </AnimatePresence>

        {/* Inline typing & background loading status indicators */}
        {isAnalyzing && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white border border-[#EAE6DF] text-[#696158] px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2 shadow-xs">
              <Loader2 className="animate-spin text-[#9C7A63]" size={16} />
              <span className="text-xs font-medium">智能顾问正在分析并配置最佳选项...</span>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white border border-[#EAE6DF] text-[#696158] px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2 shadow-xs">
              <Loader2 className="animate-spin text-[#9C7A63]" size={16} />
              <span className="text-xs font-medium">正在启动 Gemini 指面贴片智能融合与反射生成中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input dialog bar */}
      <div className="bg-white border-t border-[#EAE6DF] p-4 flex gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="给智能体发消息（例如：'换成 16:9'，'重新来'，'换底图'）..."
          className="flex-1 px-4 py-2.5 rounded-full border border-[#EAE6DF] focus:border-[#9C7A63] focus:outline-none text-sm text-[#4A443D] placeholder-stone-400"
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputText.trim()}
          className="w-10 h-10 bg-[#9C7A63] hover:bg-[#856550] disabled:bg-stone-100 text-white disabled:text-stone-300 rounded-full flex items-center justify-center transition-all cursor-pointer"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
