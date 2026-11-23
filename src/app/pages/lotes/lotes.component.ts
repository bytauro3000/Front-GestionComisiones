import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import { LoteService, Lote, LoteSeparacion } from '../../services/lote.service';
import { EmpresaService, Empresa } from '../../services/empresa.service';
import { ProyectoService, Proyecto } from '../../services/proyecto.service';

@Component({
  selector: 'app-lotes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lotes.component.html',
  styleUrl: './lotes.component.scss'
})
export class LotesComponent implements OnInit, OnDestroy {

  lotes: Lote[] = [];
  empresas: Empresa[] = [];
  proyectos: Proyecto[] = [];
  cargando = false;
  filtroProyecto: '' | number = '';
  filtroMz = '';
  filtroLt = '';
  filtroEstado: '' | 'DISPONIBLE' | 'RESERVADO' | 'VENDIDO' = '';
  procesandoId: number | null = null;

  // ── Paginación (el tamaño de página se adapta a la pantalla) ──────────────
  /** Filas/tarjetas por página según el ancho: móvil 6 · tablet 10 · escritorio 15. */
  tamanoPagina = 15;
  private _pagina = 0;
  private timerResize: ReturnType<typeof setTimeout> | null = null;

  // Modal crear/editar
  modalAbierto = false;
  modoEdicion = false;
  loteEditando: Lote | null = null;
  guardando = false;
  form: Lote = this.formVacio();

  // Crear proyecto al vuelo desde el modal de lote
  modalProyectoRapido = false;
  nombreProyectoRapido = '';
  creandoProyectoRapido = false;

  constructor(
    private loteService: LoteService,
    private empresaService: EmpresaService,
    private proyectoService: ProyectoService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.ajustarTamanoPagina();
    this.cargarLotes();
    this.cargarEmpresas();
    this.cargarProyectos();
  }

  ngOnDestroy(): void {
    if (this.timerResize) clearTimeout(this.timerResize);
  }

  cargarLotes(): void {
    this.cargando = true;
    this.loteService.listar().subscribe({
      next: (data) => {
        this.lotes = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.toastr.error('Error al cargar los lotes', 'Error');
      }
    });
  }

  cargarEmpresas(): void {
    this.empresaService.listar().subscribe({
      next: (data) => {
        this.empresas = data;
      },
      error: () => {
        this.toastr.error('Error al cargar las empresas', 'Error');
      }
    });
  }

  cargarProyectos(): void {
    this.proyectoService.listar().subscribe({
      next: (data) => {
        this.proyectos = data;
      },
      error: () => {
        this.toastr.error('Error al cargar los proyectos', 'Error');
      }
    });
  }

  /** Proyectos ACTIVOS de la empresa elegida en el modal. */
  get proyectosDisponibles(): Proyecto[] {
    return this.proyectos.filter(p =>
      p.idEmpresa === this.form.idEmpresa && p.estado !== 'INACTIVO');
  }

  /** Al cambiar de empresa, descarta el proyecto si no pertenece a la nueva. */
  onEmpresaCambiada(): void {
    if (this.form.idProyecto &&
        !this.proyectosDisponibles.some(p => p.id === this.form.idProyecto)) {
      this.form.idProyecto = undefined;
    }
  }

  // ── Crear proyecto al vuelo (desde el modal del lote) ─────────────────────

  abrirProyectoRapido(): void {
    if (!this.form.idEmpresa) {
      this.toastr.warning('Primero seleccione una empresa');
      return;
    }
    this.nombreProyectoRapido = '';
    this.modalProyectoRapido = true;
  }

  cerrarProyectoRapido(): void {
    this.modalProyectoRapido = false;
    this.nombreProyectoRapido = '';
  }

