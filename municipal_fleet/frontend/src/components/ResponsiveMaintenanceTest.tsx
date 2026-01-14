import React, { useState } from 'react';
import { ResponsiveMaintenanceLayout } from './ResponsiveMaintenanceLayout';
import { MaintenanceRecord } from './MaintenanceList';

// Test data for demonstration
const testMaintenanceRecords: MaintenanceRecord[] = [
  {
    id: '1',
    vehicleId: '1',
    vehiclePlate: 'ABC-1234',
    type: 'preventive',
    description: 'Troca de óleo e filtro',
    status: 'scheduled',
    priority: 'medium',
    scheduledDate: '2024-12-15',
    cost: 150.00,
    mechanic: 'João Silva',
    notes: 'Manutenção preventiva programada'
  },
  {
    id: '2',
    vehicleId: '2',
    vehiclePlate: 'DEF-5678',
    type: 'corrective',
    description: 'Substituição de pastilhas de freio',
    status: 'in-progress',
    priority: 'high',
    scheduledDate: '2024-12-10',
    cost: 280.00,
    mechanic: 'Maria Santos',
    notes: 'Urgente - freios desgastados'
  },
  {
    id: '3',
    vehicleId: '3',
    vehiclePlate: 'GHI-9012',
    type: 'inspection',
    description: 'Inspeção geral do motor',
    status: 'completed',
    priority: 'low',
    scheduledDate: '2024-12-05',
    completedDate: '2024-12-05',
    cost: 95.00,
    mechanic: 'Carlos Oliveira',
    notes: 'Inspeção concluída sem problemas'
  }
];

const testVehicles = [
  { id: 1, license_plate: 'ABC-1234', brand: 'Volkswagen', model: 'Gol' },
  { id: 2, license_plate: 'DEF-5678', brand: 'Ford', model: 'Focus' },
  { id: 3, license_plate: 'GHI-9012', brand: 'Chevrolet', model: 'Onix' }
];

export const ResponsiveMaintenanceTest: React.FC = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>(testMaintenanceRecords);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateMaintenance = async (data: any) => {
    console.log('Creating maintenance:', data);
    const newRecord: MaintenanceRecord = {
      id: Date.now().toString(),
      vehicleId: data.vehicleId,
      vehiclePlate: testVehicles.find(v => v.id.toString() === data.vehicleId)?.license_plate || 'N/A',
      type: data.type,
      description: data.description,
      status: data.status,
      priority: data.priority,
      scheduledDate: data.scheduledDate,
      cost: data.cost,
      mechanic: data.mechanic,
      notes: data.notes
    };
    setRecords([...records, newRecord]);
  };

  const handleUpdateMaintenance = async (id: string, data: any) => {
    console.log('Updating maintenance:', id, data);
    setRecords(records.map(record =>
      record.id === id
        ? {
          ...record,
          ...data,
          vehiclePlate: testVehicles.find(v => v.id.toString() === data.vehicleId)?.license_plate || record.vehiclePlate
        }
        : record
    ));
  };

  const handleDeleteMaintenance = async (id: string) => {
    console.log('Deleting maintenance:', id);
    if (window.confirm('Deseja remover este registro de manutenção?')) {
      setRecords(records.filter(record => record.id !== id));
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Teste de Layout Responsivo - Manutenção</h1>
      <p className="text-gray-600 mb-6">
        Este é um teste do layout responsivo para a página de manutenção.
        Redimensione a janela do navegador para ver o comportamento responsivo.
      </p>

      <ResponsiveMaintenanceLayout
        records={records}
        vehicles={testVehicles}
        loading={loading}
        error={error}
        search=""
        page={1}
        pageSize={10}
        total={records.length}
        onSearchChange={(search) => console.log('Search:', search)}
        onPageSizeChange={(size) => console.log('Page size:', size)}
        onPageChange={(page) => console.log('Page:', page)}
        onCreateMaintenance={handleCreateMaintenance}
        onUpdateMaintenance={handleUpdateMaintenance}
        onDeleteMaintenance={handleDeleteMaintenance}
      />

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Instruções de Teste:</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Desktop (&gt;1024px): Formulário na lateral esquerda, lista à direita</li>
          <li>Tablet (768px-1024px): Formulário menor na lateral, lista à direita</li>
          <li>Mobile (&lt;768px): Botão flutuante no canto superior direito que abre modal</li>
          <li>Teste o modal: clique no botão flutuante para abrir o formulário em modal</li>
          <li>Teste acessibilidade: use Tab para navegação, ESC para fechar modal</li>
          <li>Teste os filtros de busca e status na lista de manutenções</li>
        </ul>
      </div>
    </div>
  );
};