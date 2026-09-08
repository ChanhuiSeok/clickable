'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Zap, Flame, ShieldAlert, Sparkles, CheckCircle, Volume2, VolumeX, Smartphone, ExternalLink, MonitorPlay } from 'lucide-react';
import { GameState, Participant, GameControlPayload, ScoreBatchPayload } from '@/types/game';
import { realtime } from '@/lib/realtime';
import { sound } from '@/lib/sound';

const AVATARS = ['⚡', '🔥', '🚀', '🐱', '👾', '👑', '🥊', '🎯', '🦁', '🦊', '⭐', '💣'];
const BATCH_INTERVAL_MS = 200;
const MAX_ALLOWED_CPS = 70; // 70 clicks per second anti-cheat threshold

export default function StudentPage() {
  const [nickname, setNickname] = useState<string>('');
  const [avatar, setAvatar] = useState<string>('⚡');
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [countdown, setCountdown] = useState<number>(3);
  const [remainingTime, setRemainingTime] = useState<number>(20);

  // Gameplay local state
  const [localClicks, setLocalClicks] = useState<number>(0);
  const [currentCps, setCurrentCps] = useState<number>(0);
  const [cheatWarning, setCheatWarning] = useState<string | null>(null);
  const [tapParticles, setTapParticles] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const [soundOn, setSoundOn] = useState<boolean>(true);

  // Internal references for batching & anti-cheat
  const userIdRef = useRef<string>('');
  const pendingClicksRef = useRef<number>(0);
  const totalVerifiedClicksRef = useRef<number>(0);
  const lastBatchTimeRef = useRef<number>(Date.now());
  const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clientTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or restore saved nickname & clientId per tab session
  useEffect(() => {
    let savedId = sessionStorage.getItem('click_battle_uid');
    if (!savedId) {
      savedId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('click_battle_uid', savedId);
    }
    userIdRef.current = savedId;

    const savedNick = sessionStorage.getItem('click_battle_nick') || localStorage.getItem('click_battle_nick');
    if (savedNick) setNickname(savedNick);

    const savedAvatar = sessionStorage.getItem('click_battle_avatar') || localStorage.getItem('click_battle_avatar');
    if (savedAvatar) setAvatar(savedAvatar);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
      if (clientTimerRef.current) clearInterval(clientTimerRef.current);
      realtime.disconnect();
    };
  }, []);

  // Start 200ms batch dispatch loop
  const startBatchingLoop = useCallback(() => {
    if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
    lastBatchTimeRef.current = Date.now();

    batchIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSec = (now - lastBatchTimeRef.current) / 1000;
      lastBatchTimeRef.current = now;

      const added = pendingClicksRef.current;
      pendingClicksRef.current = 0;

      if (added === 0) {
        setCurrentCps(0);
        return;
      }

      // Anti-cheat verification: Check if CPS exceeds 70
      const instantCps = Math.round(added / (elapsedSec || 0.2));
      setCurrentCps(instantCps);

      if (instantCps > MAX_ALLOWED_CPS) {
        // Abnormal clicking detected! Ignore batch as requested
        setCheatWarning(`⚠️ 비정상 연타 감지 (${instantCps} CPS)! 매크로 방지로 무효 처리됩니다.`);
        setTimeout(() => setCheatWarning(null), 1800);
        return;
      }

      // Valid batch -> update total
      totalVerifiedClicksRef.current += added;
      const total = totalVerifiedClicksRef.current;
      setLocalClicks(total);

      // Broadcast score batch to projector screen and others
      const batchPayload: ScoreBatchPayload = {
        id: userIdRef.current,
        nickname: nickname.trim() || '익명',
        avatar,
        addedClicks: added,
        totalScore: total,
        cps: instantCps,
        timestamp: now,
      };
      realtime.sendScoreBatch(batchPayload);
    }, BATCH_INTERVAL_MS);
  }, [nickname, avatar]);

  // Handle joining the room
  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nickname.trim()) return;

    sessionStorage.setItem('click_battle_nick', nickname.trim());
    sessionStorage.setItem('click_battle_avatar', avatar);

    setIsJoined(true);

    const userObj: Partial<Participant> = {
      id: userIdRef.current,
      nickname: nickname.trim(),
      avatar,
      score: 0,
      lastCps: 0,
    };

    realtime.init('student', userObj);

    // Listen to Game Control broadcasts from Screen
    realtime.onGameControl((payload: GameControlPayload) => {
      if (payload.action === 'countdown') {
        setGameState('countdown');
        setCountdown(payload.countdownSec || 3);
        setLocalClicks(0);
        totalVerifiedClicksRef.current = 0;
        pendingClicksRef.current = 0;
        sound.playCountdownBeep(false);

        // Run local countdown ticker
        let cd = payload.countdownSec || 3;
        const cdInt = setInterval(() => {
          cd -= 1;
          if (cd > 0) {
            setCountdown(cd);
            sound.playCountdownBeep(false);
          } else {
            clearInterval(cdInt);
          }
        }, 1000);
      } else if (payload.action === 'start') {
        setGameState('playing');
        setRemainingTime(payload.gameDuration || 20);
        setLocalClicks(0);
        totalVerifiedClicksRef.current = 0;
        pendingClicksRef.current = 0;
        sound.playCountdownBeep(true);

        // Start 200ms batch transmission
        startBatchingLoop();

        // Local game timer display
        let rem = payload.gameDuration || 20;
        if (clientTimerRef.current) clearInterval(clientTimerRef.current);
        clientTimerRef.current = setInterval(() => {
          rem -= 1;
          setRemainingTime(rem);
          if (rem <= 0) {
            clearInterval(clientTimerRef.current!);
          }
        }, 1000);
      } else if (payload.action === 'end') {
        setGameState('ended');
        if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
        if (clientTimerRef.current) clearInterval(clientTimerRef.current);
        sound.playFinish();
      } else if (payload.action === 'reset') {
        setGameState('waiting');
        setLocalClicks(0);
        totalVerifiedClicksRef.current = 0;
        pendingClicksRef.current = 0;
        if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
        if (clientTimerRef.current) clearInterval(clientTimerRef.current);
      }
    });
  };

  // Main Click Handler (High-performance, haptic feedback)
  const handleTap = (e: React.TouchEvent | React.MouseEvent) => {
    if (gameState !== 'playing') return;

    // Prevent default scrolling / zooming
    e.preventDefault();

    // Haptic vibration feedback
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(12);
    }

    // Audio beep with slight pitch ramp
    if (soundOn) {
      sound.playClick(1.0 + Math.min(1.5, pendingClicksRef.current * 0.05));
    }

    // Increment pending clicks for next 200ms batch
    pendingClicksRef.current += 1;
    setLocalClicks((prev) => prev + 1);

    // Tap Particle visual effect
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let clientX = rect.left + rect.width / 2;
    let clientY = rect.top + rect.height / 2;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    const pId = Date.now() + Math.random();
    setTapParticles((prev) => [
      ...prev.slice(-12),
      {
        id: pId,
        x: clientX - rect.left,
        y: clientY - rect.top,
        text: `+1`,
      },
    ]);

    setTimeout(() => {
      setTapParticles((prev) => prev.filter((p) => p.id !== pId));
    }, 450);
  };

  const toggleSound = () => {
    sound.enabled = !soundOn;
    setSoundOn(!soundOn);
  };

  return (
    <main className="min-h-screen arcade-bg text-slate-100 flex flex-col items-center justify-between p-4 select-none touch-manipulation">
      {/* Top Header */}
      <header className="w-full max-w-md flex items-center justify-between py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-xl">{avatar}</span>
          <div>
            <div className="font-bold text-sm tracking-wide text-cyan-300">
              {isJoined ? nickname : '20초 클릭 배틀'}
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              {isJoined ? '온라인 참가 중' : '고등학생 40인 배틀'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300"
            title="소리 토글"
          >
            {soundOn ? <Volume2 size={16} className="text-cyan-400" /> : <VolumeX size={16} className="text-slate-500" />}
          </button>

          {isJoined && (
            <div className="px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-600/40 text-emerald-400 text-xs font-mono flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>연결됨</span>
            </div>
          )}
        </div>
      </header>

      {/* Screen 1: NICKNAME & AVATAR INPUT FORM */}
      {!isJoined && (
        <div className="w-full max-w-md flex-1 flex flex-col justify-center py-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] mb-3">
                <Smartphone size={28} />
              </div>
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-400">
                배틀 참가 등록
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-1">
                20초 동안 가장 많은 클릭을 달성하세요!
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-5">
              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-2">아바타 선택</label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatar(emoji)}
                      className={`h-11 rounded-xl text-xl flex items-center justify-center transition-all ${
                        avatar === emoji
                          ? 'bg-cyan-500/30 border-2 border-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.5)] scale-105'
                          : 'bg-slate-800/60 border border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nickname Input */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  닉네임 (2~10자)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="예: 클릭의신, 번개손"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-bold transition-all text-base"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!nickname.trim()}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-slate-950 font-black font-mono tracking-wider uppercase text-lg shadow-[0_0_25px_rgba(6,182,212,0.4)] active:scale-95 transition-all cursor-pointer"
              >
                배틀 입장하기
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-800 text-center">
              <Link
                href="/screen"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
              >
                <MonitorPlay size={14} />
                <span>발표자이신가요? 프로젝터 화면 열기 (/screen)</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: WAITING ROOM */}
      {isJoined && gameState === 'waiting' && (
        <div className="w-full max-w-md flex-1 flex flex-col justify-center items-center text-center py-8">
          <div className="w-24 h-24 rounded-3xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-center text-5xl mb-6 shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-bounce">
            {avatar}
          </div>

          <h2 className="text-2xl font-black text-white mb-2">
            <span className="text-cyan-400">{nickname}</span>님 준비 완료!
          </h2>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-950/50 border border-cyan-800 text-cyan-300 font-mono text-xs mb-6">
            <Sparkles size={14} className="animate-spin" />
            <span>발표자가 게임을 시작할 때까지 대기 중...</span>
          </div>

          <div className="w-full p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs font-mono space-y-2 mb-4">
            <div className="flex items-center gap-2 text-slate-300 font-bold">
              <CheckCircle size={15} className="text-cyan-400" />
              <span>플레이 팁</span>
            </div>
            <p className="text-left text-slate-400 leading-relaxed">
              &bull; 시작 신호와 함께 대형 버튼이 나타납니다.<br />
              &bull; 양손 두 손가락으로 번갈아 누르면 고득점 가능!<br />
              &bull; 20초 동안 끊임없이 연타하세요!
            </p>
          </div>

          {/* Direct link for host if they opened student view */}
          <Link
            href="/screen"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-mono flex items-center justify-center gap-1.5 transition-all"
          >
            <MonitorPlay size={15} />
            <span>발표자이신가요? 발표자/프로젝터 화면으로 이동 (/screen)</span>
          </Link>
        </div>
      )}

      {/* Screen 3: COUNTDOWN */}
      {isJoined && gameState === 'countdown' && (
        <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-xs font-mono text-yellow-400 uppercase tracking-widest mb-3 animate-pulse">
            GET READY!
          </div>
          <div className="text-9xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-yellow-600 drop-shadow-[0_0_40px_rgba(250,204,21,0.6)] animate-in zoom-in-50 duration-300">
            {countdown}
          </div>
          <div className="text-slate-400 font-mono text-sm mt-4">
            손가락을 화면 위에 올려두세요!
          </div>
        </div>
      )}

      {/* Screen 4: 20s ACTIVE CLICKING BATTLE */}
      {isJoined && gameState === 'playing' && (
        <div className="w-full max-w-md flex-1 flex flex-col justify-between items-center py-2">
          {/* Realtime Stats Bar */}
          <div className="w-full flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-md">
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase">TIME LEFT</div>
              <div
                className={`text-2xl font-black font-mono tracking-tight ${
                  remainingTime <= 5 ? 'text-rose-500 animate-pulse' : 'text-yellow-400'
                }`}
              >
                {remainingTime}s
              </div>
            </div>

            <div className="text-center">
              <div className="text-[10px] font-mono text-slate-500 uppercase">SPEED</div>
              <div className="text-xl font-bold font-mono text-cyan-400 flex items-center justify-center gap-0.5">
                <Zap size={16} />
                <span>{currentCps} CPS</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-mono text-slate-500 uppercase">TOTAL CLICKS</div>
              <div className="text-2xl font-black font-mono text-white">
                {localClicks}
              </div>
            </div>
          </div>

          {/* Anti-cheat Warning Toast */}
          {cheatWarning && (
            <div className="w-full mt-2 p-2 rounded-xl bg-rose-950/90 border border-rose-600/80 text-rose-200 text-xs font-mono text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
              <ShieldAlert size={16} className="text-rose-400" />
              <span>{cheatWarning}</span>
            </div>
          )}

          {/* Giant Click Battle Touch Target */}
          <div className="w-full flex-1 flex flex-col items-center justify-center my-4">
            <button
              onTouchStart={handleTap}
              onMouseDown={handleTap}
              className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-gradient-to-b from-cyan-400 via-sky-500 to-indigo-700 p-2 shadow-[0_0_50px_rgba(6,182,212,0.5)] active:scale-90 active:brightness-125 transition-transform duration-75 cursor-pointer flex flex-col items-center justify-center overflow-hidden active-press select-none"
              style={{ touchAction: 'manipulation' }}
              aria-label="클릭 버튼"
            >
              {/* Inner ring */}
              <div className="w-full h-full rounded-full bg-slate-950/40 border-4 border-white/30 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-5xl sm:text-6xl mb-1 select-none pointer-events-none drop-shadow-md">
                  👊
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-white uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] pointer-events-none">
                  TAP!
                </span>
                <span className="text-xs font-mono text-cyan-200 font-bold mt-1 pointer-events-none">
                  연타하세요!
                </span>
              </div>

              {/* Floating Tap Particles */}
              {tapParticles.map((particle) => (
                <span
                  key={particle.id}
                  className="absolute pointer-events-none font-mono font-black text-xl text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)] animate-out fade-out slide-out-to-top-8 duration-500"
                  style={{ left: particle.x, top: particle.y }}
                >
                  {particle.text}
                </span>
              ))}
            </button>
          </div>

          <div className="text-xs font-mono text-slate-500 text-center">
            * 터치할 때마다 햅틱 피드백이 전송됩니다.
          </div>
        </div>
      )}

      {/* Screen 5: GAME OVER / RESULT VIEW */}
      {isJoined && gameState === 'ended' && (
        <div className="w-full max-w-md flex-1 flex flex-col justify-center items-center text-center py-6">
          <div className="w-full bg-slate-900/90 border border-yellow-500/40 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-3xl mb-3">
              🏆
            </div>

            <h2 className="text-2xl font-black text-yellow-400 mb-1">배틀 종료!</h2>
            <p className="text-xs text-slate-400 font-mono mb-6">
              20초 클릭 배틀이 모두 끝났습니다.
            </p>

            {/* Score Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 mb-6">
              <div>
                <div className="text-xs font-mono text-slate-500">내 최종 클릭 수</div>
                <div className="text-4xl font-black font-mono text-cyan-400 mt-1">
                  {localClicks.toLocaleString()}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-around text-xs font-mono">
                <div>
                  <span className="text-slate-500 block">플레이어</span>
                  <span className="font-bold text-white">{avatar} {nickname}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">최종 CPS</span>
                  <span className="font-bold text-cyan-300">{currentCps} CPS</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-400">
              📺 프로젝터 화면에서 1~40등 최종 순위와 시상식을 확인하세요!
            </div>
          </div>
        </div>
      )}

      {/* Mobile Footer */}
      <footer className="w-full max-w-md text-center py-2 text-[11px] font-mono text-slate-600">
        Click Battle &bull; 학생용 모바일 클라이언트
      </footer>
    </main>
  );
}
