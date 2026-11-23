import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  correo: string;
  contrasena: string;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  private readonly URL_AUTH = `${environment.apiUrl}/api/auth`;

  constructor(private http: HttpClient) { }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.URL_AUTH}/login`, credentials, {
      withCredentials: true
    });
  }

  refreshToken(): Observable<LoginResponse> {
    // El refresh token se envía automáticamente en la cookie HttpOnly
    return this.http.post<LoginResponse>(`${this.URL_AUTH}/refresh`, {}, {
      withCredentials: true
    });
  }

  logout(): Observable<void> {
    // El refresh token se envía automáticamente en la cookie HttpOnly
    return this.http.post<void>(`${this.URL_AUTH}/logout`, {}, {
      withCredentials: true
    });
  }
}
