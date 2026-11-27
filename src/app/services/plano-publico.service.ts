import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LotePublico {
  programa: 'VF' | 'PV' | string;
  manzana: string;
  numero: string;
  estado: string;
}

export interface PlanoPublico {
  proyecto: string;
  programa: 'VF' | 'PV' | string;
  lotes: LotePublico[];
}

@Injectable({ providedIn: 'root' })
export class PlanoPublicoService {
  private readonly URL = `${environment.apiUrl}/api/public/planos`;

  constructor(private http: HttpClient) { }

  obtener(token: string): Observable<PlanoPublico> {
    return this.http.get<PlanoPublico>(`${this.URL}/${encodeURIComponent(token)}`);
  }
}
