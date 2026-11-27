import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { AdminSesionesService, SesionResumen } from '../../services/admin-sesiones.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-admin-sesiones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-sesiones.component.html',
  styleUrl: './admin-sesiones.component.scss'
})
export class AdminSesionesComponent implements OnInit {

  resumen: SesionResumen | null = null;
  cargando = false;

  constructor(
    private sesionesService: AdminSesionesService,
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
    this.sesionesService.resumen().subscribe({
      next: (data) => {
        this.resumen = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('Error al cargar las sesiones', 'Error');
      }
    });
  }

  cerrar(idSesion: number): void {
    Swal.fire({
      title: 'Cerrar sesión',
      text: 'Se desconectará al usuario de este dispositivo.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.sesionesService.cerrar(idSesion).subscribe({
        next: () => {
          this.alert.success('Sesión cerrada');
          this.cargar();
        },
        error: (err) => {
          this.alert.toastError(err?.error?.mensaje || 'No se pudo cerrar la sesión', 'Error');
        }
      });
    });
  }
}
