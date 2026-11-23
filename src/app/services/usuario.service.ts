import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsuarioListado {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string;
  dni?: string;
  rol: string;
  estado: string;
  fechaRegistro?: string;
}

export interface UsuarioRegistro {
  nombres: string;
  apellidos: string;
  correo: string;
  contrasena?: string;
  telefono?: string;
  dni?: string;
  rol: string;
  estado?: string;
}

export interface Perfil {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string;
  dni?: string;
  rol: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

  private readonly URL = `${environment.apiUrl}/api/usuarios`;

  constructor(private http: HttpClient) { }

  listar(): Observable<UsuarioListado[]> {
    return this.http.get<UsuarioListado[]>(this.URL);
  }

  /** Listado filtrado por estado: pendiente | activo | inactivo. */
  listarPorEstado(estado: string): Observable<UsuarioListado[]> {
    return this.http.get<UsuarioListado[]>(this.URL, {
      params: estado ? { estado } : {}
    });
  }

  /** Aprueba un auto-registro (pendiente → activo). */
  aprobar(id: number): Observable<UsuarioListado> {
    return this.http.patch<UsuarioListado>(`${this.URL}/${id}/aprobar`, {});
  }

  /** Rechaza un auto-registro (pendiente → inactivo). */
  rechazar(id: number): Observable<UsuarioListado> {
    return this.http.patch<UsuarioListado>(`${this.URL}/${id}/rechazar`, {});
  }

  listarRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.URL}/roles`);
  }

  crear(dto: UsuarioRegistro): Observable<UsuarioListado> {
    return this.http.post<UsuarioListado>(this.URL, dto);
  }

  editar(id: number, dto: UsuarioRegistro): Observable<UsuarioListado> {
    return this.http.put<UsuarioListado>(`${this.URL}/${id}`, dto);
  }

  cambiarEstado(id: number): Observable<UsuarioListado> {
    return this.http.patch<UsuarioListado>(`${this.URL}/${id}/estado`, {});
  }

  resetPassword(id: number, nuevaContrasena: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.URL}/${id}/reset-password`, {
      nuevaContrasena
    });
  }

  /** Elimina el usuario y en cascada todo su árbol de datos. */
  eliminar(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.URL}/${id}`);
  }

  /** Perfil del usuario autenticado (sus propios datos). */
  perfil(): Observable<Perfil> {
    return this.http.get<Perfil>(`${environment.apiUrl}/api/perfil`);
  }
}
