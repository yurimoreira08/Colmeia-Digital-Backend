export type ReportFilter = 'apiarios' | 'caixas' | 'revisoes' | 'manejos';

export type DateWindow = {
  from: string;
  to: string;
};

export type MobileReportsPayload = {
  dateWindow: DateWindow;
  filter: ReportFilter;
  data: {
    apiaries: Array<{
      id: number;
      name: string;
      location: string;
      boxCount: number;
      description: string;
      createdAt: string;
      updatedAt: string;
    }>;
    boxes: Array<{
      id: number;
      apiaryId: number;
      apiaryName: string;
      name: string;
      position: number;
      createdAt: string;
      updatedAt: string;
    }>;
    revisions?: Array<{
      id: number;
      caixaId: number;
      caixaName: string;
      apiaryId: number | null;
      apiaryName: string;
      tipo: 'apiario';
      checkedOptions: string[];
      observacoes: string;
      indicacoes: string;
      createdAt: string;
    }>;
    manejos?: Array<{
      id: number;
      caixaId: number;
      caixaName: string;
      apiaryId: number | null;
      apiaryName: string;
      tipo: 'apiario';
      revisaoId?: number;
      checkedOptions: any[];
      observacoes: string;
      indicacoes: string;
      photoUri?: string;
      createdAt: string;
    }>;
  };
};

export type BarData = {
  label: string;
  value: number;
};

export type ReportMetrics = {
  periodDays: number;
  totalApiaries: number;
  totalBoxes: number;
  totalRevisions: number;
  totalManejos: number;
  apiaryGrowthPercent: number;
  boxGrowthPercent: number;
  topLocations: Array<{ location: string; total: number }>;
  barsData: BarData[];
};
