
import React from 'react';
import { MeasurementRecord } from '../types';

interface HistoryListProps {
  history: MeasurementRecord[];
  onClear: () => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ history, onClear }) => {
  if (history.length === 0) return null;

  return (
    <div className="mt-8 w-full max-w-md bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-200">Verlauf</h3>
        <button 
          onClick={onClear}
          className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
        >
          Löschen
        </button>
      </div>
      <div className="space-y-3">
        {history.map((item) => (
          <div key={item.id} className="flex justify-between items-center p-3 bg-slate-900/40 rounded-xl border border-slate-700/50">
            <div>
              <p className="text-sm text-slate-400">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-xs text-slate-500">Dauer: {(item.duration / 1000).toFixed(1)}s</p>
            </div>
            <div className="text-xl font-bold text-blue-400">
              {item.distance.toFixed(2)}m
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryList;
