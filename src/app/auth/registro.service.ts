import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Datos del auto-registro público (queda PENDIENTE de aprobación). */
export interface RegistroPublico {
  nombres: string;
  apellidos: string;
  correo: string;
  contrasena: string;
  telefono?: string;
  dni?: string;
  tipoDocumento?: string;
  numDocumento?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegistroService {

  private readonly URL = `${environment.apiUrl}/api/auth/registro`;

  constructor(private http: HttpClient) { }

  registrar(dto: RegistroPublico): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(this.URL, dto);
  }
}
