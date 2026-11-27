import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DetalleProforma {
  id?: number;
  idLote: number;
  precioUnitario: number;
  /** Inicial pactada para este lote (puede ser menor a la del lote). */
  inicial?: number | null;
  numCuotas?: number | null;
  descripcion?: string;
  areaM2?: number;
  /** Snapshot de la empresa del lote (puede haber varias en una proforma). */
  idEmpresa?: number;
  empresaNombre?: string;
  proyecto?: string;
}

export interface Proforma {
  id?: number;
  /** Empresa referencial (opcional). */
  idEmpresa?: number | null;
  idCliente: number;
  idVendedorAsociado?: number | null;
  /** Token no adivinable para el enlace público del PDF. */
  publicToken?: string | null;
  observaciones?: string | null;
  estado?: string;
  numero?: string;
  fecha?: string;
  total?: number;
  detalles: DetalleProforma[];
}

export interface ProformaSeguimiento {
  idCliente: number;
  clienteNombre: string;
  clienteDocumento: string;
  clienteTelefono: string;
  prospecto: boolean;
  estadoSeguimiento: string;
  notaSeguimiento?: string | null;
  proximoContacto?: string | null;
  cantidadProformas: number;
  ultimaFecha?: string | null;
  ultimaProformaNumero?: string | null;
  ultimaProformaId?: number | null;
  totalOfertado: number;
}

export interface FiltroFechas {
  fechaDesde?: string;
  fechaHasta?: string;
}

@Injectable({ providedIn: 'root' })
export class ProformaService {

  private readonly URL = `${environment.apiUrl}/api/proformas`;

  constructor(private http: HttpClient) { }

  listar(filtro?: FiltroFechas): Observable<Proforma[]> {
    return this.http.get<Proforma[]>(this.URL, { params: this.params(filtro) });
  }

  seguimiento(filtro?: FiltroFechas): Observable<ProformaSeguimiento[]> {
    return this.http.get<ProformaSeguimiento[]>(`${this.URL}/seguimiento`, {
      params: this.params(filtro)
    });
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
    const params = new HttpParams().set('estado', estado);
    return this.http.patch<Proforma>(`${this.URL}/${id}/estado`, null, { params });
  }

  /** PDF generado por el backend (para descargar o compartir por WhatsApp). */
  descargarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.URL}/${id}/pdf`, { responseType: 'blob' });
  }

  private params(filtro?: FiltroFechas): HttpParams {
    let params = new HttpParams();
    if (filtro?.fechaDesde) {
      params = params.set('fechaDesde', filtro.fechaDesde);
    }
    if (filtro?.fechaHasta) {
      params = params.set('fechaHasta', filtro.fechaHasta);
    }
    return params;
  }
}
