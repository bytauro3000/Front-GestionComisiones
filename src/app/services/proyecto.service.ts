import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Proyecto {
  id?: number;
  idVendedor?: number;
  idEmpresa: number;
  nombre: string;
  ubicacion?: string;
  latitud?: number;
  longitud?: number;
  tienePlano?: boolean;
  estado?: string;
  fechaRegistro?: string;
}

@Injectable({ providedIn: 'root' })
export class ProyectoService {

  private readonly URL = `${environment.apiUrl}/api/proyectos`;

  constructor(private http: HttpClient) { }

  listar(): Observable<Proyecto[]> {
    return this.http.get<Proyecto[]>(this.URL);
  }

  obtener(id: number): Observable<Proyecto> {
    return this.http.get<Proyecto>(`${this.URL}/${id}`);
  }

  crear(dto: Proyecto): Observable<Proyecto> {
    return this.http.post<Proyecto>(this.URL, dto);
  }

  editar(id: number, dto: Proyecto): Observable<Proyecto> {
    return this.http.put<Proyecto>(`${this.URL}/${id}`, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }

  // ── Plano (blob con JWT) ──────────────────────────────────────────────────

  subirPlano(id: number, archivo: File): Observable<Proyecto> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<Proyecto>(`${this.URL}/${id}/plano`, datos);
  }

  borrarPlano(id: number): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}/plano`);
  }

  descargarPlano(id: number): Observable<Blob> {
    return this.http.get(`${this.URL}/${id}/plano`, { responseType: 'blob' });
  }

  obtenerTokenPlanoPublico(id: number): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.URL}/${id}/plano-publico`, {});
  }
}
