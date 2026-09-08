import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { GameControlPayload, ScoreBatchPayload, Participant, PlayerJoinPayload, PlayerLeavePayload } from '@/types/game';

type GameControlCallback = (payload: GameControlPayload) => void;
type ScoreBatchCallback = (payload: ScoreBatchPayload) => void;
type PresenceCallback = (participants: Participant[]) => void;
type PlayerJoinCallback = (payload: PlayerJoinPayload) => void;
type PlayerLeaveCallback = (payload: PlayerLeavePayload) => void;

const ROOM_NAME = 'click_battle_lobby';
const LOCAL_CHANNEL_NAME = 'click_battle_local_channel';
const INACTIVITY_TIMEOUT_MS = 2500; // 2.5초 이상 무응답 시 즉시 퇴장 처리 (3초 이내 반영)
const HEARTBEAT_INTERVAL_MS = 1000; // 1초 주기로 하트비트 전송

class BattleRealtimeClient {
  private channel: RealtimeChannel | null = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private gameControlListeners: Set<GameControlCallback> = new Set();
  private scoreBatchListeners: Set<ScoreBatchCallback> = new Set();
  private presenceListeners: Set<PresenceCallback> = new Set();
  private playerJoinListeners: Set<PlayerJoinCallback> = new Set();
  private playerLeaveListeners: Set<PlayerLeaveCallback> = new Set();
  private currentPresence: Map<string, Participant> = new Map();
  public isConnected: boolean = false;
  private role: 'screen' | 'student' = 'student';
  private currentUser: Participant | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  init(role: 'screen' | 'student', user?: Partial<Participant>) {
    this.role = role;
    if (user && user.id) {
      this.currentUser = {
        id: user.id,
        nickname: user.nickname || '익명',
        avatar: user.avatar || '⚡',
        score: user.score || 0,
        lastCps: 0,
        maxCps: 0,
        role: 'student',
        lastActive: Date.now(),
      };
      // Register self in current presence
      this.currentPresence.set(user.id, this.currentUser);
    }

    const supabase = getSupabaseClient();

    if (supabase && isSupabaseConfigured) {
      this.setupSupabaseChannel(supabase);
    } else {
      this.setupLocalChannel();
    }

    this.startHeartbeat();

    // If student just joined, broadcast join event
    if (role === 'student' && this.currentUser) {
      this.sendPlayerJoin({
        id: this.currentUser.id,
        nickname: this.currentUser.nickname,
        avatar: this.currentUser.avatar,
      });
    }
  }

  private handleIncomingPlayer(p: Partial<Participant>) {
    if (!p || !p.id) return;
    const existing = this.currentPresence.get(p.id);
    const updated: Participant = {
      id: p.id,
      nickname: p.nickname || existing?.nickname || '익명',
      avatar: p.avatar || existing?.avatar || '⚡',
      score: p.score ?? existing?.score ?? 0,
      lastCps: p.lastCps ?? existing?.lastCps ?? 0,
      maxCps: p.maxCps ?? existing?.maxCps ?? 0,
      role: 'student',
      lastActive: Date.now(),
    };
    this.currentPresence.set(p.id, updated);
    this.notifyPresence();
  }

  private handleLeavingPlayer(id: string) {
    if (!id) return;
    if (this.currentPresence.has(id)) {
      this.currentPresence.delete(id);
      this.notifyPresence();
    }
  }

