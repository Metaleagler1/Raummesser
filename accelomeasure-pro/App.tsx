
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SensorStatus, MeasurementRecord, DeviceSettings, EdgeType, AppMode, WallSegment } from './types';
import { getMagnitude, deadZone, lowPassFilter } from './utils/physics';
import { generateDXF, downloadBlob } from './utils/dxf';
import HistoryList from './components/HistoryList';
import InfoOverlay from './components/InfoOverlay';

const App: React.FC = () => {
  // App State
  const [mode, setMode] = useState<AppMode>('DISTANCE');
  const [status, setStatus] = useState<SensorStatus>(SensorStatus.IDLE);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [rawDistance, setRawDistance] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  
  // Data State
  const [history, setHistory] = useState<MeasurementRecord[]>([]);
  const [currentScan, setCurrentScan] = useState<WallSegment[]>([]);
  
  // Device Settings
  const [settings, setSettings] = useState<DeviceSettings>({
    lengthCm: 16.0,
    widthCm: 7.5,
    thicknessCm: 0.8,
    startEdge: 'BOTTOM',
    endEdge: 'TOP'
  });

  // Physics refs
  const velocity = useRef(0);
  const currentRawDistance = useRef(0);
  const lastTimestamp = useRef(0);
  const lastAccelMagnitude = useRef(0);
  const startTime = useRef(0);
  const calibrationSamples = useRef<number[]>([]);
  const biasMagnitude = useRef(0);
  const lastRawAccel = useRef(0);
  const stationaryCount = useRef(0);
  const currentCompass = useRef(0);

  // Constants
  const ACCEL_THRESHOLD_BASE = 0.12; 
  const ALPHA = 0.15;
  const CALIBRATION_TIME = 800;
  const STATIONARY_LIMIT = 12;

  const requestPermission = async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response === 'granted') {
          setStatus(SensorStatus.ACTIVE);
        } else { setStatus(SensorStatus.DENIED); }
      } catch (e) { setStatus(SensorStatus.DENIED); }
    } else { setStatus(SensorStatus.ACTIVE); }
    
    // Also request orientation if available
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      await (DeviceOrientationEvent as any).requestPermission();
    }
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    // Use alpha (compass) for room contouring
    if (e.alpha !== null) {
      currentCompass.current = e.alpha;
      setCurrentHeading(e.alpha);
    }
  };

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const now = performance.now();
    const dt = (now - lastTimestamp.current) / 1000;
    lastTimestamp.current = now;
    if (dt <= 0 || dt > 0.5) return;

    const accel = event.acceleration;
    if (!accel || accel.x === null) return;

    const rawA = getMagnitude(accel.x, accel.y, accel.z);
    
    if (isCalibrating) {
      calibrationSamples.current.push(rawA);
      if (now - startTime.current > CALIBRATION_TIME) {
        const sum = calibrationSamples.current.reduce((a, b) => a + b, 0);
        biasMagnitude.current = sum / calibrationSamples.current.length;
        setIsCalibrating(false);
        setIsMeasuring(true);
        velocity.current = 0;
        currentRawDistance.current = 0;
        lastAccelMagnitude.current = 0;
        lastRawAccel.current = 0;
      }
      return;
    }

    if (!isMeasuring) return;

    let calibratedA = Math.max(0, rawA - biasMagnitude.current);
    let filteredA = lowPassFilter(calibratedA, lastAccelMagnitude.current, ALPHA);
    let effectiveA = deadZone(filteredA, ACCEL_THRESHOLD_BASE);

    if (effectiveA === 0) {
      stationaryCount.current++;
      if (stationaryCount.current > STATIONARY_LIMIT) velocity.current = 0;
    } else { stationaryCount.current = 0; }

    const avgA = (lastRawAccel.current + effectiveA) / 2;
    velocity.current += avgA * dt;
    currentRawDistance.current += velocity.current * dt;

    lastRawAccel.current = effectiveA;
    lastAccelMagnitude.current = filteredA;
    setRawDistance(currentRawDistance.current);
  }, [isMeasuring, isCalibrating]);

  useEffect(() => {
    if (status === SensorStatus.ACTIVE) {
      window.addEventListener('devicemotion', handleMotion);
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [status, handleMotion]);

  const calculateFinalDistance = (raw: number) => {
    let correction = 0;
    // Length correction (TOP/BOTTOM)
    if (settings.startEdge === 'BOTTOM' && settings.endEdge === 'TOP') correction += settings.lengthCm;
    else if (settings.startEdge === 'TOP' && settings.endEdge === 'BOTTOM') correction -= settings.lengthCm;
    
    // Simplified: For room contours, we usually assume the user is using the phone's long edge.
    return Math.max(0, raw + (correction / 100));
  };

  const displayDistance = calculateFinalDistance(rawDistance);

  const toggleMeasurement = () => {
    if (!isMeasuring && !isCalibrating) {
      if (status !== SensorStatus.ACTIVE) {
        requestPermission();
        return;
      }
      setIsCalibrating(true);
      calibrationSamples.current = [];
      startTime.current = performance.now();
      lastTimestamp.current = performance.now();
      setRawDistance(0);
    } else {
      const finalDist = calculateFinalDistance(currentRawDistance.current);
      if (mode === 'DISTANCE') {
        if (finalDist > 0.01) {
          setHistory(prev => [{
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            distance: finalDist,
            duration: performance.now() - startTime.current,
            settings: { ...settings }
          }, ...prev]);
        }
      } else {
        // Room Scan logic: capture segment
        if (finalDist > 0.01) {
          const relativeAngle = currentScan.length === 0 ? 0 : currentCompass.current; 
          setCurrentScan(prev => [...prev, { length: finalDist, angle: relativeAngle }]);
        }
      }
      setIsMeasuring(false);
      setIsCalibrating(false);
    }
  };

  const exportScan = () => {
    const dxf = generateDXF(currentScan);
    downloadBlob(dxf, `Raumscan_${new Date().toISOString().slice(0, 10)}.dxf`, 'application/dxf');
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4 max-w-lg mx-auto overflow-x-hidden">
      {/* Top Header */}
      <header className="w-full flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">AcceloMeasure <span className="text-indigo-400">Scan</span></h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsSettingsOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button onClick={() => setShowInfo(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 text-slate-400">?</button>
        </div>
      </header>

      {/* Mode Switcher */}
      <div className="flex w-full bg-slate-800/50 p-1 rounded-2xl border border-slate-700 mb-8">
        <button 
          onClick={() => setMode('DISTANCE')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${mode === 'DISTANCE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
        >
          EINZELMESSUNG
        </button>
        <button 
          onClick={() => setMode('ROOM_SCAN')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${mode === 'ROOM_SCAN' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
        >
          RAUMSCAN (DXF)
        </button>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center w-full space-y-6">
        {/* Visual Display */}
        <div className="relative flex flex-col items-center py-12 w-full text-center">
          {isCalibrating ? (
            <div className="animate-pulse">
              <div className="text-3xl font-black text-indigo-400 mb-2 uppercase">Kalibrierung</div>
              <p className="text-slate-500 text-sm">Gerät am Startpunkt fixieren</p>
            </div>
          ) : (
            <>
              <div className="text-8xl font-black text-white tabular-nums tracking-tighter drop-shadow-2xl">
                {displayDistance.toFixed(2)}
              </div>
              <div className="text-slate-400 font-medium text-lg uppercase tracking-[0.2em] mt-2">Meter</div>
              
              {mode === 'ROOM_SCAN' && (
                <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-indigo-300 font-bold uppercase">Wand {currentScan.length + 1}</span>
                </div>
              )}
            </>
          )}
          <div className="absolute -inset-10 bg-indigo-600/5 rounded-full blur-3xl -z-10"></div>
        </div>

        {/* Action Button */}
        <div className="w-full space-y-4">
          <button
            onClick={toggleMeasurement}
            disabled={isCalibrating}
            className={`w-full py-6 rounded-3xl font-bold text-xl transition-all shadow-xl active:scale-95 disabled:opacity-50 ${
              isMeasuring ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'
            }`}
          >
            {isCalibrating ? 'MESSBEREIT...' : (isMeasuring ? 'WAND STOPPEN' : 'WAND STARTEN')}
          </button>

          {mode === 'ROOM_SCAN' && currentScan.length > 0 && !isMeasuring && (
            <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-bottom-2 duration-300">
              <button 
                onClick={() => setCurrentScan([])}
                className="py-4 bg-slate-800 text-slate-300 font-bold rounded-2xl text-sm border border-slate-700"
              >
                VERWERFEN
              </button>
              <button 
                onClick={exportScan}
                className="py-4 bg-emerald-600 text-white font-bold rounded-2xl text-sm shadow-lg shadow-emerald-900/20"
              >
                DXF EXPORT ({currentScan.length})
              </button>
            </div>
          )}
        </div>

        {/* Room Scan Segments Preview */}
        {mode === 'ROOM_SCAN' && currentScan.length > 0 && (
          <div className="w-full max-w-md bg-slate-800/30 rounded-2xl p-4 border border-slate-700/50">
            <h4 className="text-[10px] text-slate-500 uppercase font-bold mb-3 tracking-widest">Grundriss Segmente</h4>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {currentScan.map((s, i) => (
                <div key={i} className="flex-shrink-0 px-3 py-2 bg-slate-900/50 border border-indigo-500/30 rounded-xl text-center">
                  <div className="text-[10px] text-indigo-400">W{i+1}</div>
                  <div className="text-sm font-bold text-white">{s.length.toFixed(2)}m</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'DISTANCE' && <HistoryList history={history} onClear={() => setHistory([])} />}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Geräte-Konfiguration</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Länge (cm)</label>
                <input type="number" step="0.1" value={settings.lengthCm} onChange={(e) => setSettings(s => ({...s, lengthCm: parseFloat(e.target.value) || 0}))} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-3 text-white font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Breite (cm)</label>
                <input type="number" step="0.1" value={settings.widthCm} onChange={(e) => setSettings(s => ({...s, widthCm: parseFloat(e.target.value) || 0}))} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-3 text-white font-bold" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Gehäusedicke (cm)</label>
                <input type="number" step="0.1" value={settings.thicknessCm} onChange={(e) => setSettings(s => ({...s, thicknessCm: parseFloat(e.target.value) || 0}))} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-3 text-white font-bold" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Messkanten (Anfang/Ende)</label>
              <div className="flex gap-2">
                {['TOP', 'BOTTOM'].map(e => (
                  <button key={e} onClick={() => setSettings(s => ({...s, startEdge: e as EdgeType}))} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${settings.startEdge === e ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}>{e === 'TOP' ? 'OBEN' : 'UNTEN'}</button>
                ))}
              </div>
              <div className="flex gap-2">
                {['TOP', 'BOTTOM'].map(e => (
                  <button key={e} onClick={() => setSettings(s => ({...s, endEdge: e as EdgeType}))} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${settings.endEdge === e ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}>{e === 'TOP' ? 'OBEN' : 'UNTEN'}</button>
                ))}
              </div>
            </div>

            <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl">SPEICHERN</button>
          </div>
        </div>
      )}

      {showInfo && <InfoOverlay onClose={() => setShowInfo(false)} />}
    </div>
  );
};

export default App;
