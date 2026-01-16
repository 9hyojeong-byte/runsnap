
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RunData, CanvasState } from './types';

interface TransformState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const App: React.FC = () => {
  const [runData, setRunData] = useState<RunData>({
    timeHours: '00',
    timeMinutes: '30',
    timeSeconds: '00',
    distance: '4.2',
    paceMinutes: '8',
    paceSeconds: '00',
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Interaction states
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (['timeMinutes', 'timeSeconds', 'paceSeconds'].includes(name)) {
      const val = parseInt(value);
      if (val > 59) return;
    }
    setRunData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCanvasState(prev => ({ ...prev, image: img }));
        // Reset transform on new image
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

    // We use a fixed high-resolution internal canvas size for the "result" 
    // and scale down for the CSS preview if needed. 
    // Or we match the 9:16 ratio for the base.
    const outputWidth = 1080;
    const outputHeight = 1920;
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.clearRect(0, 0, outputWidth, outputHeight);
    ctx.save();

    // 1. Draw Background Image with transform
    const drawWidth = img.naturalWidth * transform.scale;
    const drawHeight = img.naturalHeight * transform.scale;
    
    // Center the image initially, then apply offsets
    const basePosX = (outputWidth - drawWidth) / 2;
    const basePosY = (outputHeight - drawHeight) / 2;
    
    ctx.drawImage(
      img, 
      basePosX + transform.offsetX, 
      basePosY + transform.offsetY, 
      drawWidth, 
      drawHeight
    );
    
    ctx.restore();

    // 2. Draw Fixed Overlay
    const W = outputWidth;
    const H = outputHeight;
    const side = W / 2;
    const thickness = 6; // Fixed high res thickness

    const rectX = (W - side) / 2;
    const rectY = (H - side) / 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Square Border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = thickness;
    ctx.strokeRect(rectX, rectY, side, side);

    ctx.fillStyle = 'white';

    // Date (Top Right)
    const today = new Date();
    const dateDisplay = today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    const dateFontSize = Math.floor(side / 22);
    ctx.font = `600 ${dateFontSize}px "Inter", sans-serif`;
    ctx.textAlign = 'right';
    const margin = side * 0.05;
    ctx.fillText(dateDisplay, rectX + side - margin, rectY + margin + dateFontSize);

    // Workout Stats (Bottom)
    const statsFontSize = Math.floor(side / 16);
    ctx.font = `bold ${statsFontSize}px "Inter", sans-serif`;
    ctx.textAlign = 'center';

    const hoursInt = parseInt(runData.timeHours || '0');
    const m = (runData.timeMinutes || '0').padStart(2, '0');
    const s = (runData.timeSeconds || '0').padStart(2, '0');
    let timeDisplay = hoursInt > 0 ? `${hoursInt.toString().padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;

    const pS = (runData.paceSeconds || '0').padStart(2, '0');
    const paceDisplay = `${runData.paceMinutes || '0'}'${pS}"`;
    const displayText = `⏱️${timeDisplay}    📍${runData.distance || '0.00'}km    ⚡${paceDisplay}`;
    
    ctx.fillText(displayText, W / 2, rectY + side - margin);

    setCanvasState(prev => ({ ...prev, processedUrl: canvas.toDataURL('image/jpeg', 0.9) }));
  }, [canvasState.image, runData, transform]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !canvasState.image) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    
    // Adjust sensitivity based on canvas vs client size ratio
    const sensitivity = 2; 
    setTransform(prev => ({
      ...prev,
      offsetX: prev.offsetX + dx * sensitivity,
      offsetY: prev.offsetY + dy * sensitivity
    }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!canvasState.image) return;
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(10, prev.scale * delta))
    }));
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastPinchDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canvasState.image) return;
    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastMousePos.current.x;
      const dy = e.touches[0].clientY - lastMousePos.current.y;
      const sensitivity = 2;
      setTransform(prev => ({
        ...prev,
        offsetX: prev.offsetX + dx * sensitivity,
        offsetY: prev.offsetY + dy * sensitivity
      }));
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / lastPinchDist.current;
      setTransform(prev => ({
        ...prev,
        scale: Math.max(0.1, Math.min(10, prev.scale * ratio))
      }));
      lastPinchDist.current = dist;
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    lastPinchDist.current = null;
  };

  const downloadImage = () => {
    if (canvasState.processedUrl) {
      const link = document.createElement('a');
      link.download = `runsnap-${new Date().getTime()}.jpg`;
      link.href = canvasState.processedUrl;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-12 selection:bg-indigo-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 backdrop-blur-md bg-white/80">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-black tracking-tight text-indigo-900 italic">RunSnap</h1>
          </div>
          <button 
            onClick={downloadImage}
            disabled={!canvasState.processedUrl}
            className={`px-6 py-2.5 rounded-full font-black text-sm transition-all ${
              canvasState.processedUrl 
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95' 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            이미지 저장
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        
        {/* Left Section: Workout Record Input */}
        <section className="space-y-6 order-2 lg:order-1">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h2 className="text-xl font-black mb-8 flex items-center gap-3">
              <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-sm shadow-lg shadow-indigo-100">01</span>
              기록 수정하기
            </h2>
            
            <div className="space-y-8">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">운동 시간 (TIME)</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input type="number" name="timeHours" value={runData.timeHours} onChange={handleInputChange} placeholder="00" className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-center font-black text-lg transition-all" />
                    <p className="text-[10px] text-center mt-2 text-gray-400 font-bold">HOUR</p>
                  </div>
                  <span className="text-gray-200 font-black text-2xl mb-8">:</span>
                  <div className="flex-1">
                    <input type="number" name="timeMinutes" value={runData.timeMinutes} onChange={handleInputChange} placeholder="00" min="0" max="59" className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-center font-black text-lg transition-all" />
                    <p className="text-[10px] text-center mt-2 text-gray-400 font-bold">MIN</p>
                  </div>
                  <span className="text-gray-200 font-black text-2xl mb-8">:</span>
                  <div className="flex-1">
                    <input type="number" name="timeSeconds" value={runData.timeSeconds} onChange={handleInputChange} placeholder="00" min="0" max="59" className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-center font-black text-lg transition-all" />
                    <p className="text-[10px] text-center mt-2 text-gray-400 font-bold">SEC</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">운동 거리 (DISTANCE, km)</label>
                <div className="relative">
                  <input type="text" name="distance" value={runData.distance} onChange={handleInputChange} placeholder="0.00" className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-black text-lg pr-16 transition-all" />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-gray-300">KM</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">평균 페이스 (PACE)</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center gap-3">
                    <input type="number" name="paceMinutes" value={runData.paceMinutes} onChange={handleInputChange} placeholder="5" className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-black text-lg text-center transition-all" />
                    <span className="text-gray-300 font-black text-2xl">'</span>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <input type="number" name="paceSeconds" value={runData.paceSeconds} onChange={handleInputChange} placeholder="00" min="0" max="59" className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-black text-lg text-center transition-all" />
                    <span className="text-gray-300 font-black text-2xl">"</span>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={drawCanvas}
              disabled={!canvasState.image}
              className={`w-full mt-12 py-5 rounded-2xl font-black text-lg shadow-xl transition-all ${
                canvasState.image 
                ? 'bg-black text-white hover:bg-gray-800 hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98]' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              기록 반영하기
            </button>

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="text-[10px] bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-black uppercase tracking-wider">#러닝</span>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-black uppercase tracking-wider">#오운완</span>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-black uppercase tracking-wider">#RunSnap</span>
            </div>
          </div>
        </section>

        {/* Right Section: Integrated Preview & Upload */}
        <section className="order-1 lg:order-2">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                스토리 프리뷰
              </h2>
              {canvasState.image && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  이미지 변경
                </button>
              )}
            </div>
            
            <div 
              className={`relative aspect-[9/16] w-full overflow-hidden rounded-[1.8rem] border border-gray-100 flex items-center justify-center shadow-inner transition-all duration-300 select-none touch-none ${!canvasState.image ? 'bg-gray-50 border-dashed border-2 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer' : 'bg-black cursor-move'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={() => !canvasState.image && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
                accept="image/*"
              />
              
              {!canvasState.image ? (
                <div className="text-center p-12">
                  <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-100/50 mx-auto mb-6">
                    <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-black text-gray-800 mb-2">사진 업로드</h3>
                  <p className="text-xs font-bold text-gray-400 leading-relaxed italic">
                    오늘의 러닝 인증샷을<br/>이곳에 등록해 주세요.
                  </p>
                </div>
              ) : (
                <canvas 
                  ref={canvasRef} 
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />
              )}
            </div>

            {canvasState.image && (
              <div className="mt-6 space-y-3">
                <div className="p-5 bg-indigo-50/50 rounded-2xl flex items-start gap-3 border border-indigo-100">
                  <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center text-lg shrink-0">👆</div>
                  <p className="text-[11px] text-indigo-700 leading-tight font-bold">
                    이미지를 드래그하여 이동하고,<br/>
                    마우스 휠이나 핀치 줌으로 크기를 조절하세요.
                  </p>
                </div>
                <div className="flex justify-between items-center px-2">
                   <p className="text-[10px] font-black text-gray-300 tracking-widest uppercase">Ratio: 9:16 vertical</p>
                   <button 
                    onClick={() => setTransform({ scale: 1, offsetX: 0, offsetY: 0 })}
                    className="text-[10px] font-black text-indigo-600 hover:underline"
                   >
                     위치 초기화
                   </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="max-w-4xl mx-auto px-4 mt-16 text-center text-gray-400 text-[10px] font-black tracking-widest uppercase">
        <p>© 2026 RunSnap Studio. Keep Pushing Forward.</p>
      </footer>
    </div>
  );
};

export default App;
