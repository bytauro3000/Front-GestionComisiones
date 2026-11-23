import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Coordina la apertura del modal "Nueva proforma" desde cualquier parte
 * (por ejemplo, el botón flotante global del layout del vendedor).
 */
@Injectable({ providedIn: 'root' })
export class ProformaUiService {

  private readonly nuevaSubject = new Subject<void>();
  private pendiente = false;

  /** Solicita abrir el modal de nueva proforma. */
  solicitarNueva(): void {
    this.pendiente = true;
    this.nuevaSubject.next();
  }

  /** Handler para componentes que ya están montados. */
  onNueva(): Observable<void> {
    return this.nuevaSubject.asObservable();
  }

  /** true una sola vez si quedó una solicitud pendiente (al navegar). */
  consumirPendiente(): boolean {
    const valor = this.pendiente;
    this.pendiente = false;
    return valor;
  }
}
