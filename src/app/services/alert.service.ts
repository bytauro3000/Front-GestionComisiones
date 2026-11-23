import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

/**
 * Alertas y confirmaciones unificadas con SweetAlert2.
 * - success(): mensaje de éxito sin botones (se cierra solo).
 * - confirmarEdicion() / confirmarEliminacion(): preguntan antes de actuar.
 */
@Injectable({ providedIn: 'root' })
export class AlertService {

  private readonly toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (el) => {
      el.addEventListener('mouseenter', Swal.stopTimer);
      el.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  private fireToast(icon: 'success' | 'error' | 'warning' | 'info',
                    mensaje: string, titulo?: string): void {
    void this.toast.fire({
      icon,
      title: titulo || mensaje,
      text: titulo ? mensaje : undefined
    });
  }

  toastSuccess(mensaje: string, titulo?: string, _opts?: unknown): void {
    this.fireToast('success', mensaje, titulo);
  }

  toastError(mensaje: string, titulo?: string, _opts?: unknown): void {
    this.fireToast('error', mensaje, titulo);
  }

  toastWarning(mensaje: string, titulo?: string, _opts?: unknown): void {
    this.fireToast('warning', mensaje, titulo);
  }

  toastInfo(mensaje: string, titulo?: string, _opts?: unknown): void {
    this.fireToast('info', mensaje, titulo);
  }

  success(mensaje: string, titulo = '¡Listo!'): void {
    void Swal.fire({
      icon: 'success',
      title: titulo,
      text: mensaje,
      showConfirmButton: false,
      timer: 1600,
      timerProgressBar: true,
      allowOutsideClick: false
    });
  }

  error(mensaje: string, titulo = 'Ocurrió un error'): void {
    void Swal.fire({
      icon: 'error',
      title: titulo,
      text: mensaje,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#4f46e5'
    });
  }

  confirmarEdicion(html = '¿Seguro que deseas guardar los cambios?'): Promise<boolean> {
    return Swal.fire({
      icon: 'question',
      title: '¿Confirmar modificación?',
      html,
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#64748b'
    }).then((r) => r.isConfirmed);
  }

  confirmarEliminacion(html: string, titulo = 'Eliminar registro'): Promise<boolean> {
    return Swal.fire({
      icon: 'warning',
      title: titulo,
      html,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    }).then((r) => r.isConfirmed);
  }

  confirmar(titulo: string, html: string, textoConfirmar = 'Sí, continuar'): Promise<boolean> {
    return Swal.fire({
      icon: 'question',
      title: titulo,
      html,
      showCancelButton: true,
      confirmButtonText: textoConfirmar,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#64748b'
    }).then((r) => r.isConfirmed);
  }
}
