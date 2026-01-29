
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
  { id: 'vivid', name: 'Vivid', cssFilter: 'saturate(160%) brightness(110%)' },
  { id: 'dim', name: 'Moody', cssFilter: 'brightness(70%) contrast(120%)' },
  { id: 'warm', name: 'Warm', cssFilter: 'sepia(30%) saturate(140%) brightness(105%)' },
  { id: 'cool', name: 'Cool', cssFilter: 'hue-rotate(180deg) saturate(80%) brightness(110%)' },
  { id: 'high-contrast', name: 'Hard', cssFilter: 'contrast(150%) brightness(90%)' },
];

const App: React.FC = () => {
  const [runData, setRunData] = useState<RunData>({
    timeHours: '00',
    timeMinutes: '30',
    timeSeconds: '00',
    distance: '5.0',
    heartRate: '',
    temperature: '',
    showEmojis: true,
    filter: 'none',
  });
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    image: null,
    processedUrl: null,
  });

  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setRunData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleFilterSelect = (filterId: string) => {
    setRunData(prev => ({ ...prev, filter: filterId }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCanvasState(prev => ({ ...prev, image: img }));
        setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = canvasState.image;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outputWidth = 1080;
    const outputHeight = 1920;
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.clearRect(0, 0, outputWidth, outputHeight);
    
    // Apply Filter
    const selectedFilter = FILTERS.find(f => f.id === runData.filter);
    ctx.filter = selectedFilter ? selectedFilter.cssFilter : 'none';

    ctx.save();
    const drawWidth = img.naturalWidth * transform.scale;
    const drawHeight = img.naturalHeight * transform.scale;
    const basePosX = (outputWidth - drawWidth) / 2;
    const basePosY = (outputHeight - drawHeight) / 2;
    
    ctx.drawImage(img, basePosX + transform.offsetX, basePosY + transform.offsetY, drawWidth, drawHeight);
    ctx.restore();

    // Reset filter for UI elements
    ctx.filter = 'none';

    const W = outputWidth;
    const H = outputHeight;
    const side = W / 2;
    const rectX = (W - side) / 2;
    const rectY = (H - side) / 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 6;
    ctx.strokeRect(rectX, rectY, side, side);

    ctx.fillStyle = 'white';
    const margin = side * 0.06;
    const dateFontSize = Math.floor(side / 22);
    ctx.font = `600 ${dateFontSize}px "Inter", sans-serif`;

    const showEmoji = runData.showEmojis;

    // 1. Top Left: Heart Rate & Temperature (Conditional)
    ctx.textAlign = 'left';
    let topLeftParts = [];
    if (runData.heartRate) {
      topLeftParts.push(`${showEmoji ? '❤️ ' : ''}${runData.heartRate} bpm`);
    }
    if (runData.temperature) {
      topLeftParts.push(`${showEmoji ? '🌡️ ' : ''}${runData.temperature}°C`);
    }
    if (topLeftParts.length > 0) {
      ctx.fillText(topLeftParts.join('  '), rectX + margin, rectY + margin + dateFontSize);
    }

    // 2. Top Right: Date
    ctx.textAlign = 'right';
    const today = new Date();
    const dateDisplay = today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    ctx.fillText(dateDisplay, rectX + side - margin, rectY + margin + dateFontSize);

    // 3. Bottom Columns: Run Stats (Improved Layout)
    const statsFontSize = Math.floor(side / 17);
    ctx.font = `bold ${statsFontSize}px "Inter", sans-serif`;
    ctx.textAlign = 'center';

    const hoursInt = parseInt(runData.timeHours || '0');
    const m = (runData.timeMinutes || '0').padStart(2, '0');
    const s = (runData.timeSeconds || '0').padStart(2, '0');
    let timeDisplay = hoursInt > 0 ? `${hoursInt.toString().padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;
    const paceDisplay = calculatePace();

    const colWidth = side / 3;
    const statsY = rectY + side - margin;

    // Column 1: Time
    ctx.fillText(
      `${showEmoji ? '⏱️ ' : ''}${timeDisplay}`, 
      rectX + colWidth * 0.5, 
      statsY
    );
    
    // Column 2: Distance
    ctx.fillText(
      `${showEmoji ? '📍 ' : ''}${runData.distance || '0.0'}km`, 
      rectX + colWidth * 1.5, 
      statsY
    );

    // Column 3: Pace
    ctx.fillText(
      `${showEmoji ? '⚡ ' : ''}${paceDisplay}`, 
      rectX + colWidth * 2.5, 
      statsY
    );

  }, [canvasState.image, runData, transform, calculatePace]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const link = document.createElement('a');
    link.download = `runsnap-${Date.now()}.jpg`;
    link.href = dataUrl;
    link.click();
  };

  const getMoveRatio = () => {
    if (!containerRef.current) return 1;
    return 1080 / containerRef.current.clientWidth;
  };

  const handleStart = (x: number, y: number) => {
    isDragging.current = true;
    lastMousePos.current = { x, y };
  };

  const handleMove = (x: number, y: number) => {
    if (!isDragging.current || !canvasState.image) return;
    const ratio = getMoveRatio();
    const dx = (x - lastMousePos.current.x) * ratio;
    const dy = (y - lastMousePos.current.y) * ratio;

    setTransform(prev => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy
    }));
    lastMousePos.current = { x, y };
  };

  const handlePinch = (dist: number) => {
    if (!lastPinchDist.current) {
      lastPinchDist.current = dist;
      return;
    }
    const ratio = dist / lastPinchDist.current;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.05, Math.min(20, prev.scale * ratio))
    }));
    lastPinchDist.current = dist;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-16">
      <header className="bg-white/80 border-b border-gray-100 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="font-black text-lg italic tracking-tighter">쿠쿠러닝샷</span>
          </div>
          <button 
            onClick={handleDownload}
            disabled={!canvasState.image}
            className={`px-5 py-2 rounded-full font-bold text-xs transition-all ${canvasState.image ? 'bg-black text-white active:scale-95' : 'bg-gray-100 text-gray-300'}`}
          >
            저장하기
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-6 flex flex-col gap-6">
        
        {/* Workout Data Section */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6 px-1">
            <div className="flex flex-col">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Workout Data</h2>
              <div className="mt-1 flex items-center gap-2">
                 <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[11px] font-black">
                  Pace: {calculatePace()}
                </div>
              </div>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-[10px] font-black text-gray-400 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">Emoji</span>
              <div className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  name="showEmojis" 
                  checked={runData.showEmojis} 
                  onChange={handleInputChange} 
                  className="sr-only peer" 
                />
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
                  <input type="number" name="heartRate" value={runData.heartRate} onChange={handleInputChange} className="w-full h-12 bg-gray-50 border-0 rounded-xl px-4 font-black text-base focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="평균 심박수" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300 text-[10px] uppercase">bpm</span>
                </div>
                <div className="relative">
                  <input type="number" name="temperature" value={runData.temperature} onChange={handleInputChange} className="w-full h-12 bg-gray-50 border-0 rounded-xl px-4 font-black text-base focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="평균 기온" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300 text-[10px] uppercase">°C</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Filters Section */}
        <section className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Image Filters</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => handleFilterSelect(f.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                  runData.filter === f.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </section>

        {/* Preview Section */}
        <section className="bg-white p-2 rounded-[2.5rem] shadow-sm border border-gray-100">
          <div 
            ref={containerRef}
            className={`relative aspect-[9/16] w-full overflow-hidden rounded-[2.1rem] flex items-center justify-center select-none touch-none ${!canvasState.image ? 'bg-gray-50 border-2 border-dashed border-gray-100 cursor-pointer' : 'bg-black'}`}
            style={{ touchAction: 'none' }}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={() => isDragging.current = false}
            onMouseLeave={() => isDragging.current = false}
            onWheel={(e) => {
              if (!canvasState.image) return;
              const delta = e.deltaY > 0 ? 0.9 : 1.1;
              setTransform(prev => ({ ...prev, scale: Math.max(0.05, Math.min(20, prev.scale * delta)) }));
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                handleStart(e.touches[0].clientX, e.touches[0].clientY);
              } else if (e.touches.length === 2) {
                lastPinchDist.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 1) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
              } else if (e.touches.length === 2) {
                handlePinch(Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY));
              }
            }}
            onTouchEnd={() => {
              isDragging.current = false;
              lastPinchDist.current = null;
            }}
            onClick={() => !canvasState.image && fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            
            {!canvasState.image ? (
              <div className="text-center px-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200 mx-auto mb-4">
                  <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
                <p className="text-sm font-black text-gray-800">사진 업로드</p>
                <p className="text-[10px] font-bold text-gray-400 mt-1 italic">갤러리에서 사진을 선택하세요</p>
              </div>
            ) : (
              <canvas ref={canvasRef} className="max-w-full max-h-full object-contain pointer-events-none" />
            )}
          </div>

          {canvasState.image && (
            <div className="p-4 flex justify-between items-center">
               <div className="flex gap-2">
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl">사진 변경</button>
                  <button onClick={() => setTransform({ scale: 1, offsetX: 0, offsetY: 0 })} className="text-[10px] font-black text-gray-400 bg-gray-50 px-4 py-2 rounded-xl">위치 초기화</button>
               </div>
               <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Story 9:16</span>
            </div>
          )}
        </section>
      </main>

      <footer className="mt-12 mb-4 text-center text-[9px] font-black text-gray-300 tracking-[0.4em] uppercase">
        Kuku Studio
      </footer>

      <div className="flex justify-center pb-8">
        <button 
          onClick={() => window.open('https://koo-vibecoding-gal.vercel.app/', '_blank', 'noopener,noreferrer')}
          className="text-[10px] font-bold text-gray-400 border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2"
        >
          <span>다른 앱 더 보기</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      </div>
    </div>
  );
};

export default App;
