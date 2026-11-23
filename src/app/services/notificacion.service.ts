import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  idReferencia?: number;
  leida: boolean;
  fechaCreacion: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionService {

  private readonly URL = `${environment.apiUrl}/api/notificaciones`;

  constructor(private http: HttpClient) { }

  listar(soloNoLeidas = false): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(this.URL, {
      params: soloNoLeidas ? { soloNoLeidas: true } : {}
    });
  }

  contar(): Observable<{ noLeidas: number }> {
    return this.http.get<{ noLeidas: number }>(`${this.URL}/count`);
  }

  marcarLeida(id: number): Observable<void> {
    return this.http.patch<void>(`${this.URL}/${id}/leida`, {});
  }

  marcarTodas(): Observable<void> {
    return this.http.patch<void>(`${this.URL}/leer-todas`, {});
  }
}
