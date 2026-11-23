import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PagoDisponible {
  idPago: number;
  idComision: number;
  tipo: string;
  numeroCuota?: number;
  monto: number;
  fechaPago: string;
  formaPago?: string;
  referencia?: string;
  idLote: number;
  loteEtiqueta: string;
  idEmpresa: number;
  empresaNombre: string;
}

export interface ComprobanteListado {
  id: number;
  tipo: string;
  serie?: string;
  correlativo?: string;
  idApiSunat?: string;
  fechaEmision: string;
  idEmpresa: number;
  empresaNombre: string;
  empresaRuc?: string;
  subtotal: number;
  igv: number;
  total: number;
  concepto?: string;
  aplicaDetraccion: boolean;
  montoDetraccion?: number;
  estado: string;
  pagos: any[];
  fechaRegistro?: string;
}

export interface ComprobanteCrear {
  tipo: string;
  idEmpresa: number;
  pagos: number[];
  fechaEmision: string;
  concepto?: string;
}

@Injectable({ providedIn: 'root' })
export class ComprobanteService {

  private readonly URL = `${environment.apiUrl}/api/comprobantes`;

  constructor(private http: HttpClient) { }

  listar(): Observable<ComprobanteListado[]> {
    return this.http.get<ComprobanteListado[]>(this.URL);
  }

  pagosDisponibles(): Observable<PagoDisponible[]> {
    return this.http.get<PagoDisponible[]>(`${this.URL}/pagos-disponibles`);
  }

  obtener(id: number): Observable<ComprobanteListado> {
    return this.http.get<ComprobanteListado>(`${this.URL}/${id}`);
  }

  emitir(dto: ComprobanteCrear): Observable<ComprobanteListado> {
    return this.http.post<ComprobanteListado>(this.URL, dto);
  }

  sincronizar(id: number): Observable<ComprobanteListado> {
    return this.http.post<ComprobanteListado>(`${this.URL}/${id}/sincronizar`, {});
  }

  /** PDF por proxy (el backend usa las credenciales api-sunat del tenant). */
  descargarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.URL}/${id}/pdf`, { responseType: 'blob' });
  }
}
