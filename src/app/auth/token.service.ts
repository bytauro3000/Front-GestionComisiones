import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly TOKEN_KEY = 'jwtToken';

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  getRole(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded: any = jwtDecode(token);
      return decoded.rol || null;
    } catch {
      return null;
    }
  }

  getNombreCompleto(): string {
    const token = this.getToken();
    if (!token) return '';
    try {
      const decoded: any = jwtDecode(token);
      return `${decoded.nombre || ''} ${decoded.apellidos || ''}`.trim();
    } catch {
      return '';
    }
  }

  getExpiresAt(): number | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded: { exp: number } = jwtDecode(token);
      return decoded.exp * 1000;
    } catch {
      return null;
    }
  }

  isTokenExpired(): boolean {
    const exp = this.getExpiresAt();
    return exp == null || exp < Date.now();
  }
}
