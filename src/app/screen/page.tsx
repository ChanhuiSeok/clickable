'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Play, RotateCcw, Users, Maximize, Minimize, Trophy, Sparkles, Copy, Check } from 'lucide-react';
import { GameState, Participant, GameControlPayload, ScoreBatchPayload } from '@/types/game';
import { realtime } from '@/lib/realtime';
import { sound } from '@/lib/sound';
import { isSupabaseConfigured } from '@/lib/supabase';
import RankingColumns from '@/components/RankingColumns';
import Podium from '@/components/Podium';
import ConfettiEffect from '@/components/ConfettiEffect';
import SoundToggle from '@/components/SoundToggle';

const COUNTDOWN_SECONDS = 3;
const GAME_DURATION_SECONDS = 20;

export default function ScreenPage() {
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [countdown, setCountdown] = useState<number>(COUNTDOWN_SECONDS);
  const [remainingTime, setRemainingTime] = useState<number>(GAME_DURATION_SECONDS);
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize join URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/`;
      setJoinUrl(url);
    }
  }, []);

  // Initialize Realtime connection
  useEffect(() => {
    realtime.init('screen');

    // Subscribe to presence list updates
    const unsubPresence = realtime.onPresence((userList) => {
      setParticipants((prev) => {
        const existingMap = new Map(prev.map((p) => [p.id, p]));
        return userList
          .filter((u) => u.role !== 'screen')
          .map((u) => {
            const existing = existingMap.get(u.id);
            return {
              id: u.id,
              nickname: u.nickname,
              avatar: u.avatar,
              score: existing?.score ?? u.score ?? 0,
              lastCps: existing?.lastCps ?? u.lastCps ?? 0,
              maxCps: existing?.maxCps ?? u.maxCps ?? 0,
              role: 'student',
              lastActive: u.lastActive || Date.now(),
            };
          });
      });
    });

    // Subscribe to immediate player join broadcasts
    const unsubJoin = realtime.onPlayerJoin((player) => {
      setParticipants((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        if (!map.has(player.id)) {
          map.set(player.id, {
            id: player.id,
            nickname: player.nickname,
            avatar: player.avatar,
            score: 0,
            lastCps: 0,
            maxCps: 0,
            role: 'student',
            lastActive: Date.now(),
          });
        } else {
          const existing = map.get(player.id)!;
          map.set(player.id, {
            ...existing,
            nickname: player.nickname,
            avatar: player.avatar,
            lastActive: Date.now(),
          });
        }
        return Array.from(map.values());
      });
    });

    // Subscribe to score batches
    const unsubScore = realtime.onScoreBatch((batch: ScoreBatchPayload) => {
      setParticipants((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        const existing = map.get(batch.id);

        if (existing) {
          map.set(batch.id, {
            ...existing,
            nickname: batch.nickname || existing.nickname,
            avatar: batch.avatar || existing.avatar,
            score: batch.totalScore,
            lastCps: batch.cps,
            maxCps: Math.max(existing.maxCps || 0, batch.cps),
            lastActive: Date.now(),
          });
        } else {
          map.set(batch.id, {
            id: batch.id,
            nickname: batch.nickname,
            avatar: batch.avatar,
            score: batch.totalScore,
            lastCps: batch.cps,
            maxCps: batch.cps,
            role: 'student',
            lastActive: Date.now(),
          });
        }
        return Array.from(map.values());
      });
    });

    // Cleanup
    return () => {
      unsubPresence();
      unsubJoin();
      unsubScore();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      realtime.disconnect();
    };
  }, []);

  const handleEndGame = useCallback(() => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    setGameState('ended');
    setRemainingTime(0);

    sound.playFinish();

    // Broadcast end event to all students
    const endPayload: GameControlPayload = {
      action: 'end',
    };
    realtime.sendGameControl(endPayload);
  }, []);

  const handleStartGame = useCallback(() => {
    if (gameState !== 'waiting') return;

    // Reset scores for new round
    setParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        score: 0,
        lastCps: 0,
        maxCps: 0,
      }))
    );

    setGameState('countdown');
    setCountdown(COUNTDOWN_SECONDS);
    sound.playCountdownBeep(false);

    // Broadcast countdown to students
    const countdownPayload: GameControlPayload = {
      action: 'countdown',
      countdownSec: COUNTDOWN_SECONDS,
      gameDuration: GAME_DURATION_SECONDS,
    };
    realtime.sendGameControl(countdownPayload);

    let cd = COUNTDOWN_SECONDS;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    countdownTimerRef.current = setInterval(() => {
      cd -= 1;
      if (cd > 0) {
        setCountdown(cd);
        sound.playCountdownBeep(false);
      } else {
        clearInterval(countdownTimerRef.current!);
        setGameState('playing');
        setRemainingTime(GAME_DURATION_SECONDS);
        sound.playCountdownBeep(true);

        const startTime = Date.now();
        const endTime = startTime + GAME_DURATION_SECONDS * 1000;

        // Broadcast game start
        const startPayload: GameControlPayload = {
          action: 'start',
          gameDuration: GAME_DURATION_SECONDS,
          startTime,
          endTime,
        };
        realtime.sendGameControl(startPayload);

        // Start 20s game countdown
        let rem = GAME_DURATION_SECONDS;
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);

        gameTimerRef.current = setInterval(() => {
          rem -= 1;
          setRemainingTime(rem);

          if (rem <= 5 && rem > 0) {
            sound.playCountdownBeep(false);
          }

          if (rem <= 0) {
            handleEndGame();
          }
        }, 1000);
      }
    }, 1000);
  }, [gameState, handleEndGame]);

  const handleResetGame = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);

    setGameState('waiting');
    setCountdown(COUNTDOWN_SECONDS);
    setRemainingTime(GAME_DURATION_SECONDS);

    // Reset scores
    setParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        score: 0,
        lastCps: 0,
        maxCps: 0,
      }))
    );

    // Broadcast reset event to all clients
    realtime.sendGameControl({
      action: 'reset',
    });
  }, []);

  // Keyboard shortcut (Space to start)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameState === 'waiting') {
        e.preventDefault();
        handleStartGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleStartGame]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activePlayers = participants.filter((p) => p.role !== 'screen');

  return (
    <main className="min-h-screen arcade-bg text-slate-100 flex flex-col p-4 sm:p-6 lg:p-8 select-none scanlines">
      {/* Confetti Effect on Game End */}
      <ConfettiEffect active={gameState === 'ended'} />

      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <Trophy className="text-slate-950" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase flex items-center gap-2">
              <span className="neon-text-cyan">CLICK BATTLE</span>
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                20s ARENA
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              실시간 30인 초고속 클릭 배틀 (프로젝터 전용 화면)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isSupabaseConfigured && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/50 border border-amber-600/40 text-amber-300 text-xs font-mono">
              <span>⚡ 데모/로컬 모드 (Supabase 미설정)</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-cyan-400">
            <Users size={14} />
            <span>{activePlayers.length}명 참여 중</span>
          </div>

          <SoundToggle />

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
            title="전체화면 토글"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-start w-full max-w-7xl mx-auto z-10">
        {/* State: WAITING (QR Code + Joined Players) */}
        {gameState === 'waiting' && (
          <div className="w-full flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Box: Large QR Code */}
              <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(15,23,42,0.6)] backdrop-blur-sm">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/80 text-cyan-300 text-xs font-mono mb-4">
                  <Sparkles size={14} />
                  <span>스마트폰 카메라로 찍어 바로 입장!</span>
                </div>

                <div className="p-4 bg-white rounded-2xl shadow-[0_0_30px_rgba(56,189,248,0.3)] mb-5">
                  <QRCodeSVG value={joinUrl || 'http://localhost:3000'} size={210} level="M" />
                </div>

                <div className="w-full flex items-center justify-between gap-2 p-2 px-3 rounded-xl bg-slate-950/80 border border-slate-800 max-w-sm">
                  <span className="text-xs font-mono text-slate-400 truncate select-all">{joinUrl}</span>
                  <button
                    onClick={copyUrl}
                    className="shrink-0 p-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                    title="URL 복사"
                  >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    <span>{copied ? '복사됨' : '복사'}</span>
                  </button>
                </div>
              </div>

              {/* Right Box: Connected Students List */}
              <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col shadow-[0_0_30px_rgba(15,23,42,0.6)] backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-mono text-slate-200">대기실 참가자</h2>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold">
                      {activePlayers.length} / 30명
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono animate-pulse">실시간 접속 감지 중...</span>
                </div>

                {activePlayers.length === 0 ? (
                  <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-800 rounded-2xl p-6 text-center">
                    <Users size={40} className="mb-2 opacity-40" />
                    <p className="text-sm font-medium">아직 입장한 학생이 없습니다.</p>
                    <p className="text-xs text-slate-500 mt-1">좌측 QR코드를 스캔하여 닉네임을 입력하고 대기해주세요!</p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[260px] max-h-[360px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {activePlayers.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/40 transition-colors"
                        >
                          <span className="text-2xl">{player.avatar}</span>
                          <span className="font-bold text-sm text-slate-200 truncate">{player.nickname}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Giant Game Start Button */}
            <div className="flex flex-col items-center justify-center py-4">
              <button
                onClick={handleStartGame}
                className="group relative px-12 sm:px-20 py-5 sm:py-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black font-mono text-2xl sm:text-3xl tracking-widest uppercase shadow-[0_0_40px_rgba(6,182,212,0.5)] hover:shadow-[0_0_60px_rgba(6,182,212,0.8)] active:scale-95 transition-all cursor-pointer flex items-center gap-4"
              >
                <Play className="fill-slate-950 stroke-none group-hover:scale-110 transition-transform" size={32} />
                <span>게임 시작 (SPACE)</span>
              </button>
              <p className="text-xs text-slate-400 font-mono mt-3">
                * [게임 시작]을 누르면 3초 카운트다운 후 20초간 배틀이 시작됩니다.
              </p>
            </div>
          </div>
        )}

        {/* State: COUNTDOWN (3, 2, 1) */}
        {gameState === 'countdown' && (
          <div className="flex-1 min-h-[500px] flex flex-col items-center justify-center text-center">
            <div className="text-xs font-mono tracking-widest text-cyan-400 uppercase mb-4 animate-pulse">
              GET READY! PREPARE YOUR FINGERS
            </div>
            <div className="relative">
              <span className="text-9xl sm:text-[14rem] font-black font-mono text-transparent bg-clip-text bg-gradient-to-b from-cyan-200 via-sky-400 to-indigo-600 drop-shadow-[0_0_50px_rgba(56,189,248,0.8)] animate-in zoom-in-50 duration-300">
                {countdown}
              </span>
            </div>
            <p className="text-lg sm:text-xl font-mono text-slate-300 font-bold mt-4">
              3초 후 20초 배틀이 시작됩니다!
            </p>
          </div>
        )}

        {/* State: PLAYING (Realtime 20s Battle) */}
        {gameState === 'playing' && (
          <div className="w-full flex flex-col gap-5">
            {/* Top Timer Banner */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
                <span className="font-mono font-black text-rose-400 tracking-wider uppercase text-sm sm:text-base">
                  BATTLE IN PROGRESS
                </span>
              </div>

              {/* Large Timer Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono uppercase">TIME LEFT:</span>
                <span
                  className={`text-4xl sm:text-5xl font-mono font-black tracking-tight ${
                    remainingTime <= 5 ? 'text-rose-500 animate-pulse drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]' : 'text-yellow-400'
                  }`}
                >
                  {remainingTime.toString().padStart(2, '0')}s
                </span>
              </div>
            </div>

            {/* Realtime 1~30 Ranking Board (2 columns) */}
            <RankingColumns participants={participants} isGameOver={false} />
          </div>
        )}

        {/* State: ENDED (Podium & Reset) */}
        {gameState === 'ended' && (
          <div className="w-full flex flex-col gap-6">
            <Podium participants={participants} onReset={handleResetGame} />

            <div className="mt-4">
              <h3 className="text-sm font-mono text-slate-400 uppercase tracking-wider mb-3 px-1">
                전체 참가자 최종 순위표 (TOP 30)
              </h3>
              <RankingColumns participants={participants} isGameOver={true} />
            </div>
          </div>
        )}
      </div>

      {/* Screen Footer */}
      <footer className="mt-8 pt-4 border-t border-slate-900 text-center text-xs font-mono text-slate-600 flex items-center justify-between">
        <span>Click Battle 20s &bull; High School Edition</span>
        <span>Powered by Next.js &amp; Supabase Realtime</span>
      </footer>
    </main>
  );
}
