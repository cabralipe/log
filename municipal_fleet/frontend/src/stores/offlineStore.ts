import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Types for offline queue actions
 */
type OfflineActionType = "FUEL_LOG" | "TRIP_COMPLETE" | "TRIP_INCIDENT" | "FREE_TRIP_START" | "FREE_TRIP_CLOSE";

interface OfflineAction {
    id: string;
    type: OfflineActionType;
    payload: Record<string, any>;
    createdAt: string;
    retryCount: number;
}

interface OfflineStore {
    // Queue of pending actions
    pendingActions: OfflineAction[];

    // Last sync timestamp
    lastSyncAt: string | null;

    // Sync status
    isSyncing: boolean;
    syncError: string | null;

    // Cached data for offline viewing
    cachedTrips: any[];
    cachedAssignments: any[];
    cachedFuelLogs: any[];
    cachedDriverName: string | null;

    // Actions
    addAction: (type: OfflineActionType, payload: Record<string, any>) => void;
    removeAction: (id: string) => void;
    clearQueue: () => void;
    setSyncing: (isSyncing: boolean) => void;
    setSyncError: (error: string | null) => void;
    updateLastSync: () => void;

    // Cache management
    cacheTrips: (trips: any[]) => void;
    cacheAssignments: (assignments: any[]) => void;
    cacheFuelLogs: (logs: any[]) => void;
    cacheDriverName: (name: string) => void;
    clearCache: () => void;
}

/**
 * Generate unique ID for offline actions
 */
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

/**
 * Offline Store - Manages offline queue and cached data
 * Persisted to localStorage for survival across sessions
 */
export const useOfflineStore = create<OfflineStore>()(
    persist(
        (set, get) => ({
            pendingActions: [],
            lastSyncAt: null,
            isSyncing: false,
            syncError: null,
            cachedTrips: [],
            cachedAssignments: [],
            cachedFuelLogs: [],
            cachedDriverName: null,

            addAction: (type, payload) => {
                const action: OfflineAction = {
                    id: generateId(),
                    type,
                    payload,
                    createdAt: new Date().toISOString(),
                    retryCount: 0,
                };
                set((state) => ({
                    pendingActions: [...state.pendingActions, action],
                }));
            },

            removeAction: (id) => {
                set((state) => ({
                    pendingActions: state.pendingActions.filter((a) => a.id !== id),
                }));
            },

            clearQueue: () => {
                set({ pendingActions: [] });
            },

            setSyncing: (isSyncing) => {
                set({ isSyncing });
            },

            setSyncError: (error) => {
                set({ syncError: error });
            },

            updateLastSync: () => {
                set({ lastSyncAt: new Date().toISOString() });
            },

            cacheTrips: (trips) => {
                set({ cachedTrips: trips });
            },

            cacheAssignments: (assignments) => {
                set({ cachedAssignments: assignments });
            },

            cacheFuelLogs: (logs) => {
                set({ cachedFuelLogs: logs });
            },

            cacheDriverName: (name) => {
                set({ cachedDriverName: name });
            },

            clearCache: () => {
                set({
                    cachedTrips: [],
                    cachedAssignments: [],
                    cachedFuelLogs: [],
                    cachedDriverName: null,
                });
            },
        }),
        {
            name: "driver-portal-offline",
            version: 1,
        }
    )
);

/**
 * Helper to get pending count
 */
export const usePendingCount = () => {
    return useOfflineStore((state) => state.pendingActions.length);
};

/**
 * Helper to check if there are pending actions
 */
export const useHasPendingActions = () => {
    return useOfflineStore((state) => state.pendingActions.length > 0);
};
