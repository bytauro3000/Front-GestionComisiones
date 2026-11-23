import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Respuesta Declecta/RENIEC (campos en snake_case, tal como la devuelve el backend). */
export interface DniConsulta {
  first_name?: string;
  first_last_name?: string;
  second_last_name?: string;
  full_name?: string;
  document_number?: string;
}

/** Respuesta Declecta/SUNAT para RUC. */
export interface RucConsulta {
  razon_social?: string;
  numero_documento?: string;
  estado?: string;
  condicion?: string;
  direccion?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  ubigeo?: string;
}

@Injectable({ providedIn: 'root' })
export class DeclectaService {

  private readonly URL = `${environment.apiUrl}/api/decolecta`;

  constructor(private http: HttpClient) { }

  dni(numero: string): Observable<DniConsulta> {
    return this.http.get<DniConsulta>(`${this.URL}/dni/${numero}`);
  }

  ruc(numero: string): Observable<RucConsulta> {
    return this.http.get<RucConsulta>(`${this.URL}/ruc/${numero}`);
  }
}
