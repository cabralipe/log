import React from 'react';
import { Edit, Trash2, Calendar, Wrench, Clock } from 'lucide-react';
import { MaintenanceRecord } from '../types/maintenance';
import { useMediaQuery } from '../hooks/useMediaQuery';
import './MaintenanceList.css';

interface MaintenanceListProps {
  records: MaintenanceRecord[];
  onEdit: (record: MaintenanceRecord) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export const MaintenanceList: React.FC<MaintenanceListProps> = ({
  records,
  onEdit,
  onDelete,
  loading = false,
}) => {
  const { isMobile, isTablet } = useMediaQuery();

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'in_progress':
        return 'status-in-progress';
      case 'completed':
        return 'status-completed';
      default:
        return 'status-pending';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'in_progress':
        return 'Em Progresso';
      case 'completed':
        return 'Concluído';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Carregando registros de manutenção...</p>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔧</div>
        <h3 className="empty-state-title">Nenhum registro de manutenção</h3>
        <p className="empty-state-description">
          {isMobile 
            ? "Toque no botão flutuante (+) para adicionar um novo registro"
            : "Use o formulário lateral para adicionar um novo registro de manutenção"
          }
        </p>
      </div>
    );
  }

  return (
    <div className="maintenance-grid">
      {records.map((record) => (
        <div key={record.id} className="maintenance-card">
          <div className="maintenance-card-header">
            <h3 className="maintenance-card-title">
              {record.serviceType}
            </h3>
            <span className={`maintenance-card-status ${getStatusClass(record.status)}`}>
              {getStatusText(record.status)}
            </span>
          </div>

          <div className="maintenance-card-details">
            <div className="maintenance-card-detail">
              <span className="maintenance-card-label">
                <Calendar size={16} />
                Data:
              </span>
              <span className="maintenance-card-value">
                {formatDate(record.scheduledDate)}
              </span>
            </div>

            <div className="maintenance-card-detail">
              <span className="maintenance-card-label">
                <Wrench size={16} />
                Veículo:
              </span>
              <span className="maintenance-card-value">
                {record.vehiclePlate}
              </span>
            </div>

            {record.mileage && (
              <div className="maintenance-card-detail">
                <span className="maintenance-card-label">
                  Odômetro:
                </span>
                <span className="maintenance-card-value">
                  {record.mileage.toLocaleString('pt-BR')} km
                </span>
              </div>
            )}

            {record.cost && (
              <div className="maintenance-card-detail">
                <span className="maintenance-card-label">
                  Custo:
                </span>
                <span className="maintenance-card-value">
                  {formatCurrency(record.cost)}
                </span>
              </div>
            )}

            {record.nextMaintenanceDate && (
              <div className="maintenance-card-detail">
                <span className="maintenance-card-label">
                  <Clock size={16} />
                  Próxima:
                </span>
                <span className="maintenance-card-value">
                  {formatDate(record.nextMaintenanceDate)}
                </span>
              </div>
            )}

            {record.description && (
              <div className="maintenance-card-detail">
                <span className="maintenance-card-label">
                  Descrição:
                </span>
                <span className="maintenance-card-value">
                  {record.description}
                </span>
              </div>
            )}
          </div>

          <div className="maintenance-card-actions">
            <button
              onClick={() => onEdit(record)}
              className="btn btn-secondary"
              aria-label={`Editar manutenção ${record.serviceType}`}
              title="Editar"
            >
              <Edit size={16} />
              {!isMobile && 'Editar'}
            </button>
            <button
              onClick={() => onDelete(record.id)}
              className="btn btn-danger"
              aria-label={`Excluir manutenção ${record.serviceType}`}
              title="Excluir"
            >
              <Trash2 size={16} />
              {!isMobile && 'Excluir'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};