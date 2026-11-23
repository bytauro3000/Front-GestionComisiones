import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CuentaBancaria {
  banco: string;
  tipoCuenta?: string;
  numeroCuenta: string;
  cci?: string;
}

export interface Empresa {
  id?: number;
  idVendedor?: number;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccion?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  telefono?: string;
  correo?: string;
  cuentas?: CuentaBancaria[];
  fechaRegistro?: string;
}

@Injectable({ providedIn: 'root' })
export class EmpresaService {

  private readonly URL = `${environment.apiUrl}/api/empresas`;

  constructor(private http: HttpClient) { }

  listar(): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(this.URL);
  }

  obtener(id: number): Observable<Empresa> {
    return this.http.get<Empresa>(`${this.URL}/${id}`);
  }

  crear(dto: Empresa): Observable<Empresa> {
    return this.http.post<Empresa>(this.URL, dto);
  }

  editar(id: number, dto: Empresa): Observable<Empresa> {
    return this.http.put<Empresa>(`${this.URL}/${id}`, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }
}
