import { useState, useEffect, useCallback } from "react";
import { useOfflineStore } from "../stores/offlineStore";
import { driverPortalApi } from "../lib/api";

/**
 * Hook to detect online/offline status and manage sync
 */
export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const {
        pendingActions,
        removeAction,
        setSyncing,
        setSyncError,
        updateLastSync,
        isSyncing,
        syncError,
        lastSyncAt,
    } = useOfflineStore();

    // Update online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // Process a single action
    const processAction = useCallback(async (action: typeof pendingActions[0]) => {
        try {
            switch (action.type) {
                case "FUEL_LOG": {
                    const fd = new FormData();
                    Object.entries(action.payload).forEach(([key, value]) => {
                        if (value !== null && value !== undefined) {
                            fd.append(key, String(value));
                        }
                    });
                    await driverPortalApi.post("/drivers/portal/fuel_logs/", fd);
                    break;
                }
                case "TRIP_COMPLETE": {
                    await driverPortalApi.post(`/drivers/portal/trips/${action.payload.tripId}/complete/`);
                    break;
                }
                case "TRIP_INCIDENT": {
                    await driverPortalApi.post(`/drivers/portal/trips/${action.payload.tripId}/incidents/`, {
                        description: action.payload.description,
                    });
                    break;
                }
                case "FREE_TRIP_START": {
                    const fd = new FormData();
                    fd.append("vehicle_id", String(action.payload.vehicle_id));
                    if (action.payload.odometer_start) {
                        fd.append("odometer_start", String(action.payload.odometer_start));
                    }
                    await driverPortalApi.post("/drivers/portal/free_trips/start/", fd);
                    break;
                }
                case "FREE_TRIP_CLOSE": {
                    const fd = new FormData();
                    fd.append("odometer_end", String(action.payload.odometer_end));
                    await driverPortalApi.post(`/drivers/portal/free_trips/${action.payload.tripId}/close/`, fd);
                    break;
                }
                default:
                    console.warn(`Unknown action type: ${action.type}`);
            }
            return true;
        } catch (error) {
            console.error(`Failed to process action ${action.id}:`, error);
            return false;
        }
    }, []);

    // Sync all pending actions
    const syncPendingActions = useCallback(async () => {
        if (pendingActions.length === 0 || isSyncing || !isOnline) return;

        setSyncing(true);
        setSyncError(null);

        let successCount = 0;
        let failCount = 0;

        for (const action of pendingActions) {
            const success = await processAction(action);
            if (success) {
                removeAction(action.id);
                successCount++;
            } else {
                failCount++;
            }
        }

        setSyncing(false);

        if (failCount > 0) {
            setSyncError(`${failCount} ação(ões) não sincronizada(s)`);
        } else if (successCount > 0) {
            updateLastSync();
        }
    }, [pendingActions, isSyncing, isOnline, processAction, removeAction, setSyncing, setSyncError, updateLastSync]);

    // Auto-sync when coming back online
    useEffect(() => {
        if (isOnline && pendingActions.length > 0) {
            // Small delay to ensure connection is stable
            const timer = setTimeout(() => {
                syncPendingActions();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, pendingActions.length, syncPendingActions]);

    return {
        isOnline,
        isSyncing,
        syncError,
        lastSyncAt,
        pendingCount: pendingActions.length,
        syncPendingActions,
    };
};
