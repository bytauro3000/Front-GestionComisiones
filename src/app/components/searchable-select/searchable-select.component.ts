import {
  Component,
  ElementRef,
  HostListener,
  Input,
  forwardRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  id: number | string;
  label: string;
  sub?: string;
  badge?: string;
  /** Texto adicional para búsqueda (no se muestra). */
  keywords?: string;
}

/**
 * Select con búsqueda (mismo patrón que la vista "Nueva venta"):
 * - Al enfocar muestra la lista completa y selecciona el texto.
 * - Filtra mientras se escribe.
 * - Funciona con [(ngModel)].
 */
@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ]
})
export class SearchableSelectComponent implements ControlValueAccessor {

  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Buscar...';
  @Input() emptyText = 'Sin resultados';
  @Input() disabled = false;

  value: number | string | null = null;
  filtro = '';
  abierto = false;

  private onChange: (v: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>) {}

  get seleccionado(): SelectOption | undefined {
    return this.options.find(o => o.id === this.value);
  }

  get display(): string {
    if (this.abierto) return this.filtro;
    return this.seleccionado?.label || '';
  }

  get filtrados(): SelectOption[] {
    const t = this.filtro.trim().toLowerCase();
    if (!t) return this.options;
    return this.options.filter(o =>
      o.label.toLowerCase().includes(t) ||
      (o.sub || '').toLowerCase().includes(t) ||
      (o.badge || '').toLowerCase().includes(t) ||
      (o.keywords || '').toLowerCase().includes(t)
    );
  }

  writeValue(value: any): void {
    this.value = value ?? null;
  }

  registerOnChange(fn: (v: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  abrir(): void {
    if (this.disabled) return;
    this.abierto = true;
    this.filtro = this.seleccionado?.label || '';
    setTimeout(() => {
      const input = this.host.nativeElement.querySelector('input') as HTMLInputElement | null;
      input?.select();
    });
  }

  onInput(event: Event): void {
    this.abierto = true;
    this.filtro = (event.target as HTMLInputElement).value;
  }

  seleccionar(opcion: SelectOption): void {
    this.value = opcion.id;
    this.onChange(opcion.id);
    this.onTouched();
    this.cerrar();
  }

  cerrar(): void {
    this.abierto = false;
    this.filtro = '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.abierto && !this.host.nativeElement.contains(event.target as Node)) {
      this.cerrar();
    }
  }
}
