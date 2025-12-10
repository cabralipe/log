import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { ResponsiveMaintenanceLayout } from "../components/ResponsiveMaintenanceLayout";
import { MaintenanceRecord } from "../types/maintenance";

type Vehicle = { id: number; license_plate: string; brand: string; model: string };

export const MaintenancePage = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (nextPage = page, nextSearch = search, nextPageSize = pageSize) => {
    setLoading(true);
    try {
      // Load maintenance records
      const maintenanceRes = await api.get<Paginated<any>>("/vehicles/maintenance/", {
        params: { page: nextPage, page_size: nextPageSize, search: nextSearch },
      });
      
      const maintenanceData = maintenanceRes.data as any;
      const maintenanceRecords = Array.isArray(maintenanceData) 
        ? maintenanceData 
        : maintenanceData.results;
      
      // Transform to MaintenanceRecord format
      const transformedRecords: MaintenanceRecord[] = maintenanceRecords.map((record: any) => ({
        id: record.id.toString(),
        vehicleId: record.vehicle,
        vehiclePlate: record.vehicle__license_plate || '',
        serviceType: record.description || 'Manutenção',
        description: record.description || '',
        scheduledDate: record.date || new Date().toISOString().split('T')[0],
        mileage: record.mileage || 0,
        status: 'pending',
        cost: 0,
        nextMaintenanceDate: '',
        createdAt: record.created_at || new Date().toISOString(),
        updatedAt: record.updated_at || new Date().toISOString(),
      }));
      
      setRecords(transformedRecords);
      setTotal(Array.isArray(maintenanceData) ? maintenanceData.length : maintenanceData.count);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao carregar manutenções.");
    } finally {
      setLoading(false);
    }
    
    // Load vehicles
    try {
      const vehiclesRes = await api.get<Paginated<Vehicle>>("/vehicles/", { params: { page_size: 1000 } });
      const vehiclesData = vehiclesRes.data as any;
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : vehiclesData.results);
    } catch (err: any) {
      console.error("Erro ao carregar veículos:", err);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
    load(1, newSearch, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    load(1, search, newSize);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    load(newPage, search, pageSize);
  };

  const handleCreateMaintenance = async (data: any) => {
    try {
      await api.post("/vehicles/maintenance/", {
        vehicle: data.vehicle,
        description: data.description,
        date: data.scheduledDate,
        mileage: data.mileage,
      });
      load(page, search, pageSize);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao criar manutenção.");
    }
  };

  const handleUpdateMaintenance = async (id: string, data: any) => {
    try {
      await api.patch(`/vehicles/maintenance/${id}/`, {
        vehicle: data.vehicle,
        description: data.description,
        date: data.scheduledDate,
        mileage: data.mileage,
      });
      load(page, search, pageSize);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao atualizar manutenção.");
    }
  };

  const handleDeleteMaintenance = async (id: string) => {
    if (!confirm("Deseja remover este registro?")) return;
    try {
      await api.delete(`/vehicles/maintenance/${id}/`);
      load(page, search, pageSize);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover manutenção.");
    }
  };

  return (
    <ResponsiveMaintenanceLayout
      records={records}
      vehicles={vehicles}
      loading={loading}
      error={error}
      search={search}
      page={page}
      pageSize={pageSize}
      total={total}
      onSearchChange={handleSearchChange}
      onPageSizeChange={handlePageSizeChange}
      onPageChange={handlePageChange}
      onCreateMaintenance={handleCreateMaintenance}
      onUpdateMaintenance={handleUpdateMaintenance}
      onDeleteMaintenance={handleDeleteMaintenance}
    />
  );
};