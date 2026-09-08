'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { sound } from '@/lib/sound';

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(sound.enabled);
  }, []);

  const toggle = () => {
    sound.enabled = !enabled;
    setEnabled(!enabled);
    if (!enabled) {
      sound.playClick(1.5);
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-all text-xs font-mono shadow-md backdrop-blur-sm"
      title={enabled ? '사운드 끄기' : '사운드 켜기'}
      aria-label="Toggle Sound"
    >
      {enabled ? <Volume2 size={16} className="text-cyan-400" /> : <VolumeX size={16} className="text-slate-500" />}
      <span>{enabled ? 'BGM ON' : 'MUTE'}</span>
    </button>
  );
}
