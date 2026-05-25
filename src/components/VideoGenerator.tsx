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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup URLs on unmount
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

  const generateVideo = async () => {
    setStatus('generating');
    setProgress(0);
    setErrorMessage('');

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    try {
      // Load the image first
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Enable CORS if it's external (e.g. from Aliyun OSS)
      
      // Wait for image loading
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片加载失败，无法生成视频'));
        img.src = imageSrc;
      });

      const canvas = canvasRef.current;
      if (!canvas) throw new Error('画布初始化失败');

      // Set canvas dimensions of standard portrait ratio (720x960)
      const width = 720;
      const height = 960;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建画布渲染上下文');

      // Create stream at 30fps
      const stream = canvas.captureStream(30);
      
      // Select best supported MIME type
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
        videoBitsPerSecond: 3000000 // 3 Mbps for high-quality video
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

      // Animation parameters
      const duration = 4000; // 4 seconds video
      const fps = 30;
      const totalFrames = (duration / 1000) * fps;
      let frame = 0;

      recorder.start();

      // Particle system for glowing nail shimmer (relative to the image center)
      const sparkles = Array.from({ length: 15 }, () => ({
        x: (Math.random() - 0.5) * 320,
        y: (Math.random() - 0.1) * 380, // Upper-to-center part of the hand where fingers & nails are
        size: Math.random() * 6 + 3,
        speed: Math.random() * 0.06 + 0.03,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.6 ? '#FFFFFF' : '#FFDF9E'
      }));

      return new Promise<void>((resolve, reject) => {
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

          // Clear Canvas
          ctx.clearRect(0, 0, width, height);

          // 1. Calculate realistic 3D hand turn perspective parameters
          let scaleX = 1.0;
          let skewY = 0.0;
          let tiltGlowOpacity = 0.0;

          // Perform rotation wave between 20% and 80% of video progress (0.8s to 3.2s)
          if (ratio >= 0.2 && ratio <= 0.8) {
            const t = (ratio - 0.2) / 0.6; // Normalized 0 to 1
            const easedT = (1 - Math.cos(t * Math.PI)) / 2; // Smooth acceleration/deceleration curve
            const rotationAngle = easedT * Math.PI * 2; // Complete 360-degree rotation
            
            scaleX = Math.cos(rotationAngle);
            skewY = Math.sin(rotationAngle) * 0.08; // Delicate vertical tilt
            
            // Shimmer shine peaks as the hand turns towards the side
            tiltGlowOpacity = Math.max(0, 1 - Math.abs(scaleX) * 2.5) * 0.3;
          }

          // Camera zoom/breath to keep it ultra-dynamic
          const scale = 1.05 + Math.sin(ratio * Math.PI) * 0.03; 
          const dX = Math.sin(ratio * Math.PI * 2) * 6; 
          const dY = Math.cos(ratio * Math.PI) * 12 - 6; 

          ctx.save();
          // Move origin to canvas center for rotation/skew/flip transformations
          ctx.translate(width / 2 + dX, height / 2 + dY);
          
          if (skewY !== 0) {
            ctx.transform(1, skewY, 0, 1, 0, 0); // Apply pitch/tilt skewing
          }
          
          ctx.scale(scaleX * scale, scale); // 3D-simulated vertical flip & zoom
          
          // Draw the original image with high fidelity
          ctx.drawImage(img, -width / 2, -height / 2, width, height);

          // 2. Add realistic light flares directly attached to the rotating hand's coordinate system
          if (tiltGlowOpacity > 0) {
            const glowGrd = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
            glowGrd.addColorStop(0, 'rgba(255, 255, 255, 0)');
            glowGrd.addColorStop(0.5, `rgba(255, 255, 255, ${tiltGlowOpacity})`);
            glowGrd.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = glowGrd;
            ctx.fillRect(-width / 2, -height / 2, width, height);
          }

          // 3. Draw premium nail sparkles (anchored to the hand so they move in perfect sync as it flips!)
          sparkles.forEach((sparkle) => {
            const opacity = Math.sin(frame * sparkle.speed + sparkle.phase) * 0.5 + 0.5;
            if (opacity > 0.15) {
              ctx.save();
              ctx.globalAlpha = opacity;
              ctx.fillStyle = sparkle.color;
              
              // Draw custom luxury star
              ctx.beginPath();
              ctx.moveTo(sparkle.x, sparkle.y - sparkle.size);
              ctx.quadraticCurveTo(sparkle.x, sparkle.y, sparkle.x + sparkle.size, sparkle.y);
              ctx.quadraticCurveTo(sparkle.x, sparkle.y, sparkle.x, sparkle.y + sparkle.size);
              ctx.quadraticCurveTo(sparkle.x, sparkle.y, sparkle.x - sparkle.size, sparkle.y);
              ctx.quadraticCurveTo(sparkle.x, sparkle.y, sparkle.x, sparkle.y - sparkle.size);
              ctx.closePath();
              ctx.fill();

              // Super-bright core highlight
              ctx.beginPath();
              ctx.arc(sparkle.x, sparkle.y, sparkle.size * 0.25, 0, Math.PI * 2);
              ctx.fillStyle = '#FFFFFF';
              ctx.fill();
              ctx.restore();
            }
          });

          ctx.restore(); // Finish transformed layer

          // 4. Overlaid Vignette for high-end cinematic feel (independent of hand rotation)
          const vignette = ctx.createRadialGradient(width / 2, height / 2, width / 3, width / 2, height / 2, width * 0.7);
          vignette.addColorStop(0, 'rgba(249, 246, 240, 0)'); // Keep core bright and crisp
          vignette.addColorStop(1, 'rgba(30, 20, 15, 0.25)'); // Elegant warm brown-black tone border
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 0, width, height);

          // 5. Ambient linear lighting reflection sweeps across the global camera frame
          ctx.save();
          const glintPosition = ratio * width * 2.5 - width;
          const glintGrd = ctx.createLinearGradient(glintPosition, 0, glintPosition + 180, height);
          glintGrd.addColorStop(0, 'rgba(255, 255, 255, 0)');
          glintGrd.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
          glintGrd.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = glintGrd;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();

          // 6. Styled Luxury Brand frame at the bottom (fully static, steady watermark)
          ctx.save();
          const bannerGrd = ctx.createLinearGradient(0, height - 130, 0, height);
          bannerGrd.addColorStop(0, 'rgba(0, 0, 0, 0)');
          bannerGrd.addColorStop(1, 'rgba(40, 30, 25, 0.75)'); // High contrast cinematic vignette bottom
          ctx.fillStyle = bannerGrd;
          ctx.fillRect(0, height - 130, width, 130);

          // Watermark text styling
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 6;
          
          ctx.font = 'bold 24px "Inter", sans-serif';
          ctx.fillText('NailAI 美甲工作室', 40, height - 60);
          
          ctx.font = '500 16px "Inter", sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillText('• 智创美甲 • 专属试戴 •', 40, height - 28);

          // Elegant top badge
          ctx.fillStyle = 'rgba(122, 91, 69, 0.85)'; // Warm bronze tone
          ctx.beginPath();
          ctx.roundRect(width - 180, 40, 140, 36, 18);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('VIRTUAL TRY-ON', width - 110, 62);
          ctx.restore();

          frame++;
          animationFrameId.current = requestAnimationFrame(render);
        };

        animationFrameId.current = requestAnimationFrame(render);
      });

    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || '视频生成出错，请重试');
      setStatus('error');
    }
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    // Base standard is webm or mp4
    const isMp4 = videoUrl.includes('video/mp4') || MediaRecorder.isTypeSupported('video/mp4;codecs=h264');
    a.download = `nailai-preview-${Date.now()}.${isMp4 ? 'mp4' : 'webm'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {status === 'idle' && (
        <button
          onClick={generateVideo}
          className="w-full py-3 px-4 bg-[#7A5B45] hover:bg-[#684C38] text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Film size={18} />
          <span>生成试戴展示短视频 (3D炫彩)</span>
        </button>
      )}

      {status === 'generating' && (
        <div className="w-full p-6 bg-[#F2EFE9] rounded-2xl border border-[#EAE6DF] flex flex-col items-center justify-center text-center gap-4">
          <div className="relative flex items-center justify-center w-16 h-16">
            <Loader2 className="animate-spin text-[#9C7A63] absolute" size={48} />
            <Film className="text-[#9C7A63]/60" size={24} />
          </div>
          <div className="w-full max-w-xs bg-[#EAE6DF] h-2 rounded-full overflow-hidden">
            <div 
              className="bg-[#9C7A63] h-full transition-all duration-100 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div>
            <p className="font-semibold text-sm text-[#4A443D]">正在渲染您的专属美甲展示视频...</p>
            <p className="text-xs text-[#968F85] mt-1">运用3D摄像机平移与流光细节闪耀滤镜 ({progress}%)</p>
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
              美甲美颜短视频已预备
            </span>
            <button 
              onClick={generateVideo}
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
              <span>下载超清视频</span>
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
            <p className="font-semibold text-sm text-red-800">{errorMessage}</p>
            <p className="text-xs text-red-600 mt-1">可能浏览器不支持高级视频编码或画布不可读</p>
          </div>
          <button
            onClick={generateVideo}
            className="mt-2 py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            重试一下
          </button>
        </div>
      )}

      {/* Hidden container to mount drawing target canvas only when recording */}
      <div className="hidden">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
