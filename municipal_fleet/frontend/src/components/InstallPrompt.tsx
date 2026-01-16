import { useState, useEffect } from "react";
import { Download, X, Wifi, WifiOff, RefreshCw, CheckCircle } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { usePendingCount } from "../stores/offlineStore";
import "./InstallPrompt.css";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const { isOnline, isSyncing, syncError, pendingCount, syncPendingActions } = useOnlineStatus();

    // Listen for install prompt
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Show banner after short delay
            setTimeout(() => setShowInstallBanner(true), 3000);
        };

        window.addEventListener("beforeinstallprompt", handler);

        // Check if already installed
        if (window.matchMedia("(display-mode: standalone)").matches) {
            setIsInstalled(true);
        }

        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    // Handle install
    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
            setIsInstalled(true);
            setShowInstallBanner(false);
        }

        setDeferredPrompt(null);
    };

    // Handle dismiss
    const handleDismiss = () => {
        setShowInstallBanner(false);
        // Store dismissal to avoid showing again this session
        sessionStorage.setItem("pwa-install-dismissed", "true");
    };

    // Don't show if dismissed this session
    useEffect(() => {
        if (sessionStorage.getItem("pwa-install-dismissed") === "true") {
            setShowInstallBanner(false);
        }
    }, []);

    const shouldShowStatusBar = !isOnline || pendingCount > 0;

    return (
        <>
            {/* Offline Status Bar */}
            {shouldShowStatusBar && (
                <div className={`pwa-status-bar ${!isOnline ? "offline" : pendingCount > 0 ? "pending" : "online"}`}>
                    <div className="pwa-status-content">
                        {!isOnline ? (
                            <>
                                <WifiOff size={16} />
                                <span>Modo offline</span>
                                {pendingCount > 0 && (
                                    <span className="pwa-pending-badge">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</span>
                                )}
                            </>
                        ) : pendingCount > 0 ? (
                            <>
                                <Wifi size={16} />
                                <span>{isSyncing ? "Sincronizando..." : `${pendingCount} ação(ões) pendente(s)`}</span>
                                {!isSyncing && (
                                    <button className="pwa-sync-btn" onClick={syncPendingActions}>
                                        <RefreshCw size={14} />
                                        Sincronizar
                                    </button>
                                )}
                                {isSyncing && <RefreshCw size={14} className="pwa-spinning" />}
                            </>
                        ) : null}
                    </div>
                    {syncError && <div className="pwa-sync-error">{syncError}</div>}
                </div>
            )}

            {/* Install Banner */}
            {showInstallBanner && !isInstalled && deferredPrompt && (
                <div className="pwa-install-banner">
                    <div className="pwa-install-content">
                        <div className="pwa-install-icon">
                            <Download size={24} />
                        </div>
                        <div className="pwa-install-text">
                            <strong>Instalar Portal do Motorista</strong>
                            <span>Acesse mais rápido e use offline</span>
                        </div>
                        <div className="pwa-install-actions">
                            <button className="pwa-install-btn" onClick={handleInstall}>
                                Instalar
                            </button>
                            <button className="pwa-dismiss-btn" onClick={handleDismiss}>
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
