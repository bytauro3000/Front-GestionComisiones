import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { IdleTimeoutService } from './auth/idle-timeout.service';
import { TokenRefreshService } from './auth/token-refresh.service';
import { TokenService } from './auth/token.service';
import { EmpresaService } from './services/empresa.service';
import { WebSocketService } from './services/websocket.service';
import { Title, Meta } from '@angular/platform-browser';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  constructor(
    private idleTimeoutService: IdleTimeoutService,
    private tokenRefreshService: TokenRefreshService,
    private empresaService: EmpresaService,
    private titleService: Title,
    private metaService: Meta,
    private tokenService: TokenService,
    private wsService: WebSocketService,
  ) {}

  ngOnInit(): void {
    this.idleTimeoutService.startWatching();
    this.tokenRefreshService.start();

    // Conexión STOMP compartida: actualizaciones en tiempo real + chat.
    const token = this.tokenService.getToken();
    if (token && !this.tokenService.isTokenExpired()) {
      try {
        const decoded: { sub?: string } = jwtDecode(token);
        if (decoded?.sub) this.wsService.conectar(decoded.sub);
      } catch { /* token inválido: el interceptor HTTP lo maneja */ }
    }
    this.empresaService.obtenerEmpresa().subscribe(e => {
      if (!e) return;
      const nombre = e.nombreComercial || 'Inmobiliaria Ivan';
      this.titleService.setTitle(nombre + ' - Venta de Lotes');
      this.metaService.updateTag({ name: 'description', content: e.nombreLegal + ' - Venta de lotes de vivienda con título de propiedad, financiamiento directo y servicios básicos.' });
      this.metaService.updateTag({ name: 'keywords', content: 'lotes, terrenos, inmobiliaria, venta de lotes, ' + nombre });
      this.metaService.updateTag({ property: 'og:title', content: nombre + ' - Lotes en Venta' });
      this.metaService.updateTag({ property: 'og:description', content: 'Venta de lotes de vivienda con título de propiedad. Financiamiento directo.' });
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon && (e.logoSmallUrl || e.logoUrl)) favicon.href = e.logoSmallUrl || e.logoUrl;
    });
  }
}
