'use client';

import React from 'react';
import { Crown, Trophy, RotateCcw, Medal } from 'lucide-react';
import { Participant } from '@/types/game';

interface PodiumProps {
  participants: Participant[];
  onReset: () => void;
}

export default function Podium({ participants, onReset }: PodiumProps) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  return (
    <div className="w-full bg-slate-900/90 border border-yellow-500/40 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(234,179,8,0.15)] flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center gap-2 text-yellow-400 font-mono font-bold text-sm sm:text-base tracking-widest uppercase mb-1">
        <Trophy className="animate-bounce" size={20} />
        <span>VICTORY CEREMONY</span>
        <Trophy className="animate-bounce" size={20} />
      </div>

      <h2 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-500 tracking-tight drop-shadow-md mb-8">
        최종 배틀 결과
      </h2>

      {/* Podium Display (2nd - 1st - 3rd) */}
      <div className="flex items-end justify-center gap-3 sm:gap-6 w-full max-w-2xl mb-8 px-2">
        {/* 2nd Place */}
        <div className="flex-1 flex flex-col items-center">
          {second ? (
            <div className="flex flex-col items-center mb-3 animate-in slide-in-from-bottom-6 duration-700 delay-150">
              <span className="text-3xl sm:text-4xl mb-1">{second.avatar}</span>
              <div className="flex items-center gap-1 font-bold text-slate-200 text-sm sm:text-base truncate max-w-[110px] sm:max-w-[150px]">
                <Medal size={16} className="text-slate-300 shrink-0" />
                <span className="truncate">{second.nickname}</span>
              </div>
              <div className="font-mono text-xs text-cyan-300 font-bold mt-0.5">
                {second.score.toLocaleString()} clicks
              </div>
            </div>
          ) : (
            <div className="h-16 flex items-center text-xs text-slate-600 font-mono">-</div>
          )}
          <div className="w-full bg-gradient-to-t from-slate-800 to-slate-700/80 border-t-4 border-slate-300 rounded-t-2xl h-28 sm:h-36 flex flex-col items-center justify-center shadow-lg relative">
            <span className="text-3xl sm:text-4xl font-black text-slate-300 font-mono">2</span>
            <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">SILVER</span>
          </div>
        </div>

        {/* 1st Place (Champion) */}
        <div className="flex-1 flex flex-col items-center">
          {first ? (
            <div className="flex flex-col items-center mb-3 animate-in slide-in-from-bottom-8 duration-700">
              <Crown size={32} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)] mb-1 animate-pulse" />
              <span className="text-4xl sm:text-5xl mb-1">{first.avatar}</span>
              <div className="flex items-center gap-1 font-black text-yellow-300 text-base sm:text-lg truncate max-w-[130px] sm:max-w-[180px]">
                <span className="truncate">{first.nickname}</span>
              </div>
              <div className="font-mono text-sm text-yellow-400 font-extrabold mt-0.5 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">
                {first.score.toLocaleString()} clicks
              </div>
            </div>
          ) : (
            <div className="h-24 flex items-center text-xs text-slate-600 font-mono">-</div>
          )}
          <div className="w-full bg-gradient-to-t from-yellow-950/80 to-yellow-600/80 border-t-4 border-yellow-300 rounded-t-2xl h-36 sm:h-48 flex flex-col items-center justify-center shadow-[0_0_25px_rgba(234,179,8,0.3)] relative">
            <span className="text-4xl sm:text-5xl font-black text-yellow-300 font-mono drop-shadow">1</span>
            <span className="text-[11px] text-yellow-200 font-black font-mono tracking-widest uppercase mt-1">CHAMPION</span>
          </div>
        </div>

        {/* 3rd Place */}
        <div className="flex-1 flex flex-col items-center">
          {third ? (
            <div className="flex flex-col items-center mb-3 animate-in slide-in-from-bottom-4 duration-700 delay-300">
              <span className="text-3xl sm:text-4xl mb-1">{third.avatar}</span>
              <div className="flex items-center gap-1 font-bold text-amber-200 text-sm sm:text-base truncate max-w-[110px] sm:max-w-[150px]">
                <Medal size={16} className="text-amber-500 shrink-0" />
                <span className="truncate">{third.nickname}</span>
              </div>
              <div className="font-mono text-xs text-cyan-300 font-bold mt-0.5">
                {third.score.toLocaleString()} clicks
              </div>
            </div>
          ) : (
            <div className="h-16 flex items-center text-xs text-slate-600 font-mono">-</div>
          )}
          <div className="w-full bg-gradient-to-t from-amber-950/70 to-amber-700/80 border-t-4 border-amber-500 rounded-t-2xl h-20 sm:h-28 flex flex-col items-center justify-center shadow-lg relative">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">3</span>
            <span className="text-[10px] text-amber-300 font-mono tracking-widest uppercase mt-1">BRONZE</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={onReset}
          className="flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black font-mono tracking-wider rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] active:scale-95 transition-all text-base sm:text-lg cursor-pointer"
        >
          <RotateCcw size={20} className="stroke-[3]" />
          <span>새 게임 시작 (RESET)</span>
        </button>
      </div>
    </div>
  );
}
