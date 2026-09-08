import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { GameControlPayload, ScoreBatchPayload, Participant } from '@/types/game';

type GameControlCallback = (payload: GameControlPayload) => void;
type ScoreBatchCallback = (payload: ScoreBatchPayload) => void;
type PresenceCallback = (participants: Participant[]) => void;

const ROOM_NAME = 'click_battle_lobby';
const LOCAL_CHANNEL_NAME = 'click_battle_local_channel';

class BattleRealtimeClient {
  private channel: RealtimeChannel | null = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private gameControlListeners: Set<GameControlCallback> = new Set();
  private scoreBatchListeners: Set<ScoreBatchCallback> = new Set();
  private presenceListeners: Set<PresenceCallback> = new Set();
  private currentPresence: Map<string, Participant> = new Map();
  private isConnected: boolean = false;
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
        lastActive: Date.now(),
      };
    }

    const supabase = getSupabaseClient();

    if (supabase && isSupabaseConfigured) {
      this.setupSupabaseChannel(supabase);
    } else {
      this.setupLocalChannel();
    }

    this.startHeartbeat();
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
        this.scoreBatchListeners.forEach((fn) => fn(payload as ScoreBatchPayload));
      })
      .on('broadcast', { event: 'player_heartbeat' }, ({ payload }) => {
        const p = payload as Participant;
        if (p && p.id) {
          this.currentPresence.set(p.id, { ...p, lastActive: Date.now() });
          this.notifyPresence();
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel?.presenceState() || {};
        const participants: Participant[] = [];
        Object.values(state).forEach((presences) => {
          (presences as unknown as Participant[]).forEach((p) => {
            if (p && p.id && p.role === 'student') {
              participants.push(p);
              this.currentPresence.set(p.id, p);
            }
          });
        });
        this.notifyPresence();
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
          this.scoreBatchListeners.forEach((fn) => fn(payload));
        } else if (type === 'player_heartbeat') {
          const p = payload as Participant;
          if (p && p.id) {
            this.currentPresence.set(p.id, { ...p, lastActive: Date.now() });
            this.notifyPresence();
          }
        } else if (type === 'presence_request') {
          // If a screen requests presence, send current user
          if (this.currentUser) {
            this.sendLocal('player_heartbeat', this.currentUser);
          }
        }
      };

      this.isConnected = true;

      // Ask others for presence
      if (this.role === 'screen') {
        this.sendLocal('presence_request', {});
      } else if (this.currentUser) {
        this.sendLocal('player_heartbeat', this.currentUser);
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

      // Cleanup inactive players after 12 seconds
      const now = Date.now();
      let changed = false;
      this.currentPresence.forEach((p, id) => {
        if (now - (p.lastActive || 0) > 12000) {
          this.currentPresence.delete(id);
          changed = true;
        }
      });
      if (changed) {
        this.notifyPresence();
      }
    }, 3000);
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
    // Notify locally as well
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

  onPresence(callback: PresenceCallback) {
    this.presenceListeners.add(callback);
    callback(Array.from(this.currentPresence.values()));
    return () => this.presenceListeners.delete(callback);
  }

  updateCurrentUser(user: Partial<Participant>) {
    if (!this.currentUser) return;
    this.currentUser = { ...this.currentUser, ...user };
    if (this.channel && isSupabaseConfigured) {
      this.channel.track({ ...this.currentUser, role: 'student' });
    } else {
      this.sendLocal('player_heartbeat', this.currentUser);
    }
  }

  disconnect() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
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
    this.currentPresence.clear();
  }
}

export const realtime = new BattleRealtimeClient();
