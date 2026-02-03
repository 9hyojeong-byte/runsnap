
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RunData, CanvasState, FilterType } from './types';

interface TransformState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const FILTERS: FilterType[] = [
  { id: 'none', name: 'Original', cssFilter: 'none' },
  { id: 'grayscale', name: 'B&W', cssFilter: 'grayscale(100%)' },
  { id: 'sepia', name: 'Classic', cssFilter: 'sepia(60%)' },
  { id: 'vivid', name: 'Vivid', cssFilter: 'saturate(140%) brightness(105%)' },
  { id: 'dim', name: 'Moody', cssFilter: 'brightness(80%) contrast(110%)' },
  { id: 'warm', name: 'Warm', cssFilter: 'sepia(20%) saturate(130%)' },
  { id: 'cool', name: 'Cool', cssFilter: 'hue-rotate(180deg) saturate(90%) brightness(105%)' },
  { id: 'high-contrast', name: 'Hard', cssFilter: 'contrast(130%) brightness(90%)' },
];

const App: React.FC = () => {
  const [runData, setRunData] = useState<RunData>({
    timeHours: '00',
    timeMinutes: '30',
    timeSeconds: '00',
    distance: '5.0',
    heartRate: '',
    temperature: '',
    showEmojis: false,
    filter: 'none',
  });
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    image: null,
    video: null,
    mediaType: null,
    processedUrl: null,
  });

  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<number>(null);
  
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // 해상도 설정 (720p 최적화)
  const OUTPUT_W = 720;
  const OUTPUT_H = 1280;

  const calculatePace = useCallback(() => {
    const distanceNum = parseFloat(runData.distance) || 0;
    if (distanceNum <= 0) return "-'--\"";
    const totalSeconds = (parseInt(runData.timeHours || '0') * 3600) + 
                        (parseInt(runData.timeMinutes || '0') * 60) + 
                        parseInt(runData.timeSeconds || '0');
    const paceInSeconds = totalSeconds / distanceNum;
    const pMin = Math.floor(paceInSeconds / 60);
    const pSec = Math.floor(paceInSeconds % 60);
    return pMin < 100 ? `${pMin}'${pSec.toString().padStart(2, '0')}"` : "--'--\"";
  }, [runData]);

  const drawOverlay = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const side = W / 1.8;
    const rectX = (W - side) / 2;
    const rectY = (H - side) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.strokeRect(rectX, rectY, side, side);

    ctx.fillStyle = 'white';
    const margin = side * 0.07;
    const dateFontSize = Math.floor(side / 20);
    ctx.font = `600 ${dateFontSize}px "Inter", sans-serif`;

    const showEmoji = runData.showEmojis;

    // 1. Top Left
    ctx.textAlign = 'left';
    let topLeftParts = [];
    if (runData.heartRate) topLeftParts.push(`${showEmoji ? '❤️ ' : ''}${runData.heartRate}`);
    if (runData.temperature) topLeftParts.push(`${showEmoji ? '🌡️ ' : ''}${runData.temperature}°`);
    if (topLeftParts.length > 0) {
      ctx.fillText(topLeftParts.join('  '), rectX + margin, rectY + margin + dateFontSize);
    }

    // 2. Top Right
    ctx.textAlign = 'right';
    const today = new Date();
    const dateDisplay = today.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    ctx.fillText(dateDisplay, rectX + side - margin, rectY + margin + dateFontSize);

    // 3. Bottom Stats
    const statsFontSize = Math.floor(side / 15);
    ctx.font = `bold ${statsFontSize}px "Inter", sans-serif`;
    ctx.textAlign = 'center';

    const hoursInt = parseInt(runData.timeHours || '0');
    const m = (runData.timeMinutes || '0').padStart(2, '0');
    const s = (runData.timeSeconds || '0').padStart(2, '0');
    let timeDisplay = hoursInt > 0 ? `${hoursInt}:${m}:${s}` : `${m}:${s}`;
    const paceDisplay = calculatePace();

    const colWidth = side / 3;
    const statsY = rectY + side - margin;

    ctx.fillText(`${showEmoji ? '⏱️ ' : ''}${timeDisplay}`, rectX + colWidth * 0.5, statsY);
    ctx.fillText(`${showEmoji ? '📍 ' : ''}${runData.distance || '0.0'}k`, rectX + colWidth * 1.5, statsY);
    ctx.fillText(`${showEmoji ? '⚡ ' : ''}${paceDisplay}`, rectX + colWidth * 2.5, statsY);
    ctx.restore();
  };

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 투명 배경을 지원하기 위해 alpha: true 유지 (기본값)
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== OUTPUT_W) {
      canvas.width = OUTPUT_W;
      canvas.height = OUTPUT_H;
    }

    // 매 프레임마다 이전 프레임 삭제 (투명도 유지)
    ctx.clearRect(0, 0, OUTPUT_W, OUTPUT_H);

    const { mediaType, image, video } = canvasState;
    const source = mediaType === 'image' ? image : video;

    if (source) {
      ctx.save();
      const selectedFilter = FILTERS.find(f => f.id === runData.filter);
      ctx.filter = selectedFilter ? selectedFilter.cssFilter : 'none';

      const sWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth;
      const sHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight;
      
      const drawWidth = sWidth * transform.scale;
      const drawHeight = sHeight * transform.scale;
      const basePosX = (OUTPUT_W - drawWidth) / 2;
      const basePosY = (OUTPUT_H - drawHeight) / 2;
      
      ctx.drawImage(source, basePosX + transform.offsetX, basePosY + transform.offsetY, drawWidth, drawHeight);
      ctx.restore();
    }

    // 미디어가 없더라도 오버레이는 항상 그림
    drawOverlay(ctx, OUTPUT_W, OUTPUT_H);

    if (mediaType === 'video') {
      requestRef.current = requestAnimationFrame(renderFrame);
    }
  }, [canvasState, runData, transform, calculatePace]);

  useEffect(() => {
    if (canvasState.mediaType === 'video') {
      requestRef.current = requestAnimationFrame(renderFrame);
    } else {
      renderFrame();
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [canvasState.mediaType, renderFrame]);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video');
    const url = URL.createObjectURL(file);

    if (isVideo) {
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        setCanvasState({ image: null, video, mediaType: 'video', processedUrl: url });
        setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
        video.play();
      };
    } else {
      const img = new Image();
      img.onload = () => {
        setCanvasState({ image: img, video: null, mediaType: 'image', processedUrl: url });
        setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
      };
      img.src = url;
    }
  };

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvasState.mediaType === 'video' && canvasState.video) {
      const video = canvasState.video;
      setIsExporting(true);
      setExportProgress(0);

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm;codecs=vp9';
      const recorder = new MediaRecorder(stream, { 
        mimeType,
        videoBitsPerSecond: 2500000 
      });
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `runsnap-${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        link.href = url;
        link.click();
        setIsExporting(false);
        video.loop = true;
        video.play();
      };

      video.pause();
      video.loop = false;
      video.currentTime = 0;
      
      const updateProgress = () => {
        if (video.paused && video.currentTime > 0) return;
        setExportProgress((video.currentTime / video.duration) * 100);
        if (!video.ended) requestAnimationFrame(updateProgress);
      };

      video.onplay = () => {
        recorder.start();
        updateProgress();
      };

      video.onended = () => {
        recorder.stop();
      };

      await video.play();
    } else {
      // 이미지 또는 미디어가 없는 경우 PNG로 다운로드 (투명도 보존)
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `runsnap-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setRunData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleStart = (x: number, y: number) => {
    isDragging.current = true;
    lastMousePos.current = { x, y };
  };

  const handleMove = (x: number, y: number) => {
    if (!isDragging.current || (!canvasState.image && !canvasState.video)) return;
    const ratio = containerRef.current ? OUTPUT_W / containerRef.current.clientWidth : 1;
    const dx = (x - lastMousePos.current.x) * ratio;
    const dy = (y - lastMousePos.current.y) * ratio;
    setTransform(prev => ({ ...prev, offsetX: prev.offsetX + dx, offsetY: prev.offsetY + dy }));
    lastMousePos.current = { x, y };
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-16">
      {isExporting && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-white">
          <div className="relative w-24 h-24 mb-6">
             <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center font-black text-sm">
                {Math.round(exportProgress)}%
             </div>
          </div>
          <p className="font-black text-xl tracking-tight">인증샷 영상 굽는 중...</p>
          <p className="text-xs text-gray-400 mt-2 font-medium">잠시만 기다려주세요</p>
        </div>
      )}

      <header className="bg-white/80 border-b border-gray-100 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="font-black text-lg italic tracking-tighter">쿠쿠러닝샷</span>
          </div>
          <button onClick={handleDownload} className="px-5 py-2 rounded-full font-bold text-xs transition-all bg-black text-white active:scale-95 shadow-lg shadow-black/10">
            {canvasState.mediaType === 'video' ? '영상 저장' : '이미지 저장'}
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-6 flex flex-col gap-6">
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6 px-1">
            <div className="flex flex-col">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Workout Data</h2>
              <div className="mt-1 flex items-center gap-2">
                 <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[11px] font-black">Pace: {calculatePace()}</div>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-[10px] font-black text-gray-400 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">Emoji</span>
              <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="showEmojis" checked={runData.showEmojis} onChange={handleInputChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="relative">
                <input type="number" name="timeHours" value={runData.timeHours} onChange={handleInputChange} className="w-full h-12 bg-gray-50 border-0 rounded-xl text-center font-black text-base focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="00" />
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-300 uppercase">hr</span>
              </div>
              <div className="relative">
                <input type="number" name="timeMinutes" value={runData.timeMinutes} onChange={handleInputChange} className="w-full h-12 bg-gray-50 border-0 rounded-xl text-center font-black text-base focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="00" />
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-300 uppercase">min</span>
              </div>
              <div className="relative">
                <input type="number" name="timeSeconds" value={runData.timeSeconds} onChange={handleInputChange} className="w-full h-12 bg-gray-50 border-0 rounded-xl text-center font-black text-base focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="00" />
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-300 uppercase">sec</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="relative">
                <input type="number" name="distance" step="0.1" value={runData.distance} onChange={handleInputChange} className="w-full h-12 bg-gray-50 border-0 rounded-xl px-6 font-black text-base focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="거리 (km)" />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-gray-300 text-xs uppercase tracking-tighter">km</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input type="number" name="heartRate" value={runData.heartRate} onChange={handleInputChange} className="w-full h-12 bg-gray-50 border-0 rounded-xl px-4 font-black text-base focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="심박수" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300 text-[10px] uppercase">bpm</span>
                </div>
                <div className="relative">
                  <input type="number" name="temperature" value={runData.temperature} onChange={handleInputChange} className="w-full h-12 bg-gray-50 border-0 rounded-xl px-4 font-black text-base focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="기온" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300 text-[10px] uppercase">°C</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {(canvasState.image || canvasState.video) && (
          <section className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Image Filters</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-2">
              {FILTERS.map((f) => (
                <button key={f.id} onClick={() => setRunData(prev => ({...prev, filter: f.id}))}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${runData.filter === f.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                  {f.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="bg-white p-2 rounded-[2.5rem] shadow-sm border border-gray-100">
          <div ref={containerRef}
            className={`relative aspect-[9/16] w-full overflow-hidden rounded-[2.1rem] flex items-center justify-center select-none touch-none ${!canvasState.mediaType ? 'bg-zinc-900 cursor-pointer' : 'bg-black'}`}
            style={{ touchAction: 'none' }}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={() => isDragging.current = false}
            onMouseLeave={() => isDragging.current = false}
            onTouchStart={(e) => e.touches.length === 1 && handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => e.touches.length === 1 && handleMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={() => isDragging.current = false}
            onClick={() => !canvasState.mediaType && fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} onChange={handleMediaUpload} className="hidden" accept="image/*,video/*" />
            <canvas ref={canvasRef} className="max-w-full max-h-full object-contain pointer-events-none" />
            {!canvasState.mediaType && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
                <p className="text-[10px] font-black text-indigo-400/50 uppercase tracking-widest">Add Media</p>
                <p className="text-[8px] text-gray-500 mt-2 uppercase font-bold">(미선택 시 투명 배경 저장)</p>
              </div>
            )}
          </div>

          <div className="p-4 flex justify-between items-center">
             <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl active:scale-95 transition-transform">
                  {canvasState.mediaType ? '파일 변경' : '파일 추가'}
                </button>
                {canvasState.mediaType && (
                  <button onClick={() => setTransform({ scale: 1, offsetX: 0, offsetY: 0 })} className="text-[10px] font-black text-gray-400 bg-gray-50 px-4 py-2 rounded-xl">위치 초기화</button>
                )}
             </div>
             <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">9:16 {canvasState.mediaType === 'video' ? 'VIDEO' : 'STORY'}</span>
          </div>
        </section>
      </main>

      <footer className="mt-12 mb-4 text-center text-[9px] font-black text-gray-300 tracking-[0.4em] uppercase">Kuku Studio</footer>
      <div className="flex justify-center pb-8">
        <button onClick={() => window.open('https://koo-vibecoding-gal.vercel.app/', '_blank', 'noopener,noreferrer')}
          className="text-[10px] font-bold text-gray-400 border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2">
          <span>다른 앱 더 보기</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      </div>
    </div>
  );
};

export default App;
