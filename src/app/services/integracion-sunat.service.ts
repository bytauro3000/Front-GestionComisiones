import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Configuración de facturación electrónica (api-sunat) del tenant.
 * GET nunca trae api_key/api_secret reales: solo indicadores "configurado".
 * En PUT, claves vacías = conservar las existentes.
 */
export interface IntegracionSunat {
  apiUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  apiKeyConfigurado: boolean;
  apiSecretConfigurado: boolean;
  serieFactura: string;
  aplicarDetraccion: boolean;
  codBienDetraccion: string;
  porcentajeDetraccion: number;
  umbralDetraccion: number;
  ctaBanco?: string;
  codMedioPago: string;
}

@Injectable({ providedIn: 'root' })
export class IntegracionSunatService {

  private readonly URL = `${environment.apiUrl}/api/integracion-sunat`;

  constructor(private http: HttpClient) { }

  obtener(): Observable<IntegracionSunat> {
    return this.http.get<IntegracionSunat>(this.URL);
  }

  guardar(dto: IntegracionSunat): Observable<IntegracionSunat> {
    return this.http.put<IntegracionSunat>(this.URL, dto);
  }

  probar(): Observable<{ conectado: boolean }> {
    return this.http.post<{ conectado: boolean }>(`${this.URL}/probar`, {});
  }
}
