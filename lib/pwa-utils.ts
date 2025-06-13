// Simplified PWA utilities for deployment

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

// PWA Installation
export class PWAInstaller {
  private deferredPrompt: BeforeInstallPromptEvent | null = null
  private isInstalled = false

  constructor() {
    if (typeof window !== "undefined") {
      this.init()
    }
  }

  private init() {
    // Listen for beforeinstallprompt event
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault()
      this.deferredPrompt = e as BeforeInstallPromptEvent
    })

    // Check if app is already installed
    window.addEventListener("appinstalled", () => {
      this.isInstalled = true
      this.deferredPrompt = null
    })

    // Check if running in standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches) {
      this.isInstalled = true
    }
  }

  canInstall(): boolean {
    return !!this.deferredPrompt && !this.isInstalled
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false
    }

    try {
      await this.deferredPrompt.prompt()
      const { outcome } = await this.deferredPrompt.userChoice

      if (outcome === "accepted") {
        this.deferredPrompt = null
        return true
      }

      return false
    } catch (error) {
      console.error("Installation failed:", error)
      return false
    }
  }

  isAppInstalled(): boolean {
    return this.isInstalled
  }
}

// Simplified Notification Manager
export class NotificationManager {
  async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === "granted"
  }

  async getSubscription(): Promise<PushSubscription | null> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return null
    }

    try {
      const registration = await navigator.serviceWorker.ready
      return registration.pushManager.getSubscription()
    } catch (error) {
      console.error("Failed to get subscription:", error)
      return null
    }
  }

  // Schedule local notifications
  scheduleReminder(title: string, body: string, delay: number) {
    setTimeout(() => {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/icon-192x192.png",
          badge: "/icon-72x72.png",
        })
      }
    }, delay)
  }
}

// Network status
export class NetworkManager {
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true
  private listeners: ((online: boolean) => void)[] = []

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.isOnline = true
        this.notifyListeners()
      })

      window.addEventListener("offline", () => {
        this.isOnline = false
        this.notifyListeners()
      })
    }
  }

  getStatus(): boolean {
    return this.isOnline
  }

  onStatusChange(callback: (online: boolean) => void) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback)
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.isOnline))
  }
}

// Simplified Camera Manager
export class CameraManager {
  async hasCamera(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return false
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.some((device) => device.kind === "videoinput")
    } catch {
      return false
    }
  }

  async requestCameraPermission(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch {
      return false
    }
  }
}

// Export singleton instances with safety checks
export const pwaInstaller = typeof window !== "undefined" ? new PWAInstaller() : null
export const notificationManager = new NotificationManager()
export const networkManager = new NetworkManager()
export const cameraManager = new CameraManager()
