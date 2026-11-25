import { Component, Input, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="theme-toggle"
      [class.compact]="compact"
      (click)="theme.toggle()"
      [attr.aria-label]="theme.dark() ? 'Activar modo claro' : 'Activar modo noche'"
      [attr.title]="theme.dark() ? 'Modo claro' : 'Modo noche'"
      [attr.aria-pressed]="theme.dark()">
      <i
        class="fas"
        [class.fa-sun]="theme.dark()"
        [class.fa-moon]="!theme.dark()"
        aria-hidden="true"></i>
    </button>
  `,
  styles: [`
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .theme-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text-2);
      font-size: 0.95rem;
      cursor: pointer;
      transition: background-color 0.18s ease, border-color 0.18s ease,
        color 0.18s ease, transform 0.16s ease;

      &:hover {
        border-color: var(--brand-soft);
        background: var(--brand-bg);
        color: var(--brand);
      }

      &:active {
        transform: scale(0.96);
      }

      &:focus-visible {
        outline: 2px solid var(--brand);
        outline-offset: 2px;
      }

      &.compact {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        font-size: 0.85rem;
      }
    }
  `]
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);

  @Input() compact = false;
}
