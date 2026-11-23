import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';
import { ProyectoService, Proyecto } from '../../services/proyecto.service';
import { EmpresaService, Empresa } from '../../services/empresa.service';
import { AlertService } from '../../services/alert.service';
import {
  SearchableSelectComponent,
  SelectOption
} from '../../components/searchable-select/searchable-select.component';
import * as L from 'leaflet';

@Component({
  selector: 'app-proyectos',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  templateUrl: './proyectos.component.html',
  styleUrl: './proyectos.component.scss'
})
export class ProyectosComponent implements OnInit, OnDestroy {

  proyectos: Proyecto[] = [];
  empresas: Empresa[] = [];
  cargando = false;
  terminoBusqueda = '';
  filtroEmpresa: '' | number = '';
  procesandoId: number | null = null;

  // Miniaturas de plano (objectURL por id)
  planoUrls: Record<number, string> = {};
  /** Content-Type del plano (image/*, application/pdf, 'error' si falló la descarga). */
  planoTipos: Record<number, string> = {};

  // Modal crear/editar
  modalAbierto = false;
  modoEdicion = false;
  proyectoEditando: Proyecto | null = null;
  guardando = false;
  form: Proyecto = this.formVacio();

  // Plano en el modal
  archivoNuevo: File | null = null;
  previewUrl: string | null = null;
  previewUrlSafe: SafeResourceUrl | null = null;
  previewEsImagen = false;
  previewMime = '';
  previewNombre = '';
  planoActualVisible = false;
  quitarPlano = false;

  // Editor de recorte (patrón voucher-preview: canvas propio, sin librerías)
  @ViewChild('editorCanvasEl') editorCanvasEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('editorOverlayEl') editorOverlayEl!: ElementRef<HTMLDivElement>;
  editandoRecorte = false;
  recorte = { x: 0, y: 0, w: 0, h: 0 };
  girando = 0;
  private imgRecorte: HTMLImageElement | null = null;
  private imgVista: HTMLCanvasElement | null = null;
  private dibujo = { w: 0, h: 0, offX: 0, offY: 0, cw: 0, ch: 0 };
  private arrastre: {
    modo: string; x0: number; y0: number;
    base: { x: number; y: number; w: number; h: number };
  } | null = null;

  // Mapa interactivo (Leaflet): click en el mapa = fijar punto + dirección
  @ViewChild('mapaEl') mapaEl!: ElementRef<HTMLDivElement>;
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private ubicacionGeocodificada = '';
  buscando = false;

  constructor(
    private proyectoService: ProyectoService,
    private empresaService: EmpresaService,
    private sanitizer: DomSanitizer,
    private alert: AlertService
  ) { }

  ngOnInit(): void {
    this.cargarProyectos();
    this.cargarEmpresas();
  }

  ngOnDestroy(): void {
    this.destruirMapa();
    Object.values(this.planoUrls).forEach(u => URL.revokeObjectURL(u));
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
  }

  cargarProyectos(): void {
    this.cargando = true;
    this.proyectoService.listar().subscribe({
      next: (data) => {
        this.proyectos = data;
        this.cargando = false;
        this.cargarMiniaturas();
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('Error al cargar los proyectos', 'Error');
      }
    });
  }

  private cargarMiniaturas(): void {
    this.proyectos
      .filter(p => p.tienePlano && p.id != null)
      .forEach(p => {
        if (this.planoTipos[p.id!] !== undefined) return;
        this.proyectoService.descargarPlano(p.id!).subscribe({
          next: (blob) => {
            if (p.id == null) return;
            this.planoTipos[p.id] = blob.type || 'desconocido';
            // Solo las imágenes sirven en <img>; los PDF muestran el ícono representativo
            if (blob.type.startsWith('image/')) {
              this.planoUrls[p.id] = URL.createObjectURL(blob);
            }
          },
          error: () => {
            if (p.id != null) this.planoTipos[p.id] = 'error';
          }
        });
      });
  }

  /** ¿Ya llegó el blob del plano (imagen o PDF)? */
  planoCargado(p: Proyecto): boolean {
    return p.id != null && this.planoTipos[p.id] !== undefined;
  }

  /** Miniatura real solo si el plano es una imagen. */
  planoEsImagen(id?: number): boolean {
    return id != null && (this.planoTipos[id] || '').startsWith('image/');
  }

