import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DetalleProforma {
  id?: number;
  idLote: number;
  precioUnitario: number;
  descripcion?: string;
  areaM2?: number;
}

export interface Proforma {
  id?: number;
  idEmpresa: number;
  idCliente: number;
  observaciones?: string | null;
  estado?: string;
  numero?: string;
  fecha?: string;
  total?: number;
  detalles: DetalleProforma[];
}

@Injectable({ providedIn: 'root' })
export class ProformaService {

  private readonly URL = `${environment.apiUrl}/api/proformas`;

  constructor(private http: HttpClient) { }

  listar(): Observable<Proforma[]> {
    return this.http.get<Proforma[]>(this.URL);
  }

  obtener(id: number): Observable<Proforma> {
    return this.http.get<Proforma>(`${this.URL}/${id}`);
  }

  crear(dto: Proforma): Observable<Proforma> {
    return this.http.post<Proforma>(this.URL, dto);
  }

  editar(id: number, dto: Proforma): Observable<Proforma> {
    return this.http.put<Proforma>(`${this.URL}/${id}`, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }

  cambiarEstado(id: number, estado: string): Observable<Proforma> {
    let params = new HttpParams().set('estado', estado);
    return this.http.patch<Proforma>(`${this.URL}/${id}/estado`, null, { params });
  }
}
