'use client';

import React from 'react';
import { Participant } from '@/types/game';
import RankCard from './RankCard';

interface RankingColumnsProps {
  participants: Participant[];
  isGameOver?: boolean;
}

export default function RankingColumns({ participants, isGameOver }: RankingColumnsProps) {
  // Sort participants by score descending, then by lastCps descending
  const sorted = [...participants].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (b.lastCps || 0) - (a.lastCps || 0);
  });

  const maxScore = sorted.length > 0 ? Math.max(sorted[0].score, 1) : 1;

  // Split into 2 columns: Rank 1-20 (Champion) and Rank 21-40 (Challenger)
  const column1 = sorted.slice(0, 20);
  const column2 = sorted.slice(20, 40);

  // Dynamic placeholder slots: at least 10 slots each, up to 20 slots
  const col1TargetSlots = Math.min(20, Math.max(10, column1.length + (column1.length < 20 ? 1 : 0)));
  const col2TargetSlots = column2.length > 0 ? Math.min(20, Math.max(10, column2.length + (column2.length < 20 ? 1 : 0))) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
      {/* Column 1: Rank 1 to 20 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono font-bold text-cyan-400 px-2 py-1 bg-cyan-950/30 border-l-2 border-cyan-500 rounded">
          <span>RANK 01 - 20</span>
          <span>CHAMPION BRACKET</span>
        </div>
        <div className="flex flex-col gap-2">
          {column1.map((p, idx) => (
            <RankCard
              key={p.id}
              participant={p}
              rank={idx + 1}
              maxScore={maxScore}
              isGameOver={isGameOver}
            />
          ))}

          {/* Empty placeholders for waiting participants */}
          {column1.length < col1TargetSlots &&
            Array.from({ length: col1TargetSlots - column1.length }).map((_, idx) => {
              const rank = column1.length + idx + 1;
              return (
                <div
                  key={`empty-col1-${idx}`}
                  className="rounded-xl border border-dashed border-slate-800/80 bg-slate-950/30 p-2.5 flex items-center justify-between opacity-35"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-slate-600">
                      {rank}
                    </span>
                    <span className="text-xs text-slate-600 font-mono">참가 대기 중...</span>
                  </div>
                  <span className="text-xs font-mono text-slate-700">-</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Column 2: Rank 21 to 40 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono font-bold text-indigo-400 px-2 py-1 bg-indigo-950/30 border-l-2 border-indigo-500 rounded">
          <span>RANK 21 - 40</span>
          <span>CHALLENGER BRACKET</span>
        </div>
        <div className="flex flex-col gap-2">
          {column2.map((p, idx) => (
            <RankCard
              key={p.id}
              participant={p}
              rank={idx + 21}
              maxScore={maxScore}
              isGameOver={isGameOver}
            />
          ))}

          {/* Empty placeholders if column 2 is used or participants > 20 */}
          {column2.length < col2TargetSlots &&
            Array.from({ length: col2TargetSlots - column2.length }).map((_, idx) => {
              const rank = 20 + column2.length + idx + 1;
              return (
                <div
                  key={`empty-col2-${idx}`}
                  className="rounded-xl border border-dashed border-slate-800/80 bg-slate-950/30 p-2.5 flex items-center justify-between opacity-35"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-slate-600">
                      {rank}
                    </span>
                    <span className="text-xs text-slate-600 font-mono">참가 대기 중...</span>
                  </div>
                  <span className="text-xs font-mono text-slate-700">-</span>
                </div>
              );
            })}

          {column2.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800/60 bg-slate-950/20 p-6 flex flex-col items-center justify-center text-slate-600 text-xs font-mono">
              <span>21등 ~ 40등 도전자 슬롯</span>
              <span className="text-[10px] text-slate-700 mt-1">참가자가 20명을 넘으면 활성화됩니다.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
