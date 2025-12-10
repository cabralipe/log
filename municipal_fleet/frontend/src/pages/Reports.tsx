import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Table } from "../components/Table";

type OdometerRow = { vehicle__license_plate: string; kilometers: number };
type TripRow = {
  id: number;
  origin: string;
  destination: string;
  category: string;
  status: string;
  departure_datetime: string;
  return_datetime_expected: string;
  passengers_count: number;
  vehicle__license_plate: string;
  driver__name: string;
};

type FuelLogRow = {
  id: number;
  filled_at: string;
  liters: number;
  fuel_station: string;
  vehicle__license_plate: string;
  driver__name: string;
  receipt_image?: string;
};

type TripIncidentRow = {
  id: number;
  trip_id: number;
  trip__origin: string;
  trip__destination: string;
  trip__departure_datetime: string;
  driver__name: string;
  description: string;
  created_at: string;
};

export const ReportsPage = () => {
  const [odometer, setOdometer] = useState<OdometerRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLogRow[]>([]);
  const [fuelSummary, setFuelSummary] = useState<any>(null);
  const [incidents, setIncidents] = useState<TripIncidentRow[]>([]);

  useEffect(() => {
    api.get<OdometerRow[]>("/reports/odometer/").then((res) => setOdometer(res.data));
    api.get<{ summary: any; trips: TripRow[] }>("/reports/trips/").then((res) => {
      setSummary(res.data.summary);
      setTrips(res.data.trips);
    });
    api.get<{ summary: any; logs: FuelLogRow[] }>("/reports/fuel/").then((res) => {
      setFuelSummary(res.data.summary);
      setFuelLogs(res.data.logs);
    });
    api.get<{ incidents: TripIncidentRow[] }>("/reports/trip-incidents/").then((res) => setIncidents(res.data.incidents));
  }, []);

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
      <div className="card">
        <h3>Relatório de quilometragem</h3>
        <Table
          columns={[
            { key: "vehicle__license_plate", label: "Veículo" },
            { key: "kilometers", label: "KM Rodados" },
          ]}
          data={odometer}
        />
      </div>
      <div className="card">
        <h3>Relatório de viagens</h3>
        {summary && (
          <p>
            Total: {summary.total} | Passageiros: {summary.total_passengers}
          </p>
        )}
        <Table
          columns={[
            { key: "origin", label: "Origem" },
            { key: "destination", label: "Destino" },
            { key: "category", label: "Categoria" },
            { key: "status", label: "Status" },
            { key: "departure_datetime", label: "Saída" },
            { key: "return_datetime_expected", label: "Retorno" },
            { key: "vehicle__license_plate", label: "Veículo" },
            { key: "driver__name", label: "Motorista" },
          ]}
          data={trips}
        />
      </div>
      <div className="card">
        <h3>Histórico de abastecimentos</h3>
        {fuelSummary && (
          <p>
            Registros: {fuelSummary.total_logs} | Litros: {fuelSummary.total_liters}
          </p>
        )}
        <Table
          columns={[
            { key: "filled_at", label: "Data" },
            { key: "fuel_station", label: "Posto" },
            { key: "liters", label: "Litros" },
            { key: "vehicle__license_plate", label: "Veículo" },
            { key: "driver__name", label: "Motorista" },
            { key: "receipt_image", label: "Comprovante", render: (row) => (row.receipt_image ? <a href={row.receipt_image}>Ver</a> : "—") },
          ]}
          data={fuelLogs}
        />
      </div>
      <div className="card">
        <h3>Ocorrências registradas</h3>
        <Table
          columns={[
            { key: "created_at", label: "Registrado em" },
            { key: "trip_id", label: "Viagem" },
            {
              key: "trip__origin",
              label: "Rota",
              render: (row) => (
                <span>
                  {row.trip__origin} → {row.trip__destination}
                </span>
              ),
            },
            { key: "trip__departure_datetime", label: "Saída" },
            { key: "driver__name", label: "Motorista" },
            { key: "description", label: "Relato" },
          ]}
          data={incidents}
        />
      </div>
    </div>
  );
};
