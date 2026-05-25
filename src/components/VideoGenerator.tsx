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
      const duration = 4500; // 4.5 seconds for premium storytelling
      const fps = 30;
      const totalFrames = (duration / 1000) * fps;
      let frame = 0;

      recorder.start();

      // Premium luxury particle sparkle nodes
      const sparkles = Array.from({ length: 18 }, () => ({
        x: (Math.random() - 0.5) * 280, // Clustered in nail area
        y: (Math.random() - 0.2) * 320, // Clustered in upper half of image
        size: Math.random() * 5 + 3,
        speed: Math.random() * 0.08 + 0.04,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.5 ? '#FFFFFF' : '#FFDF9E'
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

          // 1. CLEAR CANVAS
          ctx.clearRect(0, 0, width, height);

          // 2. DEFINE CINEMATIC SEQUENCER ACTIONS
          let actionLabel = "";
          let zoomScale = 1.05;
          let focalX = 0;
          let focalY = -40; // Focus on fingers
          let handFlexMultiplier = 0;
          let catEyeSweep = 0;
          let lightRingPower = 0.4;

          if (ratio < 0.3) {
            // Scene 1: Breathing Focal Scan (慢速推流光)
            actionLabel = "ACTION 1: 细节特写与肌理慢镜头";
            const sRatio = ratio / 0.3;
            zoomScale = 1.04 + sRatio * 0.06; // Smooth push-in
            focalY = -40 + sRatio * 15;
            handFlexMultiplier = Math.sin(sRatio * Math.PI * 0.5) * 4;
            catEyeSweep = -1 + sRatio * 0.8;
            lightRingPower = 0.35 + Math.sin(sRatio * Math.PI) * 0.15;
          } else if (ratio >= 0.3 && ratio < 0.7) {
            // Scene 2: 3D Finger Flex & Roll (3D骨骼微弯模拟)
            actionLabel = "ACTION 2: 3D指间微弯动作与翻转";
            const sRatio = (ratio - 0.3) / 0.4;
            zoomScale = 1.10 - Math.sin(sRatio * Math.PI) * 0.03;
            focalX = Math.sin(sRatio * Math.PI * 2) * 12;
            focalY = -25 - Math.sin(sRatio * Math.PI) * 10;
            // High flex index to stimulate finger bending via canvas sliced waves
            handFlexMultiplier = 16 * Math.sin(sRatio * Math.PI * 2);
            catEyeSweep = -0.2 + Math.sin(sRatio * Math.PI * 1.5) * 0.6;
            lightRingPower = 0.5 + Math.cos(sRatio * Math.PI) * 0.2;
          } else {
            // Scene 3: Metallic Cat-Eye Gleam Specular Sweep (猫眼磁吸炫光)
            actionLabel = "ACTION 3: 猫眼磁吸炫彩与美颜滤镜";
            const sRatio = (ratio - 0.7) / 0.3;
            zoomScale = 1.07 + Math.sin(sRatio * Math.PI * 0.5) * 0.04;
            focalX = Math.cos(sRatio * Math.PI) * 8;
            focalY = -35 + sRatio * 10;
            handFlexMultiplier = Math.cos(sRatio * Math.PI) * 3;
            catEyeSweep = -0.5 + sRatio * 2.0; // Drastic reflection sweep
            lightRingPower = 0.4 + sRatio * 0.25;
          }

          // 3. DRAW BACKGROUND WITH HIGH-FIDELITY FLEXING AND MOTION
          ctx.save();
          // Position camera viewport centering on focal coordinates
          ctx.translate(width / 2 + focalX, height / 2 + focalY);
          ctx.scale(zoomScale, zoomScale);

          // RENDER 3D HAND BENDING FLEXIVITY
          // We divide the image into 65 vertical/horizontal slices.
          // Applying progressive horizontal displacements creates the illusion of fingers bending and flexing.
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

            // Slices at the top of the canvas (finger tips/nails) flex more.
            // Slices at the bottom (wrist) remain completely stationary.
            const sliceFactor = 1.0 - (sliceIndex / slices); // 1.0 at finger tips, 0.0 at wrist
            const sliceOffset = handFlexMultiplier * Math.sin(sliceIndex * 0.07 + ratio * Math.PI * 2) * sliceFactor;

            ctx.drawImage(
              img,
              0, sy, srcWidth, sh,
              -destWidth / 2 + sliceOffset, dy, destWidth, dh
            );
          }

          // 4. EMBED NAIL COORDINATE REFLECTIONS (SHIMS)
          // Sparkles aligned closely to fingertip motion offsets
          sparkles.forEach((s) => {
            const opacity = Math.sin(frame * s.speed + s.phase) * 0.4 + 0.6;
            if (opacity > 0.15) {
              ctx.save();
              ctx.globalAlpha = opacity;
              ctx.fillStyle = s.color;

              // Top fingers shift more according to top flexing factor (assume s.y relative offset is mapped to slice height)
              const fingerYRatio = 1.0 - ((s.y + height / 2) / height);
              const flexAdjustment = handFlexMultiplier * Math.sin(((s.y + height / 2) / height) * 65 * 0.07 + ratio * Math.PI * 2) * Math.max(0, fingerYRatio);

              const px = s.x + flexAdjustment;
              const py = s.y;

              // Elegant star glow shape
              ctx.beginPath();
              ctx.moveTo(px, py - s.size);
              ctx.quadraticCurveTo(px, py, px + s.size, py);
              ctx.quadraticCurveTo(px, py, px, py + s.size);
              ctx.quadraticCurveTo(px, py, px - s.size, py);
              ctx.quadraticCurveTo(px, py, px, py - s.size);
              ctx.closePath();
              ctx.fill();

              // Super-bright pinpoint center
              ctx.beginPath();
              ctx.arc(px, py, s.size * 0.25, 0, Math.PI * 2);
              ctx.fillStyle = '#FFFFFF';
              ctx.fill();
              ctx.restore();
            }
          });

          // Restore from transformed matrix
          ctx.restore();

          // 5. CINEMATIC OVERLAYS & GLOSS EFFECTS (Independently tracked for depth)
          // A. Warm Studio Spotlight / Radial Vignette
          const vignette = ctx.createRadialGradient(width / 2, height / 2, width / 4, width / 2, height / 2, width * 0.75);
          vignette.addColorStop(0, 'rgba(253, 251, 247, 0)');
          vignette.addColorStop(0.5, `rgba(180, 150, 130, ${0.1 * lightRingPower})`); // Warm golden aura
          vignette.addColorStop(1, 'rgba(26, 18, 14, 0.35)'); // Professional dark brown-gold border
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 0, width, height);

          // B. Cat-Eye Specular Glis Refraction Sweep (diagonal light reflection inside the film)
          ctx.save();
          const sweepPosition = catEyeSweep * width * 1.5 - width * 0.5;
          const glintGrd = ctx.createLinearGradient(sweepPosition, 0, sweepPosition + 140, height);
          glintGrd.addColorStop(0, 'rgba(255, 255, 255, 0)');
          glintGrd.addColorStop(0.35, 'rgba(255, 255, 255, 0.03)');
          glintGrd.addColorStop(0.5, `rgba(255, 245, 225, ${0.15 * lightRingPower})`); // Brilliant high-end salon shimmer
          glintGrd.addColorStop(0.65, 'rgba(255, 255, 255, 0.03)');
          glintGrd.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = glintGrd;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();

          // 6. DYNAMIC OVERLAID ACTION BRAND BANNER (Showing current videography mode)
          ctx.save();
          // High-end translucent status strip
          ctx.fillStyle = 'rgba(26, 18, 14, 0.6)';
          ctx.beginPath();
          ctx.roundRect(40, 40, 360, 36, 18);
          ctx.fill();

          ctx.fillStyle = '#FFEAB5';
          ctx.font = 'bold 12px "Inter", sans-serif';
          ctx.textAlign = 'left';
          // Little blinking recording indicator
          const binker = Math.floor(frame / 10) % 2 === 0 ? "●" : " ";
          ctx.fillText(`${binker} REC | ${actionLabel}`, 60, 62);
          ctx.restore();

          // 7. STATIONARY LUXURY OUTSIDE BRAND FRAME AND WATERMARK
          ctx.save();
          const bannerGrd = ctx.createLinearGradient(0, height - 130, 0, height);
          bannerGrd.addColorStop(0, 'rgba(0, 0, 0, 0)');
          bannerGrd.addColorStop(1, 'rgba(30, 20, 15, 0.8)'); // Cinematic ground shadow
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

          // Top Elegant Right Stamp
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
