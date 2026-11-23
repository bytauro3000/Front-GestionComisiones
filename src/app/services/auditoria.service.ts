import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuditoriaFila {
  idAuditoria: number;
  fechaHora: string;
  usuarioEmail: string;
  usuarioRol?: string;
  accion: string;
  entidad: string;
  idEntidad?: number;
  descripcion?: string;
  ipOrigen?: string;
}

export interface PaginaAuditoria {
  elementos: AuditoriaFila[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuditoriaService {

  private readonly URL = `${environment.apiUrl}/api/auditoria`;

  constructor(private http: HttpClient) { }

  listar(pagina: number, tamano: number, accion?: string, buscar?: string): Observable<PaginaAuditoria> {
    let params = new HttpParams()
      .set('pagina', pagina)
      .set('tamano', tamano);
    if (accion) params = params.set('accion', accion);
    if (buscar && buscar.trim()) params = params.set('buscar', buscar.trim());
    return this.http.get<PaginaAuditoria>(this.URL, { params });
  }
}