  crearProyectoRapido(): void {
    const nombre = this.nombreProyectoRapido.trim();
    if (!nombre) {
      this.toastr.warning('Escriba el nombre del proyecto');
      return;
    }
    if (this.creandoProyectoRapido) return;
    this.creandoProyectoRapido = true;

    this.proyectoService.crear({
      idEmpresa: this.form.idEmpresa,
      nombre,
      estado: 'ACTIVO'
    }).subscribe({
      next: (creado) => {
        this.creandoProyectoRapido = false;
        this.modalProyectoRapido = false;
        this.nombreProyectoRapido = '';
        this.proyectos = [...this.proyectos, creado];
        this.form.idProyecto = creado.id;
        this.toastr.success('Proyecto creado y seleccionado');
      },
      error: (err) => {
        this.creandoProyectoRapido = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo crear el proyecto', 'Error');
      }
    });
  }

  /** Proyectos para el filtro (ordenados alfabéticamente). */
  get proyectosFiltro(): Proyecto[] {
    return [...this.proyectos].sort((a, b) =>
      (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
  }

  /**
   * Filtro combinado (proyecto + Mz + Lt) aplicado al instante sobre la lista
   * ya descargada, y orden natural: primero manzana, luego número de lote.
   */
  get xFiltrados(): Lote[] {
    let lista = [...this.lotes];

    if (this.filtroProyecto !== '' && this.filtroProyecto != null) {
      lista = lista.filter(l => l.idProyecto === this.filtroProyecto);
    }

    const mz = this.filtroMz.trim().toUpperCase();
    if (mz) {
      lista = lista.filter(l => (l.manzana || '').trim().toUpperCase() === mz);
    }

    const lt = this.filtroLt.trim().toUpperCase();
    if (lt) {
      lista = lista.filter(l => (l.numero || '').trim().toUpperCase() === lt);
    }

    if (this.filtroEstado) {
      lista = lista.filter(l => l.estado === this.filtroEstado);
    }

    return lista.sort((a, b) => {
      const cmpMz = this.compararNatural(a.manzana, b.manzana);
      if (cmpMz !== 0) return cmpMz;
      const cmpLt = this.compararNatural(a.numero, b.numero);
      if (cmpLt !== 0) return cmpLt;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  }

  /** Orden natural: la letra precedes al número, y 2 antes que 10. */
  private compararNatural(a: string, b: string): number {
    return (a || '').trim().localeCompare((b || '').trim(), 'es', {
      numeric: true,
      sensitivity: 'base'
    });
  }

  // ── Paginación (tamaño adaptativo + control de página) ────────────────────

  /** Página vigente, siempre dentro del rango de páginas actuales. */
  get pagina(): number {
    return Math.min(this._pagina, Math.max(0, this.totalPaginas - 1));
  }

  set pagina(n: number) {
    const max = Math.max(0, this.totalPaginas - 1);
    this._pagina = Math.min(Math.max(0, n), max);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.xFiltrados.length / this.tamanoPagina));
  }

  /** Solo los lotes de la página actual. */
  get lotesPagina(): Lote[] {
    const inicio = this.pagina * this.tamanoPagina;
    return this.xFiltrados.slice(inicio, inicio + this.tamanoPagina);
  }

  get rangoInicio(): number {
    return this.xFiltrados.length ? this.pagina * this.tamanoPagina + 1 : 0;
  }

  get rangoFin(): number {
    return Math.min((this.pagina + 1) * this.tamanoPagina, this.xFiltrados.length);
  }

  /** Ventana de números de página (-1 = "…"); primera y última siempre visibles. */
  get ventanaPaginas(): number[] {
    const total = this.totalPaginas;
    const actual = this.pagina;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const elegidos = [...new Set(
      [0, total - 1, actual - 1, actual, actual + 1].filter(n => n >= 0 && n < total)
    )].sort((a, b) => a - b);

    const salida: number[] = [];
    let previo = -2;
    for (const n of elegidos) {
      if (n - previo > 1 && salida.length > 0) salida.push(-1);
      salida.push(n);
      previo = n;
    }
    return salida;
  }

  /** Va a la página indicada (el setter recorta al rango válido). */
  irPagina(n: number): void {
    this.pagina = n;
  }

  /** Al cambiar un filtro se vuelve a la primera página. */
  alCambiarFiltro(): void {
    this.pagina = 0;
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.timerResize) clearTimeout(this.timerResize);
    this.timerResize = setTimeout(() => this.ajustarTamanoPagina(), 150);
  }

  /** Ajusta cuántas filas/tarjetas caben por página según el ancho de ventana. */
  private ajustarTamanoPagina(): void {
    const ancho = typeof window !== 'undefined' ? window.innerWidth : 1024;
    this.tamanoPagina = ancho <= 576 ? 6 : ancho <= 768 ? 10 : 15;
  }

  // ── Cálculo de cuotas (misma lógica que la vista "registrar contrato") ─────

  /** Saldo financiable = max(0, precio − inicial). */
  get saldoCalc(): number {
    return Math.max(0, (this.form.precio || 0) - (this.form.inicial || 0));
  }

  /** Cuota mensual = piso(saldo / n° de cuotas). */
  get cuotaMensual(): number {
    const n = this.form.numCuotas || 0;
    return n > 0 ? Math.floor(this.saldoCalc / n) : 0;
  }

  /** Última cuota: absorbe el residuo (saldo − cuota × (n−1)). */
  get ultimaCuota(): number {
    const n = this.form.numCuotas || 0;
    if (n <= 0) return 0;
    return this.saldoCalc - this.cuotaMensual * (n - 1);
  }

  get tieneResiduo(): boolean {
    return this.ultimaCuota !== this.cuotaMensual;
  }

  formatearMoneda(v: number): string {
    return '$ ' + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(v || 0);
  }

  /** Cuota de un lote de la tabla (usa el saldo guardado). */
  cuotaDe(l: Lote): string {
    const n = l.numCuotas || 0;
    if (n <= 0) return '—';
    const saldo = l.saldo != null
      ? l.saldo
      : Math.max(0, (l.precio || 0) - (l.inicial || 0));
    if (saldo <= 0) return '—';
    return this.formatearMoneda(Math.floor(saldo / n));
  }

  /** Sugiere precio final = área × precio/m² (el usuario puede sobreescribirlo). */
  sugerirPrecio(): void {
    const area = Number(this.form.areaM2) || 0;
    const precioM2 = Number(this.form.precioM2) || 0;
    if (area > 0 && precioM2 > 0) {
      this.form.precio = Math.round(area * precioM2 * 100) / 100;
    }
  }

  // ── Crear / Editar ────────────────────────────────────────────────────────

  abrirCrear(): void {
    this.modoEdicion = false;
    this.loteEditando = null;
    this.form = this.formVacio();
    this.modalAbierto = true;
  }

  abrirEditar(lote: Lote): void {
    this.modoEdicion = true;
    this.loteEditando = lote;
    this.form = { ...lote, estado: lote.estado || 'DISPONIBLE' };
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  guardar(): void {
    if (this.guardando) return;

    if (!this.form.idEmpresa) {
      this.toastr.warning('Seleccione una empresa');
      return;
    }
    if (!this.form.idProyecto) {
      this.toastr.warning('Seleccione un proyecto');
      return;
    }
    if (!this.form.manzana || !this.form.manzana.trim()) {
      this.toastr.warning('La manzana es obligatoria');
      return;
    }
    if (!this.form.numero || !this.form.numero.trim()) {
      this.toastr.warning('El número de lote es obligatorio');
      return;
    }
    if (!this.form.precio || this.form.precio <= 0) {
      this.toastr.warning('El precio debe ser mayor a 0');
      return;
    }
    if (this.form.inicial != null && this.form.inicial > this.form.precio) {
      this.toastr.warning('La inicial no puede superar el precio del lote');
      return;
    }
    if (this.form.numCuotas != null &&
        (this.form.numCuotas < 0 || this.form.numCuotas > 160)) {
      this.toastr.warning('El número de cuotas debe estar entre 0 y 160');
      return;
    }

    this.guardando = true;
    const dto: Lote = {
      idEmpresa: this.form.idEmpresa,
      idProyecto: this.form.idProyecto,
      proyecto: '', // el backend lo resuelve desde idProyecto
      manzana: this.form.manzana,
      numero: this.form.numero,
      descripcion: this.form.descripcion,
      areaM2: this.form.areaM2,
      precioM2: this.form.precioM2,
      precio: this.form.precio,
      inicial: this.form.inicial,
      numCuotas: this.form.numCuotas,
      estado: this.form.estado
    };
    const peticion = this.modoEdicion && this.loteEditando
      ? this.loteService.editar(this.loteEditando.id!, dto)
      : this.loteService.crear(dto);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.modalAbierto = false;
        this.toastr.success(this.modoEdicion ? 'Lote actualizado' : 'Lote creado');
        this.cargarLotes();
      },
      error: (err) => {
        this.guardando = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo guardar el lote', 'Error');
      }
    });
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  eliminar(lote: Lote): void {
    Swal.fire({
      title: 'Eliminar lote',
      html: `¿Eliminar el lote <strong>${lote.proyecto} Mz.${lote.manzana} Lt.${lote.numero}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = lote.id ?? null;
      this.loteService.eliminar(lote.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          this.toastr.success('Lote eliminado');
          this.cargarLotes();
        },
        error: (err) => {
          this.procesandoId = null;
          this.toastr.error(err?.error?.mensaje || 'No se pudo eliminar el lote', 'Error');
        }
      });
    });
  }

  // ── Switch de estado (marcar VENDIDO sin entrar a editar) ─────────────────

  /**
   * Alterna el lote entre VENDIDO y DISPONIBLE desde la tabla.
   * Al marcar VENDIDO pide un motivo opcional (venta de otro vendedor /
   * oficina actualizó el plano). No crea venta en "Mis ventas".
   */
  alternarVendido(lote: Lote, event: Event): void {
    const input = event.target as HTMLInputElement;
    const marcarVendido = input.checked;
    // Revertir el switch hasta que el servidor confirme; Angular lo reajusta
    // solo cuando cambia lote.estado (la expresión del [checked]).
    input.checked = !marcarVendido;

    if (marcarVendido) {
      Swal.fire({
        title: 'Marcar como VENDIDO',
        html: `Lote <strong>${lote.proyecto} Mz.${lote.manzana} Lt.${lote.numero}</strong><br>` +
              `<small>Saldrá de la venta nueva. No se creará una venta en "Mis ventas".</small>`,
        input: 'textarea',
        inputPlaceholder: 'Motivo (opcional). Ej.: venta de otro vendedor, oficina actualizó el plano',
        inputAttributes: { maxlength: '300', 'aria-label': 'Motivo' },
        showCancelButton: true,
        confirmButtonText: 'Marcar vendido',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981'
      }).then((result) => {
        if (!result.isConfirmed) return;
        const motivo = ((result.value as string) || '').trim();
        this.aplicarCambioEstado(lote, 'VENDIDO', motivo || undefined);
      });
    } else {
      Swal.fire({
        title: 'Devolver a DISPONIBLE',
        html: `Lote <strong>${lote.proyecto} Mz.${lote.manzana} Lt.${lote.numero}</strong><br>` +
              `<small>Volverá a estar disponible para venta.</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, devolver',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4f46e5'
      }).then((result) => {
        if (!result.isConfirmed) return;
        this.aplicarCambioEstado(lote, 'DISPONIBLE');
      });
    }
  }

  private aplicarCambioEstado(lote: Lote, estado: string, motivo?: string): void {
    this.procesandoId = lote.id ?? null;
    this.loteService.cambiarEstado(lote.id!, estado, motivo).subscribe({
      next: (actualizado) => {
        this.procesandoId = null;
        lote.estado = actualizado.estado;
        lote.motivoEstado = actualizado.motivoEstado;
        this.toastr.success(
          estado === 'VENDIDO' ? 'Lote marcado como VENDIDO' : 'Lote devuelto a DISPONIBLE');
      },
      error: (err) => {
        this.procesandoId = null;
        this.toastr.error(err?.error?.mensaje || 'No se pudo cambiar el estado', 'Error');
        this.cargarLotes(); // resincroniza el switch con el estado real
      }
    });
  }

  // ── Separaciones (reservas con plazo) ────────────────────────────────────
  modalSeparacion = false;
  loteSeparando: Lote | null = null;
  separando = false;
  /** 15 días = $50 · 1 mes = $100 (se pueden ajustar). */
  readonly separacionPresets = [
    { dias: 15, monto: 50, etiqueta: '15 días · $50' },
    { dias: 30, monto: 100, etiqueta: '1 mes · $100' }
  ];
  sepFechaVence = '';
  sepMonto: number | null = null;
  sepAjena = false;
  sepNota = '';

  /** Abre el diálogo de separación para un lote disponible. */
  abrirSeparar(lote: Lote): void {
    if (lote.estado === 'VENDIDO' || lote.ventaActiva) {
      this.toastr.warning('Ese lote ya está vendido o tiene una venta activa');
      return;
    }
    this.loteSeparando = lote;
    this.sepAjena = false;
    this.sepNota = '';
    this.aplicarPreset(this.separacionPresets[0]);
    this.modalSeparacion = true;
  }

  /** Fecha límite para un plazo dado (hoy + n días), en formato yyyy-MM-dd. */
  fechaDesde(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  /** Atajo de plazo: 15 días ($50) o 1 mes ($100). */
  aplicarPreset(preset: { dias: number; monto: number }): void {
    this.sepFechaVence = this.fechaDesde(preset.dias);
    this.sepMonto = preset.monto;
  }

  cerrarSeparar(): void {
    this.modalSeparacion = false;
    this.loteSeparando = null;
  }

  confirmarSeparar(): void {
    if (!this.loteSeparando || this.separando) return;
    if (!this.sepFechaVence) {
      this.toastr.warning('Indique la fecha de vencimiento');
      return;
    }
    const dto: LoteSeparacion = {
      fechaVence: this.sepFechaVence,
      monto: this.sepMonto ?? undefined,
      ajena: this.sepAjena,
      nota: this.sepNota?.trim() || undefined
    };
    this.separando = true;
    this.loteService.separar(this.loteSeparando.id!, dto).subscribe({
      next: (actualizado) => {
        this.separando = false;
        this.cerrarSeparar();
        this.toastr.success(
          this.sepAjena ? 'Separación ajena registrada' : 'Lote separado');
        this.lotes = this.lotes.map(l => l.id === actualizado.id ? actualizado : l);
      },
      error: (err) => {
        this.separando = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo separar el lote', 'Error');
      }
    });
  }

  /** Libera una separación: el lote vuelve a DISPONIBLE. */
  liberarSeparacion(lote: Lote): void {
    Swal.fire({
      title: 'Liberar separación',
      html: `¿Liberar el lote <strong>${lote.proyecto} Mz.${lote.manzana} Lt.${lote.numero}</strong>?<br>` +
            `<small>Volverá a estar disponible.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, liberar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = lote.id ?? null;
      this.loteService.liberarSeparacion(lote.id!).subscribe({
        next: (actualizado) => {
          this.procesandoId = null;
          this.toastr.success('Separación liberada');
          this.lotes = this.lotes.map(l => l.id === actualizado.id ? actualizado : l);
        },
        error: (err) => {
          this.procesandoId = null;
          this.toastr.error(err?.error?.mensaje || 'No se pudo liberar la separación', 'Error');
        }
      });
    });
  }

  /** Días que faltan para que venza la separación (negativo = vencida). */
  diasRestantes(lote: Lote): number {
    if (!lote.fechaVinceSeparacion) return 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(lote.fechaVinceSeparacion + 'T00:00:00');
    return Math.round((fin.getTime() - hoy.getTime()) / 86400000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formVacio(): Lote {
    return {
      idEmpresa: 0,
      idProyecto: undefined,
      proyecto: '',
      manzana: '',
      numero: '',
      descripcion: '',
      areaM2: undefined,
      precioM2: undefined,
      precio: 0,
      inicial: undefined,
      saldo: undefined,
      numCuotas: 150,
      estado: 'DISPONIBLE'
    };
  }
}
