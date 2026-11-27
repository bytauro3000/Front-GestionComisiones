import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { TokenService } from '../auth/token.service';
import { environment } from '../../environments/environment';

/**
 * Conexión WebSocket con el backend. El servidor solo envía un aviso
 * ("data-changed"); cada vista decide qué datos volver a cargar.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private manualClose = false;
  private publicToken: string | null = null;

  private readonly changesSubject = new Subject<number>();
  readonly changes$ = this.changesSubject.asObservable();

  constructor(private tokenService: TokenService) { }

  connectInternal(): void {
    this.publicToken = null;
    this.manualClose = false;
    this.open();
  }

  connectPublic(token: string): void {
    this.publicToken = token;
    this.manualClose = false;
    this.open();
  }

  disconnect(): void {
    this.manualClose = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
  }

  private open(): void {
    if (typeof window === 'undefined') return;
    if (this.socket && (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    )) {
      return;
    }

    const token = this.publicToken ?? this.tokenService.getToken();
    if (!token) return;

    const url = new URL(environment.apiUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = `?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(url.toString());
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.startPing();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'data-changed') {
          const version = Number(data.version || Date.now());
          this.changesSubject.next(version);
          window.dispatchEvent(new CustomEvent('app:data-changed', {
            detail: { version }
          }));
        }
      } catch {
        // Los mensajes de control (pong) no necesitan acción.
      }
    };

    this.socket.onerror = () => {
      // El cierre se maneja en onclose para reintentar.
    };

    this.socket.onclose = () => {
      this.stopPing();
      this.socket = null;
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.manualClose) return;
    const delay = Math.min(15000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send('ping');
      }
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
