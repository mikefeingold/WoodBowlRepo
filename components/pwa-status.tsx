"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, WifiOff, Smartphone, X } from "lucide-react"
import { pwaInstaller, networkManager } from "@/lib/pwa-utils"

export default function PWAStatus() {
  const [canInstall, setCanInstall] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [showOfflineBanner, setShowOfflineBanner] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (typeof window === "undefined") return

    // Check installation status
    if (pwaInstaller) {
      setCanInstall(pwaInstaller.canInstall())
    }

    // Monitor network status
    setIsOnline(networkManager.getStatus())
    const unsubscribeNetwork = networkManager.onStatusChange((online) => {
      setIsOnline(online)
      if (!online) {
        setShowOfflineBanner(true)
      }
    })

    // Show install prompt after delay if not installed
    const timer = setTimeout(() => {
      if (pwaInstaller && pwaInstaller.canInstall() && !pwaInstaller.isAppInstalled()) {
        setShowInstallPrompt(true)
      }
    }, 10000) // Show after 10 seconds

    return () => {
      unsubscribeNetwork()
      clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (!pwaInstaller) return

    const success = await pwaInstaller.install()
    if (success) {
      setCanInstall(false)
      setShowInstallPrompt(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <>
      {/* Offline Banner */}
      {showOfflineBanner && !isOnline && (
        <div className="fixed top-16 left-4 right-4 z-40">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    You're offline. Changes will sync when connection is restored.
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowOfflineBanner(false)} className="h-6 w-6">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Install Prompt */}
      {showInstallPrompt && canInstall && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-blue-900">Install Bowl Tracker</div>
                    <div className="text-sm text-blue-700">Add to your home screen for quick access</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowInstallPrompt(false)}>
                    Later
                  </Button>
                  <Button size="sm" onClick={handleInstall} className="bg-blue-600 hover:bg-blue-700">
                    <Download className="w-4 h-4 mr-1" />
                    Install
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
