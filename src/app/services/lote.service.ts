import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Lote {
  id?: number;
  idVendedor?: number;
  idEmpresa: number;
  idProyecto?: number;
  proyecto: string;
  manzana: string;
  numero: string;
  descripcion?: string;
  areaM2?: number;
  precioM2?: number;
  precio: number;
  inicial?: number;
  saldo?: number;
  numCuotas?: number;
  estado?: string;
  /** Motivo del cambio manual a VENDIDO (switch de la tabla). */
  motivoEstado?: string;
  /** true = el lote tiene una venta propia ACTIVA (solo la anulación lo libera). */
  ventaActiva?: boolean;
  /** Fecha de vencimiento de la separación (RESERVADO). */
  fechaVinceSeparacion?: string;
  /** Monto pagado por la separación (15 días = $50, 1 mes = $100). */
  montoSeparacion?: number;
  /** true = la separación la hizo otro vendedor (bloquea la venta). */
  separacionAjena?: boolean;
  /** Cliente con quien se separó el lote. */
  clienteSeparacion?: string;
  /** Nota libre de la separación. */
  notaSeparacion?: string;
  fechaRegistro?: string;
}

export interface LoteSeparacion {
  fechaVence: string;
  monto?: number;
  ajena: boolean;
  cliente?: string;
  nota?: string;
}

@Injectable({ providedIn: 'root' })
export class LoteService {

  private readonly URL = `${environment.apiUrl}/api/lotes`;

  constructor(private http: HttpClient) { }

  listar(filtro?: { idEmpresa?: number; idProyecto?: number; estado?: string }): Observable<Lote[]> {
    let params = new HttpParams();
    if (filtro?.idEmpresa != null) {
      params = params.set('idEmpresa', filtro.idEmpresa);
    }
    if (filtro?.idProyecto != null) {
      params = params.set('idProyecto', filtro.idProyecto);
    }
    if (filtro?.estado) {
      params = params.set('estado', filtro.estado);
    }
    return this.http.get<Lote[]>(this.URL, { params });
  }

  obtener(id: number): Observable<Lote> {
    return this.http.get<Lote>(`${this.URL}/${id}`);
  }

  crear(dto: Lote): Observable<Lote> {
    return this.http.post<Lote>(this.URL, dto);
  }

  editar(id: number, dto: Lote): Observable<Lote> {
    return this.http.put<Lote>(`${this.URL}/${id}`, dto);
  }

  /** Cambio rápido de estado desde la tabla (switch "vendido"). */
  cambiarEstado(id: number, estado: string, motivo?: string): Observable<Lote> {
    return this.http.patch<Lote>(`${this.URL}/${id}/estado`, {
      estado,
      motivo: motivo ?? null
    });
  }

  /** Separa (reserva) el lote por un plazo. Las ajenas bloquean la venta. */
  separar(id: number, dto: LoteSeparacion): Observable<Lote> {
    return this.http.patch<Lote>(`${this.URL}/${id}/separacion`, dto);
  }

  /** Libera la separación: el lote vuelve a DISPONIBLE. */
  liberarSeparacion(id: number): Observable<Lote> {
    return this.http.delete<Lote>(`${this.URL}/${id}/separacion`);
  }

  /** Lotes separados (RESERVADO) del vendedor. */
  listarSeparaciones(): Observable<Lote[]> {
    return this.http.get<Lote[]>(`${this.URL}/separaciones`);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }
}
