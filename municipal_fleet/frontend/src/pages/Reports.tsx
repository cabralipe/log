import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Table } from "../components/Table";

type OdometerRow = { vehicle__license_plate: string; kilometers: number };
type TripRow = {
  id: number;
  origin: string;
  destination: string;
  status: string;
  departure_datetime: string;
  return_datetime_expected: string;
  passengers_count: number;
  vehicle__license_plate: string;
  driver__name: string;
};

export const ReportsPage = () => {
  const [odometer, setOdometer] = useState<OdometerRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api.get<OdometerRow[]>("/reports/odometer/").then((res) => setOdometer(res.data));
    api.get<{ summary: any; trips: TripRow[] }>("/reports/trips/").then((res) => {
      setSummary(res.data.summary);
      setTrips(res.data.trips);
    });
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
            { key: "status", label: "Status" },
            { key: "departure_datetime", label: "Saída" },
            { key: "return_datetime_expected", label: "Retorno" },
            { key: "vehicle__license_plate", label: "Veículo" },
            { key: "driver__name", label: "Motorista" },
          ]}
          data={trips}
        />
      </div>
    </div>
  );
};
