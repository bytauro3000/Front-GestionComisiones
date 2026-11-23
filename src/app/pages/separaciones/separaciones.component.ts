import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import { LoteService, Lote } from '../../services/lote.service';

@Component({
  selector: 'app-separaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './separaciones.component.html',
  styleUrl: './separaciones.component.scss'
})
export class SeparacionesComponent implements OnInit {

  separaciones: Lote[] = [];
  cargando = false;
  procesandoId: number | null = null;
  filtroTipo: '' | 'PROPIA' | 'AJENA' = '';

  constructor(
    private loteService: LoteService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.loteService.listarSeparaciones().subscribe({
      next: (data) => {
        this.separaciones = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.toastr.error('Error al cargar las separaciones', 'Error');
      }
    });
  }

  get xFiltradas(): Lote[] {
    if (!this.filtroTipo) return this.separaciones;
    return this.separaciones.filter(l => this.filtroTipo === 'AJENA' ? !!l.separacionAjena : !l.separacionAjena);
  }

  /** Días que faltan para que venza (negativo = vencida). */
  diasRestantes(l: Lote): number {
    if (!l.fechaVinceSeparacion) return 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(l.fechaVinceSeparacion + 'T00:00:00');
    return Math.round((fin.getTime() - hoy.getTime()) / 86400000);
  }

  /** true = próxima a vencer (≤4 días) y propia → hay que contacting al cliente. */
  porVencer(l: Lote): boolean {
    const d = this.diasRestantes(l);
    return !l.separacionAjena && d >= 0 && d <= 4;
  }

  vencida(l: Lote): boolean {
    return this.diasRestantes(l) < 0;
  }

  /** Separaciones propias que vencen pronto → aviso para contactar al cliente. */
  get alertas(): Lote[] {
    return this.separaciones.filter(l => this.porVencer(l));
  }

  formatearMoneda(v?: number): string {
    return '$ ' + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(v || 0);
  }

  formatearFecha(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  liberar(l: Lote): void {
    Swal.fire({
      title: 'Liberar separación',
      html: `¿Liberar el lote <strong>${l.proyecto} Mz.${l.manzana} Lt.${l.numero}</strong>?<br>` +
            `<small>Volverá a estar disponible.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, liberar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = l.id ?? null;
      this.loteService.liberarSeparacion(l.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          this.toastr.success('Separación liberada');
          this.cargar();
        },
        error: (err) => {
          this.procesandoId = null;
          this.toastr.error(err?.error?.mensaje || 'No se pudo liberar la separación', 'Error');
        }
      });
    });
  }
}
