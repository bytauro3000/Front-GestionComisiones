import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { PlanoLotesComponent, LoteEstado } from '../../components/plano-lotes/plano-lotes.component';
import { LotePublico, PlanoPublico, PlanoPublicoService } from '../../services/plano-publico.service';
import { RealtimeService } from '../../services/realtime.service';
import { PLANOS_POR_PROGRAMA, PlanoConfig } from '../../config/planos.config';

@Component({
  selector: 'app-plano-publico',
  standalone: true,
  imports: [CommonModule, PlanoLotesComponent],
  providers: [RealtimeService],
  templateUrl: './plano-publico.component.html',
  styleUrl: './plano-publico.component.scss'
})
export class PlanoPublicoComponent implements OnInit, OnDestroy {
  readonly token: string;
  proyecto = '';
  programa = '';
  plan: PlanoConfig | null = null;
  lotes: LoteEstado[] = [];

  cargando = true;
  error = '';
  actualizadoEn = '';

  private realtimeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private planoService: PlanoPublicoService,
    private realtime: RealtimeService,
    private meta: Meta
  ) {
    this.token = this.route.snapshot.paramMap.get('token') || '';
  }

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    if (!this.token) {
      this.error = 'Este enlace no es válido.';
      this.cargando = false;
      return;
    }

    this.cargar();
    this.realtime.connectPublic(this.token);
    this.realtimeSub = this.realtime.changes$.subscribe(() => this.cargar(false));
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
    this.realtime.disconnect();
  }

  private cargar(mostrarCargando = true): void {
    if (mostrarCargando) {
      this.cargando = true;
    }

    this.planoService.obtener(this.token).subscribe({
      next: (data) => this.aplicar(data),
      error: () => {
        this.error = 'El enlace no existe o ya no está disponible.';
        this.cargando = false;
      }
    });
  }

  private aplicar(data: PlanoPublico): void {
    this.proyecto = data.proyecto;
    this.programa = data.programa;
    this.plan = PLANOS_POR_PROGRAMA[data.programa] ?? null;
    this.lotes = data.lotes.map((l: LotePublico) => ({
      programa: l.programa,
      manzana: l.manzana,
      numero: l.numero,
      estado: l.estado
    }));

    if (!this.plan) {
      this.error = 'El plano no está disponible para este proyecto.';
    }

    this.actualizadoEn = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.cargando = false;
  }
}