  cargarEmpresas(): void {
    this.empresaService.listar().subscribe({
      next: (data) => { this.empresas = data; },
      error: () => { this.alert.toastError('Error al cargar las empresas', 'Error'); }
    });
  }

  get xFiltrados(): Proyecto[] {
    let lista = this.proyectos;
    if (this.filtroEmpresa !== '' && this.filtroEmpresa != null) {
      lista = lista.filter(p => p.idEmpresa === this.filtroEmpresa);
    }
    if (!this.terminoBusqueda.trim()) return lista;
    const t = this.terminoBusqueda.toLowerCase();
    return lista.filter(p =>
      (p.nombre || '').toLowerCase().includes(t) ||
      (p.ubicacion || '').toLowerCase().includes(t)
    );
  }

  nombreEmpresa(idEmpresa: number): string {
    const emp = this.empresas.find(e => e.id === idEmpresa);
    return emp ? emp.razonSocial : '—';
  }

  // ── Crear / Editar ────────────────────────────────────────────────────────

  abrirCrear(): void {
    this.modoEdicion = false;
    this.proyectoEditando = null;
    this.form = this.formVacio();
    this.prepararPlano(null, false, false);
    this.ubicacionGeocodificada = '';
    this.modalAbierto = true;
    this.abrirMapa();
  }

  abrirEditar(p: Proyecto): void {
    this.modoEdicion = true;
    this.proyectoEditando = p;
    this.form = { ...p };
    this.prepararPlano(null, !!p.tienePlano, false);
    this.ubicacionGeocodificada = p.ubicacion || '';
    this.modalAbierto = true;
    this.abrirMapa();

    // Preview completo del plano actual (el Content-Type del blob dice si es imagen o PDF)
    if (p.tienePlano && p.id != null) {
      this.proyectoService.descargarPlano(p.id).subscribe({
        next: (blob) => {
          const ext = blob.type === 'image/png' ? 'png'
            : blob.type === 'image/webp' ? 'webp'
            : blob.type === 'application/pdf' ? 'pdf' : 'jpg';
          this.asignarPreview(
            URL.createObjectURL(blob),
            blob.type.startsWith('image/'),
            blob.type,
            `plano-${p.id}.${ext}`
          );
        },
        error: () => { }
      });
    }
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.destruirMapa();
    this.cancelarEditor();
    this.asignarPreview(null, false);
    this.archivoNuevo = null;
    this.quitarPlano = false;
  }

  get empresaOptions(): SelectOption[] {
    return this.empresas
      .filter(e => e.id != null)
      .map(e => ({ id: e.id!, label: e.razonSocial, badge: e.ruc }));
  }

  async guardar(): Promise<void> {
    if (this.guardando) return;

    if (!this.form.idEmpresa) {
      this.alert.toastWarning('Seleccione una empresa');
      return;
    }
    if (!this.form.nombre || !this.form.nombre.trim()) {
      this.alert.toastWarning('El nombre del proyecto es obligatorio');
      return;
    }

    if (this.modoEdicion) {
      const ok = await this.alert.confirmarEdicion(
        `¿Guardar los cambios de <strong>${this.form.nombre}</strong>?`);
      if (!ok) return;
    }

    this.guardando = true;
    const dto: Proyecto = {
      idEmpresa: this.form.idEmpresa,
      nombre: this.form.nombre.trim(),
      ubicacion: this.form.ubicacion?.trim() || undefined,
      latitud: this.form.latitud ?? undefined,
      longitud: this.form.longitud ?? undefined,
      estado: this.form.estado || 'ACTIVO'
    };

    const peticion = this.modoEdicion && this.proyectoEditando
      ? this.proyectoService.editar(this.proyectoEditando.id!, dto)
      : this.proyectoService.crear(dto);

    peticion.subscribe({
      next: (creado) => {
        this.postGuardar(creado.id!);
      },
      error: (err) => {
        this.guardando = false;
        this.alert.toastError(err?.error?.mensaje || 'No se pudo guardar el proyecto', 'Error');
      }
    });
  }

