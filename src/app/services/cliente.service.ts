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
