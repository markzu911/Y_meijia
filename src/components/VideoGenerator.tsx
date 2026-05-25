import React, { useState, useRef, useEffect } from 'react';
import { Film, Download, Loader2, Sparkles, AlertCircle, Play, Pause, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoGeneratorProps {
  imageSrc: string;
  onClose?: () => void;
}

export default function VideoGenerator({ imageSrc, onClose }: VideoGeneratorProps) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [generationMode, setGenerationMode] = useState<'veo' | 'local'>('veo');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [videoUrl]);

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleGenerate = async () => {
    if (generationMode === 'veo') {
      await generateVideoVeo();
    } else {
      await generateVideoLocal();
    }
  };

  // 1. Gemini Veo Video Generation (The real deal - flips and turns hand realistically)
  const generateVideoVeo = async () => {
    setStatus('generating');
    setProgress(0);
    setErrorMessage('');

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: imageSrc,
          mimeType: 'image/png'
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Gemini Veo API 启动视频生成任务失败');
      }

      const { operationName } = await response.json();
      if (!operationName) {
        throw new Error('未获取到视频生成的操作任务ID');
      }

      // Polling
      let isDone = false;
      let attempts = 0;
      const maxAttempts = 120; // Allow 4 minutes

      while (!isDone && attempts < maxAttempts) {
        // Wait 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 3000));
        attempts++;

        // Faux progress simulation up to 98% to excite user
        setProgress(Math.min(98, Math.round((attempts / 40) * 100)));

        const statusResponse = await fetch('/api/video/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operationName })
        });

        if (!statusResponse.ok) {
          continue; // Handle transient error during polling gracefully
        }

        const data = await statusResponse.json();
        if (data.done) {
          isDone = true;
        }
      }

      if (!isDone) {
        throw new Error('视频生成超时，由于后端排列任务过多，请稍后重试或切换本地拟态渲染');
      }

      setProgress(100);

      // Fetch downloadable stream
      const downloadResponse = await fetch('/api/video/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operationName })
      });

      if (!downloadResponse.ok) {
        throw new Error('获取已生成视频流数据失败');
      }

      const blob = await downloadResponse.blob();
      const videoBlobUrl = URL.createObjectURL(blob);
      setVideoUrl(videoBlobUrl);
      setStatus('completed');
      setIsPlaying(true);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gemini Veo 视频生成出错，您可以点击下方切换为“本地3D拟态试戴”秒级渲染。');
      setStatus('error');
    }
  };

  // 2. Local 3D simulation renderer (instant fallback backup strategy)
  const generateVideoLocal = async () => {
    setStatus('generating');
    setProgress(0);
    setErrorMessage('');

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片加载失败，无法生成视频'));
        img.src = imageSrc;
      });

      const canvas = canvasRef.current;
      if (!canvas) throw new Error('画布初始化失败');

      const width = 720;
      const height = 960;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建画布渲染上下文');

      const stream = canvas.captureStream(30);
      
      let mimeType = 'video/mp4;codecs=h264';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp9';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3000000
      });

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(videoBlob);
        setVideoUrl(url);
        setStatus('completed');
        setIsPlaying(true);
      };

      const duration = 4500;
      const fps = 30;
      const totalFrames = (duration / 1000) * fps;
      let frame = 0;

      recorder.start();

      const sparkles = Array.from({ length: 18 }, () => ({
        x: (Math.random() - 0.5) * 280,
        y: (Math.random() - 0.2) * 320,
        size: Math.random() * 5 + 3,
        speed: Math.random() * 0.08 + 0.04,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.5 ? '#FFFFFF' : '#FFDF9E'
      }));

      return new Promise<void>((resolve) => {
        const render = () => {
          if (frame >= totalFrames) {
            recorder.stop();
            if (animationFrameId.current) {
              cancelAnimationFrame(animationFrameId.current);
            }
            resolve();
            return;
          }

          const ratio = frame / totalFrames;
          setProgress(Math.round(ratio * 100));

          ctx.clearRect(0, 0, width, height);

          let actionLabel = "";
          let zoomScale = 1.05;
          let focalX = 0;
          let focalY = -40;
          let handFlexMultiplier = 0;
          let catEyeSweep = 0;
          let lightRingPower = 0.4;

          if (ratio < 0.3) {
            actionLabel = "ACTION 1: 细节特写与肌理慢镜头";
            const sRatio = ratio / 0.3;
            zoomScale = 1.04 + sRatio * 0.06;
            focalY = -40 + sRatio * 15;
            handFlexMultiplier = Math.sin(sRatio * Math.PI * 0.5) * 4;
            catEyeSweep = -1 + sRatio * 0.8;
            lightRingPower = 0.35 + Math.sin(sRatio * Math.PI) * 0.15;
          } else if (ratio >= 0.3 && ratio < 0.7) {
            actionLabel = "ACTION 2: 3D指间微弯动作与翻转";
            const sRatio = (ratio - 0.3) / 0.4;
            zoomScale = 1.10 - Math.sin(sRatio * Math.PI) * 0.03;
            focalX = Math.sin(sRatio * Math.PI * 2) * 12;
            focalY = -25 - Math.sin(sRatio * Math.PI) * 10;
            handFlexMultiplier = 16 * Math.sin(sRatio * Math.PI * 2);
            catEyeSweep = -0.2 + Math.sin(sRatio * Math.PI * 1.5) * 0.6;
            lightRingPower = 0.5 + Math.cos(sRatio * Math.PI) * 0.2;
          } else {
            actionLabel = "ACTION 3: 猫眼磁吸炫彩与美颜滤镜";
            const sRatio = (ratio - 0.7) / 0.3;
            zoomScale = 1.07 + Math.sin(sRatio * Math.PI * 0.5) * 0.04;
            focalX = Math.cos(sRatio * Math.PI) * 8;
            focalY = -35 + sRatio * 10;
            handFlexMultiplier = Math.cos(sRatio * Math.PI) * 3;
            catEyeSweep = -0.5 + sRatio * 2.0;
            lightRingPower = 0.4 + sRatio * 0.25;
          }

          ctx.save();
          ctx.translate(width / 2 + focalX, height / 2 + focalY);
          ctx.scale(zoomScale, zoomScale);

          const slices = 65;
          const srcHeight = img.naturalHeight;
          const srcWidth = img.naturalWidth;
          const destHeight = height;
          const destWidth = width;

          for (let sliceIndex = 0; sliceIndex < slices; sliceIndex++) {
            const sy = (sliceIndex / slices) * srcHeight;
            const sh = srcHeight / slices;
            const dy = (sliceIndex / slices) * destHeight - destHeight / 2;
            const dh = destHeight / slices;

            const sliceFactor = 1.0 - (sliceIndex / slices);
            const sliceOffset = handFlexMultiplier * Math.sin(sliceIndex * 0.07 + ratio * Math.PI * 2) * sliceFactor;

            ctx.drawImage(
              img,
              0, sy, srcWidth, sh,
              -destWidth / 2 + sliceOffset, dy, destWidth, dh
            );
          }

          sparkles.forEach((s) => {
            const opacity = Math.sin(frame * s.speed + s.phase) * 0.4 + 0.6;
            if (opacity > 0.15) {
              ctx.save();
              ctx.globalAlpha = opacity;
              ctx.fillStyle = s.color;

              const fingerYRatio = 1.0 - ((s.y + height / 2) / height);
              const flexAdjustment = handFlexMultiplier * Math.sin(((s.y + height / 2) / height) * 65 * 0.07 + ratio * Math.PI * 2) * Math.max(0, fingerYRatio);

              const px = s.x + flexAdjustment;
              const py = s.y;

              ctx.beginPath();
              ctx.moveTo(px, py - s.size);
              ctx.quadraticCurveTo(px, py, px + s.size, py);
              ctx.quadraticCurveTo(px, py, px, py + s.size);
              ctx.quadraticCurveTo(px, py, px - s.size, py);
              ctx.quadraticCurveTo(px, py, px, py - s.size);
              ctx.closePath();
              ctx.fill();

              ctx.beginPath();
              ctx.arc(px, py, s.size * 0.25, 0, Math.PI * 2);
              ctx.fillStyle = '#FFFFFF';
              ctx.fill();
              ctx.restore();
            }
          });

          ctx.restore();

          const vignette = ctx.createRadialGradient(width / 2, height / 2, width / 4, width / 2, height / 2, width * 0.75);
          vignette.addColorStop(0, 'rgba(253, 251, 247, 0)');
          vignette.addColorStop(0.5, `rgba(180, 150, 130, ${0.1 * lightRingPower})`);
          vignette.addColorStop(1, 'rgba(26, 18, 14, 0.35)');
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 0, width, height);

          ctx.save();
          const sweepPosition = catEyeSweep * width * 1.5 - width * 0.5;
          const glintGrd = ctx.createLinearGradient(sweepPosition, 0, sweepPosition + 140, height);
          glintGrd.addColorStop(0, 'rgba(255, 255, 255, 0)');
          glintGrd.addColorStop(0.35, 'rgba(255, 255, 255, 0.03)');
          glintGrd.addColorStop(0.5, `rgba(255, 245, 225, ${0.15 * lightRingPower})`);
          glintGrd.addColorStop(0.65, 'rgba(255, 255, 255, 0.03)');
          glintGrd.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = glintGrd;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();

          ctx.save();
          ctx.fillStyle = 'rgba(26, 18, 14, 0.6)';
          ctx.beginPath();
          ctx.roundRect(40, 40, 360, 36, 18);
          ctx.fill();

          ctx.fillStyle = '#FFEAB5';
          ctx.font = 'bold 12px "Inter", sans-serif';
          ctx.textAlign = 'left';
          const binker = Math.floor(frame / 10) % 2 === 0 ? "●" : " ";
          ctx.fillText(`${binker} REC | ${actionLabel}`, 60, 62);
          ctx.restore();

          ctx.save();
          const bannerGrd = ctx.createLinearGradient(0, height - 130, 0, height);
          bannerGrd.addColorStop(0, 'rgba(0, 0, 0, 0)');
          bannerGrd.addColorStop(1, 'rgba(30, 20, 15, 0.8)');
          ctx.fillStyle = bannerGrd;
          ctx.fillRect(0, height - 130, width, 130);

          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 6;

          ctx.font = 'bold 24px "Inter", sans-serif';
          ctx.fillText('NailAI 美甲工作室', 40, height - 62);

          ctx.font = '500 15px "Inter", sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillText('• 智创视频生成 • 3D 拟态试戴特写 •', 40, height - 30);

          ctx.fillStyle = 'rgba(122, 91, 69, 0.9)';
          ctx.beginPath();
          ctx.roundRect(width - 180, 40, 140, 36, 18);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('3D LIVE SHOW', width - 110, 62);
          ctx.restore();

          frame++;
          animationFrameId.current = requestAnimationFrame(render);
        };

        animationFrameId.current = requestAnimationFrame(render);
      });

    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || '本地视频生成出错');
      setStatus('error');
    }
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    const isMp4 = videoUrl.includes('video/mp4') || MediaRecorder.isTypeSupported('video/mp4;codecs=h264');
    a.download = `nailai-veo-preview-${Date.now()}.${isMp4 ? 'mp4' : 'webm'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {status === 'idle' && (
        <div className="w-full flex flex-col gap-4">
          {/* Mode Switcher Buttons */}
          <div className="flex bg-[#EAE6DF] p-1 rounded-xl">
            <button
              onClick={() => setGenerationMode('veo')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                generationMode === 'veo'
                  ? 'bg-[#7A5B45] text-white shadow-sm'
                  : 'text-[#696158] hover:text-[#4A443D]'
              }`}
            >
              <Sparkles size={14} />
              Gemini Veo (真实翻手视频)
            </button>
            <button
              onClick={() => setGenerationMode('local')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                generationMode === 'local'
                  ? 'bg-[#7A5B45] text-white shadow-sm'
                  : 'text-[#696158] hover:text-[#4A443D]'
              }`}
            >
              <Film size={14} />
              本地3D仿物拟态试戴
            </button>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-3.5 px-4 bg-[#7A5B45] hover:bg-[#684C38] text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {generationMode === 'veo' ? <Sparkles size={18} /> : <Film size={18} />}
            <span>
              {generationMode === 'veo'
                ? '使用 Gemini Veo 智能技术生成“真实翻手视频”'
                : '一键生成本地3D拟态展示视频 (极速)'}
            </span>
          </button>
          
          <p className="text-[10px] text-center text-[#968F85] leading-relaxed">
            {generationMode === 'veo'
              ? '✨ 推荐：由最新 Gemini Veo 视频大模型驱动，真实模拟手指弯曲和翻转，全方位拟真展示美甲效果。由于大模型生成较慢，渲染时间预计约需 10-30 秒。'
              : '⚡️ 极速：基于当前照片进行 3D 骨骼位移，极速输出透视渲染。'}
          </p>
        </div>
      )}

      {status === 'generating' && (
        <div className="w-full p-6 bg-[#F2EFE9] rounded-2xl border border-[#EAE6DF] flex flex-col items-center justify-center text-center gap-4">
          <div className="relative flex items-center justify-center w-16 h-16">
            <Loader2 className="animate-spin text-[#9C7A63] absolute" size={48} />
            {generationMode === 'veo' ? (
              <Sparkles className="text-[#9C7A63] animate-pulse" size={24} />
            ) : (
              <Film className="text-[#9C7A63]/60" size={24} />
            )}
          </div>
          <div className="w-full max-w-xs bg-[#EAE6DF] h-2 rounded-full overflow-hidden">
            <div 
              className="bg-[#9C7A63] h-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div>
            <p className="font-semibold text-sm text-[#4A443D]">
              {generationMode === 'veo'
                ? '正在呼叫 Gemini Veo 智剪视频模型...'
                : '正在进行 3D 仿物拟态极速渲染...'}
            </p>
            <p className="text-xs text-[#968F85] mt-1">
              {generationMode === 'veo'
                ? `模型正在优雅翻转您的手掌，精准还原美甲闪耀细节 (${progress}%)`
                : `应用 3D 骨骼拉伸，正在执行第 ${progress}% 帧捕获...`}
            </p>
          </div>
        </div>
      )}

      {status === 'completed' && videoUrl && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full p-4 bg-[#F2EFE9] rounded-2xl border border-[#EAE6DF] flex flex-col items-center gap-4"
        >
          <div className="w-full flex items-center justify-between border-b border-[#EAE6DF] pb-2">
            <span className="text-xs font-semibold text-[#696158] flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-green-600" />
              {generationMode === 'veo' ? 'Gemini Veo 翻手秀视频已预备' : '美甲拟真透视短视频已生成'}
            </span>
            <button 
              onClick={handleGenerate}
              className="text-xs text-[#9C7A63] hover:text-[#7A5B45] font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={12} />
              重新生成
            </button>
          </div>

          <div className="relative w-full max-w-xs aspect-[3/4] rounded-xl overflow-hidden shadow-md bg-black group">
            <video
              ref={videoRef}
              src={videoUrl}
              loop
              muted
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <button 
                onClick={handleTogglePlay}
                className="p-3 bg-white/95 rounded-full text-[#4A443D] hover:scale-110 shadow-md transition-all pointer-events-auto"
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 w-full max-w-xs mt-1">
            <button
              onClick={downloadVideo}
              className="flex-1 py-3 px-4 bg-[#7A5B45] hover:bg-[#684C38] text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-sm transition-all text-sm"
            >
              <Download size={16} />
              <span>下载展示短视频</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="py-3 px-4 bg-white hover:bg-[#FAF8F5] border border-[#EAE6DF] text-[#696158] rounded-xl font-medium transition-all text-sm"
              >
                关闭
              </button>
            )}
          </div>
        </motion.div>
      )}

      {status === 'error' && (
        <div className="w-full p-6 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center text-center gap-3">
          <AlertCircle className="text-red-500" size={32} />
          <div>
            <p className="font-semibold text-sm text-red-800 leading-snug">{errorMessage}</p>
            {generationMode === 'veo' && (
              <button
                onClick={() => {
                  setGenerationMode('local');
                  setStatus('idle');
                }}
                className="mt-2 text-xs font-semibold text-[#7A5B45] underline block mx-auto hover:text-[#684C38]"
              >
                一键切换为“本地极速3D拟态渲染”备份方案
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleGenerate}
              className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              重试生成
            </button>
            <button
              onClick={() => setStatus('idle')}
              className="py-2 px-4 bg-white border border-red-200 text-red-800 text-xs font-semibold rounded-lg shadow-sm transition-all hover:bg-red-50"
            >
              返回
            </button>
          </div>
        </div>
      )}

      {/* Hidden container to mount drawing target canvas only when recording */}
      <div className="hidden">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