  private postGuardar(id: number): void {
    const ops: Array<{ obs: Observable<any> }> = [];

    if (this.archivoNuevo) {
      ops.push({ obs: this.proyectoService.subirPlano(id, this.archivoNuevo) });
    } else if (this.modoEdicion && this.quitarPlano && this.proyectoEditando?.tienePlano) {
      ops.push({ obs: this.proyectoService.borrarPlano(id) });
    }

    if (ops.length === 0) {
      this.finalizarGuardado();
      return;
    }

    // Secuencia: primero subir/borrar plano, luego cerrar
    ops[0].obs.subscribe({
      next: () => this.finalizarGuardado(),
      error: (err) => {
        this.guardando = false;
        this.alert.toastError(err?.error?.mensaje || 'No se pudo guardar el plano', 'Error');
      }
    });
  }

  private finalizarGuardado(): void {
    this.guardando = false;
    this.modalAbierto = false;
    this.destruirMapa();
    this.cancelarEditor();
    this.asignarPreview(null, false);
    this.archivoNuevo = null;
    this.alert.success(this.modoEdicion ? 'Proyecto actualizado' : 'Proyecto creado');
    this.cargarProyectos();
  }

  // ── Plano ─────────────────────────────────────────────────────────────────

  private asignarPreview(url: string | null, esImagen: boolean, mime = '', nombre = ''): void {
    if (this.previewUrl && this.previewUrl !== url) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = url;
    this.previewUrlSafe = url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
    this.previewEsImagen = esImagen;
    this.previewMime = mime;
    this.previewNombre = nombre;
  }

  private prepararPlano(preview: string | null, visible: boolean, esImagen: boolean): void {
    this.archivoNuevo = null;
    this.asignarPreview(preview, esImagen);
    this.planoActualVisible = visible;
    this.quitarPlano = false;
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    const ext = archivo.name.split('.').pop()?.toLowerCase() || '';
    if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) {
      this.alert.toastWarning('Formato no válido: use JPG, PNG, WebP o PDF');
      input.value = '';
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      this.alert.toastWarning('El plano no puede superar 10 MB');
      input.value = '';
      return;
    }

