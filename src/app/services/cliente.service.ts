import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Cliente {
  id?: number;
  idVendedor?: number;
  tipoDocumento?: string;
  numDocumento: string;
  nombres: string;
  apellidos?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  prospecto?: boolean;
  estadoSeguimiento?: string;
  notaSeguimiento?: string;
  proximoContacto?: string;
  fechaRegistro?: string;
}

@Injectable({ providedIn: 'root' })
export class ClienteService {

  private readonly URL = `${environment.apiUrl}/api/clientes`;

  constructor(private http: HttpClient) { }

  listar(q?: string): Observable<Cliente[]> {
    let params = new HttpParams();
    if (q && q.trim()) {
      params = params.set('q', q.trim());
    }
    return this.http.get<Cliente[]>(this.URL, { params });
  }

  obtener(id: number): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.URL}/${id}`);
  }

  /** Búsqueda rápida por documento (para emitir proformas). 404 si no existe. */
  buscarPorDocumento(numDocumento: string): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.URL}/por-documento`, {
      params: { numDocumento }
    });
  }

  /** Actualiza el seguimiento comercial del cliente/prospecto. */
  actualizarSeguimiento(
    id: number,
    dto: { estado?: string; nota?: string; proximoContacto?: string }
  ): Observable<Cliente> {
    return this.http.patch<Cliente>(`${this.URL}/${id}/seguimiento`, dto);
  }

  /** Convierte un prospecto en cliente (registro completo). */
  completar(id: number): Observable<Cliente> {
    return this.http.patch<Cliente>(`${this.URL}/${id}/completar`, {});
  }

  crear(dto: Cliente): Observable<Cliente> {
    return this.http.post<Cliente>(this.URL, dto);
  }

  editar(id: number, dto: Cliente): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.URL}/${id}`, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }
}
