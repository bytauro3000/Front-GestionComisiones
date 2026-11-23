import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TokenRefreshService } from './auth/token-refresh.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  private readonly tokenRefreshService = inject(TokenRefreshService);

  ngOnInit(): void {
    // Reanuda el refresco automático del token al cargar la app (tras un F5
    // el temporizador se perdía y el token se vencía a los 30 minutos).
    this.tokenRefreshService.scheduleNext();
  }
}
