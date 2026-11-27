import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Asociado {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  dni?: string | null;
  tipoDocumento?: string | null;
  numDocumento?: string | null;
  estado: string;
  fechaRegistro?: string;
}

export interface AsociadoCrear {
  nombres: string;
  apellidos: string;
  correo: string;
  contrasena: string;
  telefono?: string;
  dni?: string;
  tipoDocumento?: string;
  numDocumento?: string;
}

@Injectable({ providedIn: 'root' })
export class AsociadoService {
  private readonly URL = `${environment.apiUrl}/api/asociados`;

  constructor(private http: HttpClient) { }

  listar(): Observable<Asociado[]> {
    return this.http.get<Asociado[]>(this.URL);
  }

  crear(dto: AsociadoCrear): Observable<Asociado> {
    return this.http.post<Asociado>(this.URL, dto);
  }

  cambiarEstado(id: number, estado: 'activo' | 'inactivo'): Observable<Asociado> {
    return this.http.patch<Asociado>(`${this.URL}/${id}/estado`, null, {
      params: { estado }
    });
  }

  resetPassword(id: number, nuevaContrasena: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.URL}/${id}/reset-password`, {
      nuevaContrasena
    });
  }
}
