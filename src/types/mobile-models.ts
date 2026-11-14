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
  /** Última alteração no servidor: o app devolve como baseUpdatedAt no POST /sync. */
  updatedAt?: string;
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
  /** Última alteração no servidor: o app devolve como baseUpdatedAt no POST /sync. */
  updatedAt?: string;
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
  terms_accepted_at?: string | null;
  terms_version?: string | null;
  termsAcceptedAt?: string;
  termsAcceptedVersion?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Usuário como ele pode sair da API: sem `passwordHash`.
 * Toda resposta HTTP com dados de usuário deve usar este tipo, nunca `User`.
 */
export type PublicUser = Omit<User, 'passwordHash'>;
