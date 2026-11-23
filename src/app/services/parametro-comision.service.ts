import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ParametroComision {
  id?: number;
  idVendedor?: number;
  /** null = GENERAL (todo el tenant). */
  idEmpresa?: number | null;
  porcentajeComision: number;
  porcentajeComisionContado: number;
  anticipoPorcentaje: number;
  anticipoMontoFijo?: number | null;
  montoCuota: number;
  mesesEspera: number;
  fechaInicioVigencia?: string | null;
  fechaFinVigencia?: string | null;
  fechaRegistro?: string;
}

@Injectable({ providedIn: 'root' })
export class ParametroComisionService {

  private readonly URL = `${environment.apiUrl}/api/parametros-comision`;

  constructor(private http: HttpClient) { }

  listar(): Observable<ParametroComision[]> {
    return this.http.get<ParametroComision[]>(this.URL);
  }

  vigente(idEmpresa?: number | null): Observable<ParametroComision> {
    let params = new HttpParams();
    if (idEmpresa != null) {
      params = params.set('idEmpresa', idEmpresa);
    }
    return this.http.get<ParametroComision>(`${this.URL}/vigente`, { params });
  }

  crear(dto: ParametroComision): Observable<ParametroComision> {
    return this.http.post<ParametroComision>(this.URL, dto);
  }

  editar(id: number, dto: ParametroComision): Observable<ParametroComision> {
    return this.http.put<ParametroComision>(`${this.URL}/${id}`, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }
}
