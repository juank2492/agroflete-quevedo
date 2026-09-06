import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class UiFeedbackService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  private push(kind: ToastKind, text: string, ms = 4500): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  success(text: string): void {
    this.push('success', text);
  }
  error(text: string): void {
    this.push('error', text, 6000);
  }
  info(text: string): void {
    this.push('info', text);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
