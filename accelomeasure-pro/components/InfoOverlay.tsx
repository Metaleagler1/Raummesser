
import React from 'react';

const InfoOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">
          Raumscan <span className="text-indigo-400">Anleitung</span>
        </h2>
        <div className="space-y-4 text-slate-300 text-sm">
          <section>
            <h3 className="text-white font-bold mb-1">Raumkontur aufnehmen</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Für einen Grundriss messen Sie jede Wand einzeln. Die App nutzt den Kompass, um die relativen Winkel zwischen den Wänden zu erfassen.
            </p>
          </section>

          <ul className="space-y-3">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white">1</span>
              <div><b>Wand starten:</b> Setzen Sie das Handy an die Wandkante an und drücken Sie Start.</div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white">2</span>
              <div><b>Endpunkt:</b> Führen Sie das Handy zur nächsten Ecke und stoppen Sie die Messung.</div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white">3</span>
              <div><b>DXF Export:</b> Nach allen Wänden können Sie den Grundriss als DXF für CAD-Programme herunterladen.</div>
            </li>
          </ul>

          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[11px] italic text-amber-200">
            Wichtig: Die Gerätemaße (Breite/Dicke) fließen in die DXF-Berechnung ein, um Eckenversätze zu kompensieren. Halten Sie das Gerät möglichst flach an der Wand.
          </div>
        </div>
        <button 
          onClick={onClose}
          className="mt-8 w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
};

export default InfoOverlay;
