import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PagoComision {
  id: number;
  idComision: number;
  tipo: string;
  numeroCuota?: number;
  monto: number;
  fechaProgramada?: string;
  fechaPago?: string;
  estado: string;
  formaPago?: string;
  referencia?: string;
  notas?: string;
  fechaRegistro?: string;
}

export interface RepartoComision {
  id: number;
  idSocio: number;
  socioNombre: string;
  participaInicial: boolean;
  porcentajeInicial?: number | null;
  montoInicial?: number | null;
  participaCuotas: boolean;
  porcentajeCuotas?: number | null;
  montoCuotaSocio?: number | null;
}

export interface ComisionListado {
  id: number;
  idVenta: number;
  estado: string;
  montoTotal: number;
  montoPagado: number;
  montoSaldo: number;
  montoAnticipo: number;
  porcentajeAnticipo?: number | null;
  montoCuota?: number;
  cantidadCuotas?: number;
  idLote: number;
  loteEtiqueta: string;
  idEmpresa: number;
  empresaNombre: string;
  clienteNombre: string;
  idVendedorAsociado?: number | null;
  vendedorAsociado?: string | null;
  montoJefe?: number;
  montoAsociado?: number;
  pagosPendientes: number;
  montoPendiente: number;
  repartos?: RepartoComision[];
  pagos: PagoComision[];
}

export interface CobrarPagos {
  pagos: number[];
  fechaPago: string;
  formaPago?: string;
  referencia?: string;
  notas?: string;
}

@Injectable({ providedIn: 'root' })
export class ComisionService {

  private readonly URL = `${environment.apiUrl}/api/comisiones`;

  constructor(private http: HttpClient) { }

  listar(estado?: string): Observable<ComisionListado[]> {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<ComisionListado[]>(this.URL, { params });
  }

  obtener(id: number): Observable<ComisionListado> {
    return this.http.get<ComisionListado>(`${this.URL}/${id}`);
  }

  cobrar(id: number, dto: CobrarPagos): Observable<ComisionListado> {
    return this.http.post<ComisionListado>(`${this.URL}/${id}/pagos`, dto);
  }

  revertir(id: number, idPago: number): Observable<ComisionListado> {
    return this.http.post<ComisionListado>(`${this.URL}/${id}/pagos/${idPago}/revertir`, {});
  }
}
