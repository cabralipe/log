import { useMediaQuery } from "../hooks/useMediaQuery";
import { Edit, Trash2, User, Phone, CreditCard, Calendar, AlertCircle } from "lucide-react";
import { Driver } from "../types/driver";
import { formatDate, isCNHExpired } from "../utils/date";
import "./DriverList.css";

interface DriverListProps {
  drivers: Driver[];
  loading: boolean;
  onEdit: (driver: Driver) => void;
  onDelete: (id: number) => void;
}

export const DriverList = ({ drivers, loading, onEdit, onDelete }: DriverListProps) => {
  const { isMobile } = useMediaQuery();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "active";
      case "INACTIVE":
        return "inactive";
      default:
        return "unknown";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "Ativo";
      case "INACTIVE":
        return "Inativo";
      default:
        return status;
    }
  };

  const getCNHCategoryLabel = (category: string) => {
    switch (category) {
      case "A":
        return "A - Moto";
      case "B":
        return "B - Carro";
      case "C":
        return "C - Caminhão";
      case "D":
        return "D - Ônibus";
      case "E":
        return "E - Carreta";
      default:
        return category;
    }
  };

  if (loading) {
    return (
      <div className="driver-list-loading">
        <div className="loading-spinner" aria-hidden="true"></div>
        <p>Carregando motoristas...</p>
      </div>
    );
  }

  if (drivers.length === 0) {
    return (
      <div className="driver-list-empty">
        <div className="empty-state">
          <User className="empty-icon" />
          <h3 className="empty-title">Nenhum motorista encontrado</h3>
          <p className="empty-text">
            Comece adicionando um novo motorista ao sistema
          </p>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="driver-list-mobile">
        <div className="driver-mobile-cards">
          {drivers.map((driver) => {
            const cnhExpired = isCNHExpired(driver.cnh_expiration_date);
            
            return (
              <div key={driver.id} className="driver-mobile-card">
                <div className="driver-card-header">
                  <div className="driver-card-info">
                    <h3 className="driver-card-name">{driver.name}</h3>
                    <p className="driver-card-cpf">{driver.cpf}</p>
                  </div>
                  <span className={`driver-card-status ${getStatusColor(driver.status)}`}>
                    {getStatusLabel(driver.status)}
                  </span>
                </div>

                <div className="driver-card-details">
                  <div className="driver-card-detail">
                    <Phone className="detail-icon" />
                    <span className="detail-text">{driver.phone}</span>
                  </div>
                  <div className="driver-card-detail">
                    <CreditCard className="detail-icon" />
                    <span className="detail-text">
                      CNH {driver.cnh_number} - {getCNHCategoryLabel(driver.cnh_category)}
                    </span>
                  </div>
                  <div className="driver-card-detail">
                    <Calendar className="detail-icon" />
                    <span className="detail-text">
                      Validade: {formatDate(driver.cnh_expiration_date)}
                      {cnhExpired && (
                        <span className="expired-badge">
                          <AlertCircle className="expired-icon" />
                          Vencida
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="driver-card-detail">
                    <User className="detail-icon" />
                    <span className="detail-text">Código: {driver.access_code}</span>
                  </div>
                </div>

                <div className="driver-card-actions">
                  <button
                    onClick={() => onEdit(driver)}
                    className="driver-card-button edit"
                    aria-label={`Editar motorista ${driver.name}`}
                  >
                    <Edit className="button-icon" />
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(driver.id)}
                    className="driver-card-button delete"
                    aria-label={`Excluir motorista ${driver.name}`}
                  >
                    <Trash2 className="button-icon" />
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="driver-list-desktop">
      <div className="driver-table-container">
        <table className="driver-table" role="table">
          <thead>
            <tr>
              <th scope="col">Motorista</th>
              <th scope="col">CPF</th>
              <th scope="col">Telefone</th>
              <th scope="col">CNH</th>
              <th scope="col">Validade</th>
              <th scope="col">Status</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => {
              const cnhExpired = isCNHExpired(driver.cnh_expiration_date);
              
              return (
                <tr key={driver.id}>
                  <td>
                    <div className="driver-info">
                      <div className="driver-name">{driver.name}</div>
                      <div className="driver-code">Código: {driver.access_code}</div>
                    </div>
                  </td>
                  <td>
                    <span className="driver-cpf">{driver.cpf}</span>
                  </td>
                  <td>
                    <span className="driver-phone">{driver.phone}</span>
                  </td>
                  <td>
                    <div className="driver-cnh-info">
                      <div className="driver-cnh-number">{driver.cnh_number}</div>
                      <div className="driver-cnh-category">{getCNHCategoryLabel(driver.cnh_category)}</div>
                    </div>
                  </td>
                  <td>
                    <div className="driver-expiration-info">
                      <div className="driver-expiration-date">
                        {formatDate(driver.cnh_expiration_date)}
                      </div>
                      {cnhExpired && (
                        <div className="driver-expiration-warning">
                          <AlertCircle className="warning-icon" />
                          Vencida
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`driver-status-badge ${getStatusColor(driver.status)}`}>
                      {getStatusLabel(driver.status)}
                    </span>
                  </td>
                  <td>
                    <div className="driver-table-actions">
                      <button
                        onClick={() => onEdit(driver)}
                        className="driver-table-button edit"
                        aria-label={`Editar motorista ${driver.name}`}
                      >
                        <Edit className="button-icon" />
                        Editar
                      </button>
                      <button
                        onClick={() => onDelete(driver.id)}
                        className="driver-table-button delete"
                        aria-label={`Excluir motorista ${driver.name}`}
                      >
                        <Trash2 className="button-icon" />
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};