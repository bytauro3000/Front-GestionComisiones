import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SaldoSocio {
  idSocio: number;
  socioNombre: string;
  montoGenerado: number;
  montoLiquidado: number;
  montoPendiente: number;
}

export interface LiquidacionResumen {
  idSocio: number;
  socioNombre: string;
  montoBruto: number;
  descuentoIgv: number;
  descuentoDetraccion: number;
  montoNeto: number;
  montoLiquidado: number;
  montoPendiente: number;
}

export interface LiquidacionSocio {
  id?: number;
  idSocio: number;
  socioNombre?: string;
  fecha: string;
  montoBruto: number;
  descuentoIgv: number;
  descuentoDetraccion: number;
  montoNeto?: number;
  referencia?: string;
  notas?: string;
  fechaRegistro?: string;
}

@Injectable({ providedIn: 'root' })
export class LiquidacionSocioService {

  private readonly URL = `${environment.apiUrl}/api/liquidaciones-socios`;

  constructor(private http: HttpClient) { }

  saldos(): Observable<SaldoSocio[]> {
    return this.http.get<SaldoSocio[]>(`${this.URL}/saldos`);
  }

  sugerir(idSocio: number): Observable<LiquidacionResumen> {
    const params = new HttpParams().set('idSocio', idSocio);
    return this.http.get<LiquidacionResumen>(`${this.URL}/sugerir`, { params });
  }

  listar(idSocio?: number): Observable<LiquidacionSocio[]> {
    let params = new HttpParams();
    if (idSocio != null) {
      params = params.set('idSocio', idSocio);
    }
    return this.http.get<LiquidacionSocio[]>(this.URL, { params });
  }

  crear(dto: LiquidacionSocio): Observable<LiquidacionSocio> {
    return this.http.post<LiquidacionSocio>(this.URL, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }
}
