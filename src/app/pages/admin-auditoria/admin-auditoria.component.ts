import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditoriaService, AuditoriaFila, PaginaAuditoria } from '../../services/auditoria.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-admin-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-auditoria.component.html',
  styleUrl: './admin-auditoria.component.scss'
})
export class AdminAuditoriaComponent implements OnInit {

  pagina: PaginaAuditoria | null = null;
  cargando = false;

  paginaActual = 0;
  tamano = 20;
  accion = '';
  buscar = '';

  readonly acciones = ['LOGIN', 'LOGOUT', 'CREAR', 'ACTUALIZAR', 'ELIMINAR', 'RESET_PASSWORD'];

  constructor(
    private auditoriaService: AuditoriaService,
    private alert: AlertService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  @HostListener('window:app:data-changed')
  onRealtimeChange(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.auditoriaService.listar(
      this.paginaActual,
      this.tamano,
      this.accion || undefined,
      this.buscar || undefined
    ).subscribe({
      next: (data) => {
        this.pagina = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('Error al cargar la auditoría', 'Error');
      }
    });
  }

  filtrar(): void {
    this.paginaActual = 0;
    this.cargar();
  }

  cambiarPagina(delta: number): void {
    if (!this.pagina) return;
    const nueva = this.paginaActual + delta;
    if (nueva >= 0 && nueva < this.pagina.totalPaginas) {
      this.paginaActual = nueva;
      this.cargar();
    }
  }

  claseAccion(accion: string): string {
    switch (accion) {
      case 'LOGIN': return 'badge-info';
      case 'LOGOUT': return 'badge-warning';
      case 'CREAR': return 'badge-activo';
      case 'ELIMINAR': return 'badge-inactivo';
      case 'RESET_PASSWORD': return 'badge-warning';
      default: return 'badge-info';
    }
  }
}
