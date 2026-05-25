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
      const duration = 6000; // 6 seconds high-quality video showcase
      const fps = 30;
      const totalFrames = (duration / 1000) * fps;
      let frame = 0;

      recorder.start();

      // Fingertip coordinates corresponding to typical try-on layouts
      const nailPoints = [
        { name: 'pinky', x: width * 0.28, y: height * 0.45, size: 10 },
        { name: 'ring', x: width * 0.39, y: height * 0.32, size: 12 },
        { name: 'middle', x: width * 0.52, y: height * 0.29, size: 13 },
        { name: 'index', x: width * 0.65, y: height * 0.35, size: 12 },
        { name: 'thumb', x: width * 0.78, y: height * 0.58, size: 11 },
      ];

      // Background decorative ambient particle system
      const ambienceParticles = Array.from({ length: 25 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        rx: (Math.random() - 0.5) * 2,
        ry: -Math.random() * 1.5 - 0.5,
        size: Math.random() * 4 + 2,
        opacity: Math.random() * 0.5 + 0.3,
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

          // DRAW LUSH STUDIO BACKGROUND (Elegant bokeh and radial light)
          const bgGrd = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width);
          bgGrd.addColorStop(0, '#FFFDF9');
          bgGrd.addColorStop(0.5, '#FAF4EC');
          bgGrd.addColorStop(1, '#E6DEC9');
          ctx.fillStyle = bgGrd;
          ctx.fillRect(0, 0, width, height);

          // Draw floating dust bokeh
          ctx.save();
          ambienceParticles.forEach(p => {
            p.y += p.ry;
            p.x += p.rx;
            if (p.y < -10) p.y = height + 10;
            if (p.x < -10 || p.x > width + 10) p.x = Math.random() * width;
            
            ctx.fillStyle = 'rgba(235, 212, 183, 0.4)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();

          // CINEMATIC CAM WORK ENVELOPES (Slight handheld camera movement)
          const camZoom = 1.05 + Math.sin(ratio * Math.PI) * 0.05 + (1 - Math.cos(ratio * Math.PI * 2)) * 0.02;
          const camX = Math.sin(ratio * Math.PI * 4) * 6;
          const camY = Math.cos(ratio * Math.PI * 2) * 5;

          ctx.save();
          // Apply camera shake & zoom about screen center
          ctx.translate(width / 2 + camX, height / 2 + camY);
          ctx.scale(camZoom, camZoom);
          ctx.translate(-width / 2, -height / 2);

          // MASTER HAND SIMULATION PARAMETERS (Choreographed multi-phase movements)
          // 1. Pivot sway & tilt mimicking model turning/presenting hand
          const baseRotate = Math.sin(ratio * Math.PI * 2.2) * 0.08; // Left/Right wrist swivel
          const tiltYaw = Math.cos(ratio * Math.PI * 1.8) * 0.12; // 3D Tilt perspective simulation
          
          // 2. High Definition slice rendering for ORGANIC FINGER FLEXING
          const numSlices = 40;
          const sliceHeight = height / numSlices;

          for (let i = 0; i < numSlices; i++) {
            const sy = i * (img.height / numSlices);
            const sh = img.height / numSlices;
            
            // Flex curve: 0 at wrist (bottom, i=numSlices), 1 at fingertip (top, i=0)
            const t = (numSlices - i) / numSlices;
            const flexFactor = Math.pow(t, 2.5); // Exponential bending towards tips
            
            // Dynamic bending/flexing displacement mimicking finger flexing rhythm
            // Elegant flexing cycle: hand curls slightly then opens wide
            const flexCycle = Math.sin(ratio * Math.PI * 2.5);
            const flexX = flexCycle * 32 * flexFactor * Math.sin(i * 0.08); 
            const flexY = Math.abs(flexCycle) * 12 * flexFactor;

            // Apply 3D tilt perspective by shifting slice translation
            const perspectiveShift = tiltYaw * (i - numSlices / 2) * 4;

            ctx.save();
            
            // Pivot rotation anchor: bottom of canvas (wrist)
            const anchorY = height * 0.95;
            ctx.translate(width / 2 + flexX + perspectiveShift, anchorY);
            ctx.rotate(baseRotate * t); // Bottom rotates less, top rotates more
            ctx.translate(-width / 2, -anchorY);

            // Translate specifically to slice path and apply beautiful dynamic shear / scale
            ctx.translate(0, flexY);
            
            // Apply 3D rotation distortion (squeeze X slightly for depth)
            const squeezeFactor = 1.0 - Math.abs(tiltYaw) * flexFactor * 0.25;
            ctx.translate(width / 2, i * sliceHeight + sliceHeight / 2);
            ctx.scale(squeezeFactor, 1.0);
            ctx.transform(1, tiltYaw * flexFactor * 0.3, 0, 1, 0, 0); // Yaw perspective shear
            ctx.translate(-width / 2, -(i * sliceHeight + sliceHeight / 2));

            // Draw current luxury high-fidelity hand partition slice
            ctx.drawImage(
              img,
              0, sy, img.width, sh,
              0, i * sliceHeight, width, sliceHeight
            );
            
            ctx.restore();
          }

          // DYNAMIC LIGHT COUPLING & SPECULAR SPARKLES
          // We calculate the current coordinate of the nails after flexing & sway
          nailPoints.forEach((pt) => {
            const rowIdx = Math.floor(pt.y / sliceHeight);
            const t = (numSlices - rowIdx) / numSlices;
            const flexFactor = Math.pow(t, 2.5);
            const flexCycle = Math.sin(ratio * Math.PI * 2.5);
            const flexX = flexCycle * 32 * flexFactor * Math.sin(rowIdx * 0.08);
            const flexY = Math.abs(flexCycle) * 12 * flexFactor;
            
            const perspectiveShift = tiltYaw * (rowIdx - numSlices / 2) * 4;
            const squeezeFactor = 1.0 - Math.abs(tiltYaw) * flexFactor * 0.25;

            // Vector math to trace the exact canvas position of each nail
            const anchorY = height * 0.95;
            let nx = pt.x;
            let ny = pt.y + flexY;

            // Apply 3D Squeeze relative to Center
            nx = width / 2 + (nx - width / 2) * squeezeFactor;

            // Apply Pivot rotate around wrist
            const dx = nx - width / 2;
            const dy = ny - anchorY;
            const rotAngle = baseRotate * t;
            const rotatedX = width / 2 + (dx * Math.cos(rotAngle) - dy * Math.sin(rotAngle)) + flexX + perspectiveShift;
            const rotatedY = anchorY + (dx * Math.sin(rotAngle) + dy * Math.cos(rotAngle));

            // Generate shimmering sparkles that correspond with the swipe angle
            const glintActivation = Math.abs(Math.sin(ratio * Math.PI * 2.5 + pt.x * 0.015));
            if (glintActivation > 0.4) {
              ctx.save();
              ctx.globalAlpha = (glintActivation - 0.4) * 1.6;
              
              // Light spot color selection (Diamond-gold and pristine-white)
              ctx.fillStyle = pt.name === 'middle' || pt.name === 'thumb' ? '#FFFBEB' : '#FFFFFF';
              
              // Render gorgeous light glares (cross flare)
              const flareSize = pt.size * (0.8 + Math.sin(frame * 0.3) * 0.3) * glintActivation;
              
              ctx.beginPath();
              // Top leg
              ctx.moveTo(rotatedX, rotatedY - flareSize * 1.5);
              ctx.quadraticCurveTo(rotatedX, rotatedY, rotatedX + flareSize * 0.3, rotatedY);
              // Right leg
              ctx.quadraticCurveTo(rotatedX, rotatedY, rotatedX + flareSize * 1.5, rotatedY);
              ctx.quadraticCurveTo(rotatedX, rotatedY, rotatedX, rotatedY + flareSize * 0.3);
              // Bottom leg
              ctx.quadraticCurveTo(rotatedX, rotatedY, rotatedX, rotatedY + flareSize * 1.5);
              ctx.quadraticCurveTo(rotatedX, rotatedY, rotatedX - flareSize * 0.3, rotatedY);
              // Left leg
              ctx.quadraticCurveTo(rotatedX, rotatedY, rotatedX - flareSize * 1.5, rotatedY);
              ctx.quadraticCurveTo(rotatedX, rotatedY, rotatedX, rotatedY - flareSize * 0.3);
              ctx.closePath();
              ctx.fill();

              // Super bright pristine core
              ctx.beginPath();
              ctx.arc(rotatedX, rotatedY, flareSize * 0.25, 0, Math.PI * 2);
              ctx.fillStyle = '#FFFFFF';
              ctx.fill();
              ctx.restore();
            }
          });

          ctx.restore(); // Restore Camera Transform

          // 3. CINEMATIC OVERLAY & GLOW (Top light sweeps / vignette)
          // A. Vignette frame
          const vignette = ctx.createRadialGradient(width / 2, height / 2, width / 3, width / 2, height / 2, width * 0.75);
          vignette.addColorStop(0, 'rgba(0,0,0,0)');
          vignette.addColorStop(1, 'rgba(102, 69, 52, 0.25)'); // Rich warm brown border
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 0, width, height);

          // B. Glossy studio light ring sweeps
          ctx.save();
          const sweepGlint = ratio * width * 2.5 - width;
          const glintGrd = ctx.createLinearGradient(sweepGlint, 0, sweepGlint + 200, height);
          glintGrd.addColorStop(0, 'rgba(255, 255, 255, 0)');
          glintGrd.addColorStop(0.5, 'rgba(255, 253, 245, 0.12)');
          glintGrd.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = glintGrd;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();

          // D. Subtly styled Watermark frame
          ctx.save();
          // Bottom elegant banner
          const bannerGrd = ctx.createLinearGradient(0, height - 120, 0, height);
          bannerGrd.addColorStop(0, 'rgba(0,0,0,0)');
          bannerGrd.addColorStop(1, 'rgba(18,12,8,0.7)');
          ctx.fillStyle = bannerGrd;
          ctx.fillRect(0, height - 120, width, 120);

          // Text styling
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 6;
          
          ctx.font = 'bold 24px "Inter", sans-serif';
          ctx.fillText('NailAI 美甲工作室', 40, height - 55);
          
          ctx.font = '500 16px "Inter", sans-serif';
          ctx.fillStyle = 'rgba(247, 237, 225, 0.9)';
          ctx.fillText('• 专属智创美甲试戴效果 •', 40, height - 25);

          // Badge on Top-Right
          ctx.fillStyle = 'rgba(122, 91, 69, 0.9)';
          ctx.beginPath();
          ctx.roundRect(width - 180, 40, 140, 36, 18);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('DYNAMIC SHOWCASE', width - 110, 62);
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