    this.archivoNuevo = archivo;
    this.asignarPreview(
      URL.createObjectURL(archivo),
      ['jpg', 'jpeg', 'png', 'webp'].includes(ext),
      archivo.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      archivo.name
    );
    this.quitarPlano = false;
  }

  quitarPlanoSeleccionado(): void {
    this.asignarPreview(null, false);
    this.archivoNuevo = null;
    this.quitarPlano = true;
    this.planoActualVisible = false;
  }

  abrirPlanoCompleto(): void {
    if (this.previewUrl) window.open(this.previewUrl, '_blank');
  }

  verPlano(p: Proyecto): void {
    if (p.id == null) return;
    const url = this.planoUrls[p.id];
    if (url) {
      window.open(url, '_blank');
      return;
    }
    this.proyectoService.descargarPlano(p.id).subscribe({
      next: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
      error: () => this.alert.toastWarning('No se pudo abrir el plano')
    });
  }

  // ── Editor de recorte (canvas propio, sin librerías) ──────────────────────

  abrirEditorRecorte(): void {
    if (!this.previewUrl || !this.previewEsImagen || this.editandoRecorte) return;
    const img = new Image();
    img.onload = () => {
      this.imgRecorte = img;
      this.girando = 0;
      this.construirVista();
      this.editandoRecorte = true;
      setTimeout(() => this.prepararDibujo(), 0);
    };
    img.onerror = () => this.alert.toastError('No se pudo cargar la imagen para recortar');
    img.src = this.previewUrl;
  }

  // Imagen de trabajo con la rotación aplicada (la original no se toca hasta Aplicar)
  private construirVista(): void {
    const img = this.imgRecorte;
    if (!img) return;
    const swap = this.girando % 180 !== 0;
    const w = swap ? img.naturalHeight : img.naturalWidth;
    const h = swap ? img.naturalWidth : img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this.girando * Math.PI / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    this.imgVista = c;
  }

  private prepararDibujo(): void {
    const canvas = this.editorCanvasEl?.nativeElement;
    if (!canvas || !this.imgVista) return;
    const wrap = canvas.parentElement;
    const cw = Math.max(240, Math.min((wrap?.clientWidth || 620), 640));
    const ch = 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);

    const iw = this.imgVista.width;
    const ih = this.imgVista.height;
    const esc = Math.min(cw / iw, ch / ih);
    this.dibujo = {
      w: iw * esc, h: ih * esc,
      offX: (cw - iw * esc) / 2, offY: (ch - ih * esc) / 2,
      cw, ch
    };
    // Marco inicial: toda el área de la imagen
    this.recorte = { x: this.dibujo.offX, y: this.dibujo.offY, w: this.dibujo.w, h: this.dibujo.h };
    this.dibujarEditor();
  }

  private dibujarEditor(): void {
    const canvas = this.editorCanvasEl?.nativeElement;
    if (!canvas || !this.imgVista) return;
    const ctx = canvas.getContext('2d')!;
    const cw = this.dibujo.cw || parseFloat(canvas.style.width);
    const ch = this.dibujo.ch || parseFloat(canvas.style.height);
    const dpr = canvas.width / cw;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(this.imgVista, this.dibujo.offX, this.dibujo.offY, this.dibujo.w, this.dibujo.h);
  }

  onEditorDown(e: PointerEvent, modo: string): void {
    e.preventDefault();
    e.stopPropagation();
    if (!this.imgVista || !this.editorOverlayEl) return;
    this.arrastre = {
      modo,
      x0: e.clientX,
      y0: e.clientY,
      base: { ...this.recorte }
    };
    this.editorOverlayEl.nativeElement.setPointerCapture?.(e.pointerId);
  }

  onEditorMove(e: PointerEvent): void {
    const a = this.arrastre;
    if (!a) return;
    const dx = e.clientX - a.x0;
    const dy = e.clientY - a.y0;
    const { offX, offY, w: dw, h: dh } = this.dibujo;
    const MIN = 40;
    let x1 = a.base.x, y1 = a.base.y;
    let x2 = a.base.x + a.base.w, y2 = a.base.y + a.base.h;

    if (a.modo === 'mover') {
      x1 = this.clamp(a.base.x + dx, offX, offX + dw - a.base.w);
      y1 = this.clamp(a.base.y + dy, offY, offY + dh - a.base.h);
      x2 = x1 + a.base.w;
      y2 = y1 + a.base.h;
    } else {
      if (a.modo.includes('w')) x1 = a.base.x + dx; else x2 = a.base.x + a.base.w + dx;
      if (a.modo.includes('n')) y1 = a.base.y + dy; else y2 = a.base.y + a.base.h + dy;
      x1 = this.clamp(x1, offX, x2 - MIN);
      x2 = this.clamp(x2, x1 + MIN, offX + dw);
      y1 = this.clamp(y1, offY, y2 - MIN);
      y2 = this.clamp(y2, y1 + MIN, offY + dh);
    }
    this.recorte = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  onEditorEnd(e: PointerEvent): void {
    if (!this.arrastre) return;
    this.arrastre = null;
    this.editorOverlayEl?.nativeElement.releasePointerCapture?.(e.pointerId);
  }

  girarEditor(): void {
    if (!this.imgRecorte) return;
    this.girando = (this.girando + 90) % 360;
    this.construirVista();
    this.prepararDibujo();
  }

  aplicarRecorte(): void {
    const vista = this.imgVista;
    if (!vista || !this.previewNombre && !this.previewUrl) return;
    const escala = this.dibujo.w / vista.width;
    const sx = Math.max(0, Math.round((this.recorte.x - this.dibujo.offX) / escala));
    const sy = Math.max(0, Math.round((this.recorte.y - this.dibujo.offY) / escala));
    const sw = Math.min(vista.width - sx, Math.round(this.recorte.w / escala));
    const sh = Math.min(vista.height - sy, Math.round(this.recorte.h / escala));
    if (sw < 1 || sh < 1) {
      this.alert.toastWarning('El área de recorte es demasiado pequeña');
      return;
    }

    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    out.getContext('2d')!.drawImage(vista, sx, sy, sw, sh, 0, 0, sw, sh);

    const mime = this.previewMime.startsWith('image/') ? this.previewMime : 'image/jpeg';
    const nombre = this.previewNombre || 'plano.jpg';
    out.toBlob((blob) => {
      if (!blob) {
        this.alert.toastError('No se pudo generar el recorte', 'Error');
        return;
      }
      this.archivoNuevo = new File([blob], nombre, { type: mime });
      this.asignarPreview(URL.createObjectURL(this.archivoNuevo), true, mime, nombre);
      this.quitarPlano = false;
      this.cancelarEditor();
      this.alert.toastSuccess('Recorte aplicado — recuerda guardar el proyecto');
    }, mime, 0.92);
  }

  cancelarEditor(): void {
    this.editandoRecorte = false;
    this.arrastre = null;
    this.imgRecorte = null;
    this.imgVista = null;
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
  }

  // ── Mapa interactivo (Leaflet): click = fijar punto + dirección ───────────

  /** Crea el mapa cuando el modal ya está en pantalla. */
  private abrirMapa(): void {
    setTimeout(() => this.initMapa(), 0);
  }

  private initMapa(): void {
    this.destruirMapa();
    const div = this.mapaEl?.nativeElement;
    if (!div) return;

    this.map = L.map(div, { zoomControl: true, attributionControl: true })
      .setView([-12.0464, -77.0428], 12); // Lima por defecto

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    // Click en el mapa: fija el punto y completa la dirección
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.form.latitud = e.latlng.lat;
      this.form.longitud = e.latlng.lng;
      this.ponerMarcador(e.latlng.lat, e.latlng.lng);
      this.reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    this.sincronizarMapa();
  }

  private destruirMapa(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.marker = null;
  }

  /** Centra en las coordenadas del formulario y muestra el pin (si existen). */
  private sincronizarMapa(): void {
    if (!this.map) return;
    const lat = this.form.latitud;
    const lng = this.form.longitud;
    if (lat != null && lng != null) {
      this.map.setView([lat, lng], 16);
      this.ponerMarcador(lat, lng);
    }
  }

  private ponerMarcador(lat: number, lng: number): void {
    if (!this.map) return;
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
      return;
    }
    this.marker = L.marker([lat, lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'mapa-pin',
        iconSize: [30, 40],
        iconAnchor: [15, 38],
        html: '<i class="fas fa-map-marker-alt"></i>'
      })
    }).addTo(this.map);
    this.marker.on('dragend', () => {
      const p = this.marker!.getLatLng();
      this.form.latitud = p.lat;
      this.form.longitud = p.lng;
      this.reverseGeocode(p.lat, p.lng);
    });
  }

  /** Click o arrastre del pin → completa la dirección del punto elegido. */
  private reverseGeocode(lat: number, lng: number): void {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&lat=${lat}&lon=${lng}`)
      .then(r => r.json())
      .then((r: any) => {
        if (r?.display_name) {
          this.form.ubicacion = r.display_name;
          this.ubicacionGeocodificada = r.display_name;
        }
      })
      .catch(() => { /* sin dirección: quedan las coordenadas */ });
  }

  // Editar el texto a mano invalida las coordenadas previas (debe volver a Buscar)
  onUbicacionEditada(): void {
    if ((this.form.ubicacion || '').trim() !== this.ubicacionGeocodificada) {
      this.form.latitud = undefined;
      this.form.longitud = undefined;
      this.marker?.remove();
      this.marker = null;
    }
  }

  buscarDireccion(): void {
    const q = (this.form.ubicacion || '').trim();
    if (!q) {
      this.alert.toastWarning('Escriba una dirección para buscar');
      return;
    }
    if (this.buscando) return;
    this.buscando = true;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then((res: any[]) => {
        this.buscando = false;
        if (!res || res.length === 0) {
          this.alert.toastWarning('Dirección no encontrada');
          return;
        }
        const r = res[0];
        this.form.latitud = parseFloat(r.lat);
        this.form.longitud = parseFloat(r.lon);
        this.form.ubicacion = r.display_name as string;
        this.ubicacionGeocodificada = this.form.ubicacion;
        this.sincronizarMapa();
      })
      .catch(() => {
        this.buscando = false;
        this.alert.toastError('No se pudo buscar la dirección', 'Error');
      });
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  eliminar(p: Proyecto): void {
    Swal.fire({
      title: 'Eliminar proyecto',
      html: `¿Eliminar el proyecto <strong>${p.nombre}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = p.id ?? null;
      this.proyectoService.eliminar(p.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          if (p.id != null) {
            if (this.planoUrls[p.id]) URL.revokeObjectURL(this.planoUrls[p.id]);
            delete this.planoUrls[p.id];
            delete this.planoTipos[p.id];
          }
          this.alert.success('Proyecto eliminado');
          this.cargarProyectos();
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo eliminar el proyecto', 'Error');
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formVacio(): Proyecto {
    return {
      idEmpresa: 0,
      nombre: '',
      ubicacion: '',
      estado: 'ACTIVO'
    };
  }
}