  private setupSupabaseChannel(supabase: ReturnType<typeof getSupabaseClient>) {
    if (!supabase) return;

    this.channel = supabase.channel(ROOM_NAME, {
      config: {
        broadcast: { ack: false, self: true },
        presence: { key: this.currentUser?.id || `screen_${Date.now()}` },
      },
    });

    this.channel
      .on('broadcast', { event: 'game_control' }, ({ payload }) => {
        this.gameControlListeners.forEach((fn) => fn(payload as GameControlPayload));
      })
      .on('broadcast', { event: 'score_batch' }, ({ payload }) => {
        const batch = payload as ScoreBatchPayload;
        if (batch && batch.id) {
          this.handleIncomingPlayer({
            id: batch.id,
            nickname: batch.nickname,
            avatar: batch.avatar,
            score: batch.totalScore,
            lastCps: batch.cps,
          });
        }
        this.scoreBatchListeners.forEach((fn) => fn(batch));
      })
      .on('broadcast', { event: 'player_join' }, ({ payload }) => {
        const joinData = payload as PlayerJoinPayload;
        this.handleIncomingPlayer(joinData);
        this.playerJoinListeners.forEach((fn) => fn(joinData));
      })
      .on('broadcast', { event: 'player_leave' }, ({ payload }) => {
        const leaveData = payload as PlayerLeavePayload;
        if (leaveData && leaveData.id) {
          this.handleLeavingPlayer(leaveData.id);
          this.playerLeaveListeners.forEach((fn) => fn(leaveData));
        }
      })
      .on('broadcast', { event: 'player_heartbeat' }, ({ payload }) => {
        this.handleIncomingPlayer(payload as Participant);
      })
      .on('broadcast', { event: 'presence_request' }, () => {
        if (this.currentUser && this.role === 'student') {
          this.sendPlayerJoin({
            id: this.currentUser.id,
            nickname: this.currentUser.nickname,
            avatar: this.currentUser.avatar,
          });
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel?.presenceState() || {};
        Object.values(state).forEach((presences) => {
          (presences as unknown as Participant[]).forEach((p) => {
            if (p && p.id && p.role === 'student') {
              this.handleIncomingPlayer(p);
            }
          });
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        let changed = false;
        (leftPresences as unknown as Participant[]).forEach((p) => {
          if (p && p.id && this.currentPresence.has(p.id)) {
            this.currentPresence.delete(p.id);
            changed = true;
          }
        });
        if (changed) {
          this.notifyPresence();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          if (this.currentUser && this.role === 'student') {
            this.channel?.track({
              ...this.currentUser,
              role: 'student',
            });
          }
          if (this.role === 'screen') {
            this.channel?.send({
              type: 'broadcast',
              event: 'presence_request',
              payload: {},
            });
          }
        }
      });
  }

  private setupLocalChannel() {
    if (typeof window === 'undefined') return;

    try {
      this.localBroadcastChannel = new BroadcastChannel(LOCAL_CHANNEL_NAME);
      this.localBroadcastChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};

        if (type === 'game_control') {
          this.gameControlListeners.forEach((fn) => fn(payload));
        } else if (type === 'score_batch') {
          const batch = payload as ScoreBatchPayload;
          if (batch && batch.id) {
            this.handleIncomingPlayer({
              id: batch.id,
              nickname: batch.nickname,
              avatar: batch.avatar,
              score: batch.totalScore,
              lastCps: batch.cps,
            });
          }
          this.scoreBatchListeners.forEach((fn) => fn(batch));
        } else if (type === 'player_join') {
          const joinData = payload as PlayerJoinPayload;
          this.handleIncomingPlayer(joinData);
          this.playerJoinListeners.forEach((fn) => fn(joinData));
        } else if (type === 'player_leave') {
          const leaveData = payload as PlayerLeavePayload;
          if (leaveData && leaveData.id) {
            this.handleLeavingPlayer(leaveData.id);
            this.playerLeaveListeners.forEach((fn) => fn(leaveData));
          }
        } else if (type === 'player_heartbeat') {
          this.handleIncomingPlayer(payload as Participant);
        } else if (type === 'presence_request') {
          // A screen requested presence, send my profile if I am a student
          if (this.currentUser && this.role === 'student') {
            this.sendLocal('player_join', {
              id: this.currentUser.id,
              nickname: this.currentUser.nickname,
              avatar: this.currentUser.avatar,
            });
          }
        }
      };

      this.isConnected = true;

      // Ask others for presence
      if (this.role === 'screen') {
        this.sendLocal('presence_request', {});
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment', e);
    }
  }

  private sendLocal(type: string, payload: unknown) {
    try {
      this.localBroadcastChannel?.postMessage({ type, payload });
    } catch {}
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(() => {
      if (this.currentUser && this.role === 'student') {
        if (this.channel && isSupabaseConfigured) {
          this.channel.send({
            type: 'broadcast',
            event: 'player_heartbeat',
            payload: this.currentUser,
          });
        } else {
          this.sendLocal('player_heartbeat', this.currentUser);
        }
      }

      // Cleanup inactive players after INACTIVITY_TIMEOUT_MS (2.5초) -> 3초 이내 확실히 반영
      const now = Date.now();
      let changed = false;
      this.currentPresence.forEach((p, id) => {
        if (now - (p.lastActive || 0) > INACTIVITY_TIMEOUT_MS) {
          this.currentPresence.delete(id);
          changed = true;
        }
      });
      if (changed) {
        this.notifyPresence();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private notifyPresence() {
    const list = Array.from(this.currentPresence.values());
    this.presenceListeners.forEach((fn) => fn(list));
  }

  onGameControl(callback: GameControlCallback) {
    this.gameControlListeners.add(callback);
    return () => this.gameControlListeners.delete(callback);
  }

  sendGameControl(payload: GameControlPayload) {
    this.gameControlListeners.forEach((fn) => fn(payload));

    if (this.channel && isSupabaseConfigured) {
      this.channel.send({
        type: 'broadcast',
        event: 'game_control',
        payload,
      });
    } else {
      this.sendLocal('game_control', payload);
    }
  }

  onScoreBatch(callback: ScoreBatchCallback) {
    this.scoreBatchListeners.add(callback);
    return () => this.scoreBatchListeners.delete(callback);
  }

  sendScoreBatch(payload: ScoreBatchPayload) {
    if (this.currentUser) {
      this.currentUser.score = payload.totalScore;
      this.currentUser.lastCps = payload.cps;
      this.currentUser.lastActive = Date.now();
    }

    if (this.channel && isSupabaseConfigured) {
      this.channel.send({
        type: 'broadcast',
        event: 'score_batch',
        payload,
      });
    } else {
      this.sendLocal('score_batch', payload);
    }
  }

  sendPlayerJoin(payload: PlayerJoinPayload) {
    if (this.channel && isSupabaseConfigured) {
      this.channel.send({
        type: 'broadcast',
        event: 'player_join',
        payload,
      });
    } else {
      this.sendLocal('player_join', payload);
    }
  }

  onPlayerJoin(callback: PlayerJoinCallback) {
    this.playerJoinListeners.add(callback);
    return () => this.playerJoinListeners.delete(callback);
  }

  sendPlayerLeave(payload: PlayerLeavePayload) {
    this.handleLeavingPlayer(payload.id);
    if (this.channel && isSupabaseConfigured) {
      this.channel.send({
        type: 'broadcast',
        event: 'player_leave',
        payload,
      });
      try {
        this.channel.untrack();
      } catch {}
    } else {
      this.sendLocal('player_leave', payload);
    }
  }

  onPlayerLeave(callback: PlayerLeaveCallback) {
    this.playerLeaveListeners.add(callback);
    return () => this.playerLeaveListeners.delete(callback);
  }

  onPresence(callback: PresenceCallback) {
    this.presenceListeners.add(callback);
    callback(Array.from(this.currentPresence.values()));
    return () => this.presenceListeners.delete(callback);
  }

  disconnect() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.currentUser && this.role === 'student') {
      this.sendPlayerLeave({ id: this.currentUser.id });
    }
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.localBroadcastChannel) {
      this.localBroadcastChannel.close();
      this.localBroadcastChannel = null;
    }
    this.gameControlListeners.clear();
    this.scoreBatchListeners.clear();
    this.presenceListeners.clear();
    this.playerJoinListeners.clear();
    this.playerLeaveListeners.clear();
    this.currentPresence.clear();
  }
}

export const realtime = new BattleRealtimeClient();
