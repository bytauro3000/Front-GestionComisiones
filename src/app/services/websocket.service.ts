import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { Subject, Observable } from 'rxjs';
import { Mensaje } from '../models/mensajeria.models';
import { environment } from '../../environments/environment';

/** Evento de actualización de datos broadcasteado por el backend
 *  (/grupal/actualizaciones): {entidad, accion, id}. */
export interface Actualizacion {
  entidad: string;
  accion: string;
  id: number;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private client: Client;
  private mensajesSubject = new Subject<Mensaje>();
  private connectedSubject = new Subject<boolean>();
  private actualizacionesSubject = new Subject<Actualizacion>();
  private emailUsuario = '';

  mensajes$: Observable<Mensaje> = this.mensajesSubject.asObservable();
  connected$: Observable<boolean> = this.connectedSubject.asObservable();
  /** Se emite cuando el backend notifica un cambio de datos
   *  (contrato, lote, letra, mora, pago o separación). */
  actualizaciones$: Observable<Actualizacion> = this.actualizacionesSubject.asObservable();

  constructor() {
    this.client = new Client();
    this.client.brokerURL = `${environment.wsUrl}/chat-ws`;
    this.client.reconnectDelay = 5000;
    this.client.heartbeatIncoming = 10000;
    this.client.heartbeatOutgoing = 10000;
  }

  conectar(email: string): void {
    if (!email) return;
    if (this.client.active) {
      // Ya conectado con el mismo usuario: no hacer nada.
      // Si cambió de usuario (login distinto en la misma pestaña): reconectar.
      if (email === this.emailUsuario) return;
      this.client.deactivate()
        .then(() => this.iniciar(email))
        .catch(() => {});
      return;
    }
    this.iniciar(email);
  }

  private iniciar(email: string): void {
    this.emailUsuario = email;

    this.client.onConnect = () => {
      this.connectedSubject.next(true);
      this.client.subscribe(`/usuario/${this.emailUsuario}/privado/mensajes`, (message: IMessage) => {
        try {
          const mensaje: Mensaje = JSON.parse(message.body);
          this.mensajesSubject.next(mensaje);
        } catch {
          console.error('Error al parsear mensaje WebSocket');
        }
      });
      // Actualizaciones de datos en tiempo real: las listas abiertas en
      // otras pestañas/usuarios se recargan al recibir este mensaje.
      this.client.subscribe('/grupal/actualizaciones', (message: IMessage) => {
        try {
          this.actualizacionesSubject.next(JSON.parse(message.body));
        } catch {
          console.error('Error al parsear actualización WebSocket');
        }
      });
    };

    this.client.onDisconnect = () => this.connectedSubject.next(false);
    this.client.onStompError = () => this.connectedSubject.next(false);
    this.client.activate();
  }

  desconectar(): void {
    if (this.client.active) {
      this.client.deactivate();
    }
  }

  enviarMensaje(remitenteId: number, destinatariosIds: number[], contenido: string): void {
    if (!this.client.connected) return;
    this.client.publish({
      destination: '/backend/enviar',
      body: JSON.stringify({ remitenteId, destinatariosIds, contenido })
    });
  }

  estaConectado(): boolean {
    return this.client.connected;
  }

  ngOnDestroy(): void {
    this.desconectar();
  }
}
