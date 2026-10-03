export type ReviewReport = {
  id: number;
  clientUuid?: string;
  caixaId: number;
  caixaName: string;
  apiaryId: number | null;
  apiaryName: string;
  tipo: 'apiario';
  checkedOptions: string[];
  observacoes: string;
  indicacoes: string;
  createdAt: string;
  archived?: boolean;
};

export type ManejoTask = {
  id: string;
  obs: string;
  ind: string;
  customName?: string;
};

export type ManejoReport = {
  id: number;
  clientUuid?: string;
  caixaId: number;
  caixaName: string;
  apiaryId: number | null;
  apiaryName: string;
  tipo: 'apiario';
  revisaoId?: number;
  checkedOptions: ManejoTask[];
  observacoes: string;
  indicacoes: string;
  photoUri?: string;
  createdAt: string;
  archived?: boolean;
};

export type Apiary = {
  id: number;
  name: string;
  location: string;
  boxCount: number;
  description: string;
  createdAt: string;
  updatedAt: string;
  role?: 'reader' | 'editor' | 'owner';
  user_id?: number;
};

export type Box = {
  id: number;
  apiaryId: number;
  apiaryName: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
};

export type User = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  photo?: string | null;
  termsAcceptedAt?: string;
  termsAcceptedVersion?: string;
  createdAt: string;
  updatedAt: string;
};
