import { useEffect, useState } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Modal } from "./Modal";
import { FloatingActionButton } from "./FloatingActionButton";
import { VehicleForm, type VehicleFormData } from "./VehicleForm";
import { VehicleList } from "./VehicleList";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import "./ResponsiveVehicleLayout.css";

interface Vehicle extends VehicleFormData {
  id: number;
}

interface ResponsiveVehicleLayoutProps {
  vehicles: Vehicle[];
  loading: boolean;
  error: string | null;
  search: string;
  page: number;
  pageSize: number;
  total: number;
  onSearchChange: (search: string) => void;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  onCreateVehicle: (vehicle: VehicleFormData) => void;
  onUpdateVehicle: (id: number, vehicle: VehicleFormData) => void;
  onDeleteVehicle: (id: number) => void;
}

export const ResponsiveVehicleLayout = ({
  vehicles,
  loading,
  error,
  search,
  page,
  pageSize,
  total,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onCreateVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
}: ResponsiveVehicleLayoutProps) => {
  const { isMobile, isTablet, isDesktop } = useMediaQuery();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [municipalities, setMunicipalities] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<number | null>(null);

  useEffect(() => {
    if (user?.municipality) {
      setSelectedMunicipality(user.municipality);
    }
    if (user && user.role === "SUPERADMIN") {
      api
        .get<any>("/municipalities/", { params: { page_size: 1000 } })
        .then((res) => {
          const data = res.data as any;
          const items = Array.isArray(data) ? data : data.results || [];
          const list = items.map((m: any) => ({ id: m.id, name: m.name }));
          setMunicipalities(list);
          if (!selectedMunicipality && list.length > 0) setSelectedMunicipality(list[0].id);
        })
        .catch(() => {
          /* ignore */
        });
    }
  }, [user]);

  const handleCreateClick = () => {
    setEditingVehicle(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir este veículo?")) {
      onDeleteVehicle(id);
    }
  };

  const handleFormSubmit = (formData: VehicleFormData) => {
    if (editingVehicle) {
      onUpdateVehicle(editingVehicle.id, formData);
    } else {
      if (user?.role === "SUPERADMIN" && !selectedMunicipality) {
        alert("Selecione a prefeitura para criar o veículo.");
        return;
      }
      const payload: any = { ...formData };
      if (user?.role === "SUPERADMIN") {
        if (selectedMunicipality) {
          payload.municipality = selectedMunicipality;
        }
      }
      onCreateVehicle(payload);
    }
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const renderForm = () => (
    <div>
      {user?.role === "SUPERADMIN" && (
        <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <label>
            Prefeitura
            <select
              value={selectedMunicipality ?? ""}
              onChange={(e) => setSelectedMunicipality(Number(e.target.value))}
              style={{ width: "100%" }}
            >
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <VehicleForm
        initialData={editingVehicle || undefined}
        onSubmit={handleFormSubmit}
        onClose={isMobile ? handleModalClose : undefined}
      />
    </div>
  );

  return (
    <div className="responsive-vehicle-layout">
      <div className="responsive-vehicle-container">
        {/* Mobile Layout */}
        {isMobile && (
          <div className="mobile-layout">
            <VehicleList
              vehicles={vehicles}
              loading={loading}
              error={error}
              search={search}
              page={page}
              pageSize={pageSize}
              total={total}
              onSearchChange={onSearchChange}
              onPageSizeChange={onPageSizeChange}
              onPageChange={onPageChange}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
            <FloatingActionButton
              onClick={handleCreateClick}
              aria-label="Adicionar novo veículo"
            />
            <Modal
              open={isModalOpen}
              onClose={handleModalClose}
              title={editingVehicle ? "Editar Veículo" : "Novo Veículo"}
            >
              {renderForm()}
            </Modal>
          </div>
        )}

        {/* Tablet Layout */}
        {isTablet && (
          <div className="tablet-layout">
            <div className="tablet-content">
              <VehicleList
                vehicles={vehicles}
                loading={loading}
                error={error}
                search={search}
                page={page}
                pageSize={pageSize}
                total={total}
                onSearchChange={onSearchChange}
                onPageSizeChange={onPageSizeChange}
                onPageChange={onPageChange}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
              <div className="tablet-sidebar">
                <div className="form-container card">
                  <h3>{editingVehicle ? "Editar Veículo" : "Novo Veículo"}</h3>
                  {renderForm()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Layout */}
        {isDesktop && (
          <div className="desktop-layout">
            <div className="desktop-content">
              <div className="desktop-main">
                <div className="form-container card" style={{ marginBottom: "1rem" }}>
                  <h3>{editingVehicle ? "Editar Veículo" : "Novo Veículo"}</h3>
                  {renderForm()}
                </div>
                <VehicleList
                  vehicles={vehicles}
                  loading={loading}
                  error={error}
                  search={search}
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onSearchChange={onSearchChange}
                  onPageSizeChange={onPageSizeChange}
                  onPageChange={onPageChange}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
