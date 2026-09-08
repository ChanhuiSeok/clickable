'use client';

import React from 'react';
import { Crown, Flame, Zap } from 'lucide-react';
import { Participant } from '@/types/game';

interface RankCardProps {
  participant: Participant;
  rank: number;
  maxScore: number;
  isGameOver?: boolean;
}

export default function RankCard({ participant, rank, maxScore, isGameOver }: RankCardProps) {
  const percentage = maxScore > 0 ? Math.min(100, Math.round((participant.score / maxScore) * 100)) : 0;

  // Rank-specific styles
  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const isThird = rank === 3;
  const isTop3 = isFirst || isSecond || isThird;

  let rankBg = 'bg-slate-900/60 border-slate-800 text-slate-300';
  let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';
  let gaugeColor = 'bg-cyan-500';

  if (isFirst) {
    rankBg = 'bg-yellow-950/40 border-yellow-500/60 shadow-[0_0_15px_rgba(234,179,8,0.25)]';
    badgeColor = 'bg-yellow-500 text-slate-950 font-black border-yellow-300 shadow-sm';
    gaugeColor = 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500';
  } else if (isSecond) {
    rankBg = 'bg-slate-800/60 border-slate-400/60 shadow-[0_0_12px_rgba(148,163,184,0.2)]';
    badgeColor = 'bg-slate-300 text-slate-950 font-black border-slate-200';
    gaugeColor = 'bg-gradient-to-r from-slate-300 to-slate-100';
  } else if (isThird) {
    rankBg = 'bg-amber-950/30 border-amber-600/50 shadow-[0_0_10px_rgba(217,119,6,0.2)]';
    badgeColor = 'bg-amber-600 text-white font-bold border-amber-400';
    gaugeColor = 'bg-gradient-to-r from-amber-500 to-orange-400';
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-2.5 transition-all duration-300 flex items-center justify-between gap-3 ${rankBg} ${
        isTop3 && isGameOver ? 'scale-[1.02] ring-2 ring-yellow-400/40' : ''
      }`}
    >
      {/* Dynamic Background Progress Bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 opacity-15 transition-all duration-300 pointer-events-none ${gaugeColor}`}
        style={{ width: `${percentage}%` }}
      />

      {/* Left: Rank & Avatar & Nickname */}
      <div className="flex items-center gap-2.5 min-w-0 z-10">
        <div
          className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-mono font-bold border ${badgeColor}`}
        >
          {isFirst ? <Crown size={15} className="text-slate-950" /> : rank}
        </div>

        <div className="text-xl shrink-0 select-none">{participant.avatar}</div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-bold truncate text-sm tracking-wide ${
                isFirst
                  ? 'text-yellow-300 font-extrabold'
                  : isSecond
                  ? 'text-slate-100'
                  : isThird
                  ? 'text-amber-200'
                  : 'text-slate-200'
              }`}
            >
              {participant.nickname}
            </span>
            {participant.lastCps >= 15 && (
              <span title={`${participant.lastCps} CPS!`} className="shrink-0 flex items-center text-rose-500 animate-pulse">
                <Flame size={14} className="fill-rose-500" />
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <Zap size={10} className="text-cyan-400" />
              {participant.lastCps || 0} CPS
            </span>
          </div>
        </div>
      </div>

      {/* Right: Score Counter */}
      <div className="text-right shrink-0 z-10">
        <div
          className={`font-black font-mono tracking-tight text-lg sm:text-xl ${
            isFirst
              ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
              : isSecond
              ? 'text-slate-200'
              : isThird
              ? 'text-amber-400'
              : 'text-cyan-300'
          }`}
        >
          {participant.score.toLocaleString()}
        </div>
        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">CLICKS</div>
      </div>
    </div>
  );
}
