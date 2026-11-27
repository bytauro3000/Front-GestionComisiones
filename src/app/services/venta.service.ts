import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ComisionRepartoSocio {
  idSocio: number;
  participaInicial: boolean;
  porcentajeInicial?: number | null;
  montoInicial?: number | null;
  participaCuotas: boolean;
  porcentajeCuotas?: number | null;
  montoCuotaSocio?: number | null;
}

export interface VentaCrear {
  /** Uno o varios lotes bajo la MISMA venta. */
  idsLotes: number[];
  /** Uno o varios compradores de la misma venta. */
  idsClientes: number[];

  /** Asociado al que se atribuye la venta (opcional; null = jefe). */
  idVendedorAsociado?: number | null;
  fechaVenta: string;
  /** Total de la venta (suma de precios de lista, editable por descuento). */
  precioVenta: number;
  montoInicial?: number;
  modalidad: string;
  comisionManual?: number;
  notas?: string;
  /** Override del % del inicial del cliente que se paga como anticipo (0.30 = 30%). */
  porcentajeAnticipo?: number;
  /** Override del monto de cada letra. */
  montoCuota?: number;
  /** Reparto con socios (máximo 2). */
  socios?: ComisionRepartoSocio[];
}

export interface VentaListado {
  id: number;
  fechaVenta: string;
  modalidad: string;
  estado: string;
  precioVenta: number;
  montoInicial?: number;
  loteEtiqueta: string;
  clienteNombre: string;
  idEmpresa: number;
  empresaNombre: string;
  idVendedorAsociado?: number | null;
  vendedorAsociado?: string | null;
  comisionTotal?: number;
  comisionPagada?: number;
  comisionEstado?: string;
  fechaRegistro?: string;
}

export interface VentaDetalle {
  id: number;
  fechaVenta: string;
  modalidad: string;
  estado: string;
  precioVenta: number;
  montoInicial?: number;
  fechaInicioCuotas?: string;
  notas?: string;
  loteEtiqueta: string;
  idEmpresa: number;
  empresaNombre: string;
  clienteNombre: string;
  clienteDocumento: string;
  comision?: any;
  pagos?: any[];
  fechaRegistro?: string;
}

@Injectable({ providedIn: 'root' })
export class VentaService {

  private readonly URL = `${environment.apiUrl}/api/ventas`;

  constructor(private http: HttpClient) { }

  listar(): Observable<VentaListado[]> {
    return this.http.get<VentaListado[]>(this.URL);
  }

  obtener(id: number): Observable<VentaDetalle> {
    return this.http.get<VentaDetalle>(`${this.URL}/${id}`);
  }

  crear(dto: VentaCrear): Observable<VentaDetalle> {
    return this.http.post<VentaDetalle>(this.URL, dto);
  }

  anular(id: number): Observable<VentaDetalle> {
    return this.http.post<VentaDetalle>(`${this.URL}/${id}/anular`, {});
  }
}
