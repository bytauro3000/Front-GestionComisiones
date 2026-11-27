import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Socio {
  id?: number;
  nombres: string;
  apellidos?: string;
  tipoDocumento?: string;
  documento?: string;
  telefono?: string;
  activo?: boolean;
  fechaRegistro?: string;
}

@Injectable({ providedIn: 'root' })
export class SocioService {

  private readonly URL = `${environment.apiUrl}/api/socios`;

  constructor(private http: HttpClient) { }

  listar(soloActivos = false): Observable<Socio[]> {
    let params = new HttpParams();
    if (soloActivos) {
      params = params.set('soloActivos', true);
    }
    return this.http.get<Socio[]>(this.URL, { params });
  }

  crear(dto: Socio): Observable<Socio> {
    return this.http.post<Socio>(this.URL, dto);
  }

  editar(id: number, dto: Socio): Observable<Socio> {
    return this.http.put<Socio>(`${this.URL}/${id}`, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }
}
