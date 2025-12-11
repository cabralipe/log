import React, { useState, useMemo } from 'react';
import { Search, Edit, Trash2, Calendar, Wrench, AlertCircle } from 'lucide-react';
import './MaintenanceList.css';

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  type: 'preventive' | 'corrective' | 'inspection';
  description: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  scheduledDate: string;
  completedDate?: string;
  cost?: number;
  mechanic?: string;
  notes?: string;
}

interface MaintenanceListProps {
  records: MaintenanceRecord[];
  onEdit: (record: MaintenanceRecord) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

const MaintenanceList: React.FC<MaintenanceListProps> = ({
  records,
  onEdit,
  onDelete,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const matchesSearch = record.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           record.mechanic?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || record.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [records, searchTerm, statusFilter, priorityFilter]);

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'scheduled': 'maintenance-status-badge scheduled',
      'in-progress': 'maintenance-status-badge in-progress',
      'completed': 'maintenance-status-badge completed',
      'overdue': 'maintenance-status-badge overdue'
    };
    
    const statusLabels = {
      'scheduled': 'Agendado',
      'in-progress': 'Em Andamento',
      'completed': 'Concluído',
      'overdue': 'Atrasado'
    };
    
    return (
      <span className={statusClasses[status as keyof typeof statusClasses]}>
        {statusLabels[status as keyof typeof statusLabels]}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityClasses = {
      'low': 'maintenance-priority-badge low',
      'medium': 'maintenance-priority-badge medium',
      'high': 'maintenance-priority-badge high'
    };
    
    const priorityLabels = {
      'low': 'Baixa',
      'medium': 'Média',
      'high': 'Alta'
    };
    
    return (
      <span className={priorityClasses[priority as keyof typeof priorityClasses]}>
        {priorityLabels[priority as keyof typeof priorityLabels]}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="maintenance-loading">
        <div className="maintenance-loading-spinner"></div>
        <span>Carregando registros de manutenção...</span>
      </div>
    );
  }

  if (filteredRecords.length === 0) {
    return (
      <div className="maintenance-empty-state">
        <AlertCircle className="maintenance-empty-state-icon" />
        <h3>Nenhum registro encontrado</h3>
        <p>
          {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
            ? 'Tente ajustar seus filtros de busca'
            : 'Nenhum registro de manutenção cadastrado ainda'}
        </p>
      </div>
    );
  }

  return (
    <div className="maintenance-list-section">
      <div className="maintenance-list-header">
        <h2 className="maintenance-list-title">
          Registros de Manutenção ({filteredRecords.length})
        </h2>
        
        <div className="maintenance-search-container">
          <Search className="maintenance-search-icon" size={16} />
          <input
            type="text"
            placeholder="Buscar por placa, descrição ou mecânico..."
            className="maintenance-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Buscar registros de manutenção"
          />
        </div>
        
        <div className="maintenance-filters">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="maintenance-filter-select"
            aria-label="Filtrar por status"
          >
            <option value="all">Todos Status</option>
            <option value="scheduled">Agendado</option>
            <option value="in-progress">Em Andamento</option>
            <option value="completed">Concluído</option>
            <option value="overdue">Atrasado</option>
          </select>
          
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="maintenance-filter-select"
            aria-label="Filtrar por prioridade"
          >
            <option value="all">Todas Prioridades</option>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
          </select>
        </div>
      </div>

      {/* Desktop/Tablet Table View */}
      <div className="maintenance-table-container">
        <table className="maintenance-table" role="table">
          <thead>
            <tr>
              <th scope="col">Veículo</th>
              <th scope="col">Tipo</th>
              <th scope="col">Descrição</th>
              <th scope="col">Status</th>
              <th scope="col">Prioridade</th>
              <th scope="col">Data Agendada</th>
              <th scope="col">Custo</th>
              <th scope="col">Mecânico</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td>
                  <div>
                    <div className="font-medium">{record.vehiclePlate}</div>
                    <div className="text-sm text-gray-500">{record.vehicleId}</div>
                  </div>
                </td>
                <td className="capitalize">{record.type}</td>
                <td>
                  <div className="max-w-xs truncate" title={record.description}>
                    {record.description}
                  </div>
                </td>
                <td>{getStatusBadge(record.status)}</td>
                <td>{getPriorityBadge(record.priority)}</td>
                <td>{formatDate(record.scheduledDate)}</td>
                <td>{formatCurrency(record.cost)}</td>
                <td className="text-sm">{record.mechanic || '-'}</td>
                <td>
                  <div className="maintenance-action-buttons">
                    <button
                      onClick={() => onEdit(record)}
                      className="maintenance-btn maintenance-btn-edit"
                      aria-label={`Editar manutenção ${record.vehiclePlate}`}
                      title="Editar"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(record.id)}
                      className="maintenance-btn maintenance-btn-delete"
                      aria-label={`Excluir manutenção ${record.vehiclePlate}`}
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="maintenance-card-list">
        {filteredRecords.map((record) => (
          <div key={record.id} className="maintenance-card">
            <div className="maintenance-card-header">
              <div>
                <div className="maintenance-card-title">{record.vehiclePlate}</div>
                <div className="text-sm text-gray-500">{record.vehicleId}</div>
              </div>
              <div className="maintenance-card-status-container">
                {getStatusBadge(record.status)}
              </div>
            </div>
            
            <div className="maintenance-card-details">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Tipo:</span>
                <span className="text-sm capitalize">{record.type}</span>
              </div>
              <div className="mb-2">
                <span className="text-sm font-medium">Descrição:</span>
                <div className="text-sm text-gray-600 mt-1">{record.description}</div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Prioridade:</span>
                {getPriorityBadge(record.priority)}
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Data:</span>
                <span className="text-sm">{formatDate(record.scheduledDate)}</span>
              </div>
              {record.cost && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Custo:</span>
                  <span className="text-sm font-medium">{formatCurrency(record.cost)}</span>
                </div>
              )}
              {record.mechanic && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Mecânico:</span>
                  <span className="text-sm">{record.mechanic}</span>
                </div>
              )}
            </div>
            
            <div className="maintenance-card-actions">
              <button
                onClick={() => onEdit(record)}
                className="maintenance-btn maintenance-btn-edit"
                aria-label={`Editar manutenção ${record.vehiclePlate}`}
              >
                <Edit size={14} />
                <span>Editar</span>
              </button>
              <button
                onClick={() => onDelete(record.id)}
                className="maintenance-btn maintenance-btn-delete"
                aria-label={`Excluir manutenção ${record.vehiclePlate}`}
              >
                <Trash2 size={14} />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export { MaintenanceList };