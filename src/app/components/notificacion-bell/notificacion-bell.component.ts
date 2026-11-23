import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificacionService, Notificacion } from '../../services/notificacion.service';

@Component({
  selector: 'app-notificacion-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificacion-bell.component.html',
  styleUrl: './notificacion-bell.component.scss'
})
export class NotificacionBellComponent implements OnInit, OnDestroy {

  notificaciones: Notificacion[] = [];
  noLeidas = 0;
  panelAbierto = false;
  permiso: NotificationPermission | 'no-soportado' = 'default';

  private timer: ReturnType<typeof setInterval> | null = null;
  private prevNoLeidas = 0;

  constructor(
    private notificacionService: NotificacionService,
    private el: ElementRef
  ) { }

  ngOnInit(): void {
    this.permiso = typeof Notification !== 'undefined' ? Notification.permission : 'no-soportado';
    this.refrescar(true);
    this.timer = setInterval(() => this.refrescar(false), 60000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.panelAbierto && !this.el.nativeElement.contains(event.target)) {
      this.panelAbierto = false;
    }
  }

  togglePanel(): void {
    this.panelAbierto = !this.panelAbierto;
    if (this.panelAbierto) {
      this.notificacionService.listar().subscribe({
        next: (data) => (this.notificaciones = data),
        error: () => undefined
      });
    }
  }

  marcarLeida(n: Notificacion): void {
    if (!n.leida) {
      this.notificacionService.marcarLeida(n.id).subscribe({
        next: () => this.refrescar(false),
        error: () => undefined
      });
    }
  }

  marcarTodas(): void {
    this.notificacionService.marcarTodas().subscribe({
      next: () => this.refrescar(false),
      error: () => undefined
    });
  }

  activarNavegador(): void {
    if (typeof Notification === 'undefined') {
      this.permiso = 'no-soportado';
      return;
    }
    Notification.requestPermission().then((p) => {
      this.permiso = p;
      if (p === 'granted') {
        new Notification('Avisos activados', {
          body: 'Te avisaremos de las separaciones por vencer mientras uses la app.'
        });
      }
    });
  }

  private refrescar(primeraVez: boolean): void {
    this.notificacionService.contar().subscribe({
      next: (r) => {
        if (!primeraVez && r.noLeidas > this.prevNoLeidas && this.permiso === 'granted') {
          this.avisarNavegador();
        }
        this.noLeidas = r.noLeidas;
        this.prevNoLeidas = r.noLeidas;
      },
      error: () => undefined
    });
    if (this.panelAbierto) {
      this.notificacionService.listar().subscribe({
        next: (data) => (this.notificaciones = data),
        error: () => undefined
      });
    }
  }

  private avisarNavegador(): void {
    this.notificacionService.listar(true).subscribe({
      next: (lista) => {
        const n = lista[0];
        if (n) {
          new Notification(n.titulo, { body: n.mensaje });
        }
      },
      error: () => undefined
    });
  }
}
