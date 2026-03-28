import { Injectable } from '@angular/core'

export interface ToastHandler {
  toastType: 'positive' | 'negative'
  showToast(message: string): void
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastComponent: ToastHandler | null = null

  registerToast(toastComponent: ToastHandler): void {
    this.toastComponent = toastComponent
  }

  showPositiveToast(message: string): void {
    if (this.toastComponent) {
      this.toastComponent.toastType = 'positive'
      this.toastComponent.showToast(message)
    }
  }

  showNegativeToast(message: string): void {
    if (this.toastComponent) {
      this.toastComponent.toastType = 'negative'
      this.toastComponent.showToast(message)
    }
  }
}
