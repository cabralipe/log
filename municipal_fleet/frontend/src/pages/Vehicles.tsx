import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
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
  image?: string | null;
};

export const VehiclesPage = () => {
  const { user } = useAuth();
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

  const buildVehicleFormData = (vehicleData: Partial<Vehicle> & { imageFile?: File | null; removeImage?: boolean }) => {
    const formData = new FormData();
    const fields = [
      "license_plate",
      "brand",
      "model",
      "year",
      "max_passengers",
      "status",
      "municipality",
    ];
    fields.forEach((field) => {
      const value = (vehicleData as any)[field];
      if (value !== undefined && value !== null && value !== "") {
        formData.append(field, String(value));
      }
    });
    if (vehicleData.imageFile) {
      formData.append("image", vehicleData.imageFile);
    } else if (vehicleData.removeImage) {
      formData.append("image", "");
    }
    return formData;
  };

  const handleCreateVehicle = async (vehicleData: Partial<Vehicle> & { imageFile?: File | null; removeImage?: boolean }) => {
    try {
      const payload = {
        ...vehicleData,
        ...(user?.municipality ? { municipality: user.municipality } : {}),
      };
      const formData = buildVehicleFormData(payload);
      await api.post("/vehicles/", formData, { headers: { "Content-Type": "multipart/form-data" } });
      load();
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.detail;
      const fieldErrors = data && typeof data === "object"
        ? Object.entries(data)
            .filter(([k]) => k !== "detail")
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
            .join(" | ")
        : null;
      const status = err?.response?.status;
      const statusText = err?.response?.statusText;
      const message = err?.message;
      setError(
        detail ||
          fieldErrors ||
          (status ? `Falha (${status}${statusText ? ` ${statusText}` : ""}).` : null) ||
          message ||
          "Erro ao criar veículo."
      );
    }
  };

  const handleUpdateVehicle = async (id: number, vehicleData: Partial<Vehicle> & { imageFile?: File | null; removeImage?: boolean }) => {
    try {
      const formData = buildVehicleFormData(vehicleData);
      await api.patch(`/vehicles/${id}/`, formData, { headers: { "Content-Type": "multipart/form-data" } });
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
