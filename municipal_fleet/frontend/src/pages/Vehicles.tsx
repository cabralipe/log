import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { ResponsiveVehicleLayout } from "../components/ResponsiveVehicleLayout";

type Vehicle = {
  id: number;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  max_passengers: number;
  status: string;
  municipality: number;
};

export const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = (nextPage = page, nextSearch = search, nextPageSize = pageSize) => {
    setLoading(true);
    api
      .get<Paginated<Vehicle>>("/vehicles/", { params: { page: nextPage, page_size: nextPageSize, search: nextSearch } })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setVehicles(data);
          setTotal(data.length);
        } else {
          setVehicles(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar veículos."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateVehicle = async (vehicleData: Partial<Vehicle>) => {
    try {
      await api.post("/vehicles/", vehicleData);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao criar veículo.");
    }
  };

  const handleUpdateVehicle = async (id: number, vehicleData: Partial<Vehicle>) => {
    try {
      await api.patch(`/vehicles/${id}/`, vehicleData);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao atualizar veículo.");
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    try {
      await api.delete(`/vehicles/${id}/`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover veículo.");
    }
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
    load(1, newSearch);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
    load(1, search, newPageSize);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    load(newPage, search, pageSize);
  };

  return (
    <ResponsiveVehicleLayout
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
      onCreateVehicle={handleCreateVehicle}
      onUpdateVehicle={handleUpdateVehicle}
      onDeleteVehicle={handleDeleteVehicle}
    />
  );
};
