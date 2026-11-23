import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsuarioActivo {
  idSesion: number;
  idUsuario: number;
  nombreCompleto: string;
  correo: string;
  ip?: string;
  userAgent?: string;
  fechaLogueo: string;
  ultimoRefresh: string;
}

export interface SesionResumen {
  totalActivas: number;
  visitasHoy: number;
  sesiones: UsuarioActivo[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminSesionesService {

  private readonly URL = `${environment.apiUrl}/api/admin/sesiones`;

  constructor(private http: HttpClient) { }

  resumen(): Observable<SesionResumen> {
    return this.http.get<SesionResumen>(this.URL);
  }

  cerrar(idSesion: number): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.URL}/${idSesion}/cerrar`, {});
  }
}
