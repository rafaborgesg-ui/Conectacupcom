import { createClient, getCurrentUser } from './supabase/client';

export type FreightType = 'nacional' | 'internacional';
export type FreightStatus =
  | 'Solicitado'
  | 'Pendente'
  | 'Agendado'
  | 'Em Rota'
  | 'Concluído'
  | 'Em cotação'
  | 'Aguardando coleta'
  | 'Em trânsito'
  | 'Desembaraço'
  | 'Cancelado';

export interface FreightVolume {
  id?: string;
  itemNumero: number;
  quantidade?: number;
  dimensoes?: string;
  pesoBruto?: number;
  tipoEmbalagem?: string;
}

export interface FreightItem {
  id?: string;
  itemNumero: number;
  quantidade?: number;
  descricao?: string;
  serialPartNumber?: string;
  ncm?: string;
  fabricante?: string;
  paisOrigem?: string;
  valorItem?: number;
  pesoUnitario?: number;
}

export interface FreightAttachment {
  id?: string;
  freightRequestId?: string;
  category: 'produto' | 'entrega' | 'volume' | 'itens' | 'documento';
  fileName?: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt?: string;
}

export interface FreightHistory {
  id: string;
  freightRequestId: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  comment?: string;
  changedAt: string;
  changedByEmail?: string;
}

export interface FreightRequest {
  id: string;
  protocol: number;
  freightType: FreightType;
  status: FreightStatus;
  setorId?: string;
  setor?: string;
  projetoId?: string;
  projeto?: string;
  projetoDescricao?: string;
  prazoEntrega?: string;
  solicitanteNome?: string;
  responsavelEntrega?: string;
  itemDescricao?: string;
  responsavelLocal?: string;
  enderecoRetirada?: string;
  enderecoEntrega?: string;
  pagamento?: string;
  observacoes?: string;
  fotosProdutoUrls: string[];
  motorista?: string;
  veiculo?: string;
  placa?: string;
  agendamentoAt?: string;
  atendimentoAt?: string;
  observacoesLogistica?: string;
  fotoEntregaUrls: string[];
  necessidade?: string;
  definitivaTemporaria?: string;
  observacoesNecessidade?: string;
  empresaRemetente?: string;
  enderecoOrigem?: string;
  enderecoColetaOrigem?: string;
  nomeContatoOrigem?: string;
  emailContatoOrigem?: string;
  telefoneContatoOrigem?: string;
  empresaDestinatario?: string;
  enderecoDestino?: string;
  enderecoEntregaDestino?: string;
  nomeContatoDestino?: string;
  emailContatoDestino?: string;
  telefoneContatoDestino?: string;
  prazoDesejado?: string;
  tipoFrete?: string;
  modalidadeFrete?: string;
  necessitaSeguro?: string;
  observacoesFinais?: string;
  empresaSolicitante?: string;
  cnpj?: string;
  telefoneSolicitante?: string;
  emailSolicitante?: string;
  responsavelCustos?: string;
  payloadOriginal?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdByEmail?: string;
  volumes?: FreightVolume[];
  items?: FreightItem[];
  attachments?: FreightAttachment[];
}

export interface FreightLookupOption {
  id?: string;
  label: string;
  value: string;
  metadata?: Record<string, unknown>;
  source?: 'freight_master_options' | 'setor' | 'projeto';
}

export interface FreightLookups {
  setores: FreightLookupOption[];
  projetos: FreightLookupOption[];
  motoristas: FreightLookupOption[];
  veiculos: FreightLookupOption[];
  enderecos: FreightLookupOption[];
  statusNacional: FreightLookupOption[];
  statusInternacional: FreightLookupOption[];
  tiposFrete: FreightLookupOption[];
  modalidades: FreightLookupOption[];
  embalagens: FreightLookupOption[];
  sla: FreightLookupOption[];
}

export interface FreightMasterCategory {
  id: string;
  label: string;
  description: string;
  valueLabel: string;
  metadataFields: Array<{
    key: string;
    label: string;
    placeholder?: string;
  }>;
}

export interface FreightMasterOptionRecord {
  id?: string;
  category: string;
  label: string;
  value: string;
  metadata?: Record<string, unknown>;
  active?: boolean;
  sortOrder?: number;
}

export interface FreightFilters {
  type?: FreightType;
  status?: string;
  search?: string;
  motorista?: string;
  onlyPending?: boolean;
}

export interface CreateFreightInput extends Partial<FreightRequest> {
  freightType: FreightType;
  status?: FreightStatus;
  volumes?: FreightVolume[];
  items?: FreightItem[];
}

const supabase = createClient();

const text = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
};

const nullable = (value: unknown) => text(value) || null;
const requiredText = (value: unknown, fallback = 'Não informado') => text(value) || fallback;

const numOrNull = (value: unknown) => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const dateOrNull = (value: unknown) => {
  const normalized = text(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? normalized : date.toISOString();
};

const dateOnlyOrNull = (value: unknown) => {
  const normalized = text(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized.slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const onlyTruthy = (items?: string[]) => (items || []).map(item => String(item || '').trim()).filter(Boolean);

const uuidOrNull = (value: unknown) => {
  const normalized = text(value);
  return normalized && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
};

type FreightSchemaMode = 'full' | 'legacy';

let schemaModeCache: FreightSchemaMode | null = null;
const PROTOCOL_OVERFLOW_THRESHOLD = 100000;
export const REQUESTED_FREIGHT_STATUS: FreightStatus = 'Solicitado';

export function normalizeFreightStatus(status?: string | null): FreightStatus {
  const normalized = String(status || REQUESTED_FREIGHT_STATUS)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!normalized || normalized.includes('pendente') || normalized.includes('solicitad')) return REQUESTED_FREIGHT_STATUS;
  if (normalized.includes('cancel')) return 'Cancelado';
  if (normalized.includes('concl') || normalized.includes('entreg')) return 'Concluído';
  if (normalized.includes('desembaraco')) return 'Desembaraço';
  if (normalized.includes('em rota')) return 'Em Rota';
  if (normalized.includes('em transito') || normalized === 'em_transito') return normalized === 'em_transito' ? 'Em Rota' : 'Em trânsito';
  if (normalized.includes('aguardando coleta')) return 'Aguardando coleta';
  if (normalized.includes('cotacao')) return 'Em cotação';
  if (normalized.includes('agend') || normalized.includes('aprov')) return 'Agendado';
  return REQUESTED_FREIGHT_STATUS;
}

export function isRequestedFreightStatus(status?: string | null) {
  return normalizeFreightStatus(status) === REQUESTED_FREIGHT_STATUS;
}

const DEFAULT_STATUS_NACIONAL: FreightLookupOption[] = [
  { label: REQUESTED_FREIGHT_STATUS, value: REQUESTED_FREIGHT_STATUS },
  { label: 'Agendado', value: 'Agendado' },
  { label: 'Em Rota', value: 'Em Rota' },
  { label: 'Concluído', value: 'Concluído' }
];

const DEFAULT_STATUS_INTERNACIONAL: FreightLookupOption[] = [
  { label: REQUESTED_FREIGHT_STATUS, value: REQUESTED_FREIGHT_STATUS },
  { label: 'Em cotação', value: 'Em cotação' },
  { label: 'Aguardando coleta', value: 'Aguardando coleta' },
  { label: 'Em trânsito', value: 'Em trânsito' },
  { label: 'Desembaraço', value: 'Desembaraço' },
  { label: 'Concluído', value: 'Concluído' },
  { label: 'Cancelado', value: 'Cancelado' }
];

const DEFAULT_TIPOS_FRETE: FreightLookupOption[] = [
  { label: 'Rodoviário', value: 'Rodoviário' },
  { label: 'Aéreo', value: 'Aéreo' },
  { label: 'Marítimo', value: 'Marítimo' }
];

const DEFAULT_MODALIDADES: FreightLookupOption[] = [
  { label: 'CIF', value: 'CIF' },
  { label: 'EXW', value: 'EXW' }
];

const DEFAULT_EMBALAGENS: FreightLookupOption[] = [
  { label: 'Palete', value: 'Palete' },
  { label: 'Caixa', value: 'Caixa' }
];

export const FREIGHT_MASTER_CATEGORIES: FreightMasterCategory[] = [
  {
    id: 'setor_frete',
    label: 'Setores',
    description: 'Setores disponíveis para novas solicitações nacionais.',
    valueLabel: 'Código',
    metadataFields: [{ key: 'descricao', label: 'Responsável/descrição' }]
  },
  {
    id: 'projeto_frete',
    label: 'Projetos',
    description: 'Projetos/etapas usados no frete nacional.',
    valueLabel: 'Código',
    metadataFields: [{ key: 'descricao', label: 'Descrição' }]
  },
  {
    id: 'endereco_recorrente',
    label: 'Endereços recorrentes',
    description: 'Locais usados nos campos de retirada e entrega.',
    valueLabel: 'Nome curto',
    metadataFields: [{ key: 'descricao', label: 'Endereço completo' }]
  },
  {
    id: 'motorista',
    label: 'Motoristas',
    description: 'Motoristas e contatos para atendimento logístico.',
    valueLabel: 'Nome',
    metadataFields: [
      { key: 'telefone', label: 'Telefone' },
      { key: 'email', label: 'E-mail' },
      { key: 'funcao', label: 'Função' }
    ]
  },
  {
    id: 'veiculo',
    label: 'Veículos',
    description: 'Veículos, placas e modelos para agendamento.',
    valueLabel: 'Nome',
    metadataFields: [
      { key: 'placa', label: 'Placa' },
      { key: 'modelo', label: 'Modelo' }
    ]
  },
  {
    id: 'fornecedor_logistica',
    label: 'Fornecedores logística',
    description: 'Fornecedores e e-mails recorrentes do fluxo de frete.',
    valueLabel: 'Fornecedor',
    metadataFields: [{ key: 'descricao', label: 'Contato/e-mail' }]
  },
  {
    id: 'email_operacao_frete',
    label: 'E-mails da operação',
    description: 'Destinatários copiados nas notificações e no resumo diário de pendências.',
    valueLabel: 'E-mail',
    metadataFields: [{ key: 'funcao', label: 'Função', placeholder: 'Receber solicitações cadastradas' }]
  },
  {
    id: 'sla',
    label: 'SLA',
    description: 'Prazos de SLA para acompanhamento operacional do frete.',
    valueLabel: 'Nome do SLA',
    metadataFields: [{ key: 'dias', label: 'Dias', placeholder: '1' }]
  },
  {
    id: 'centro_custo',
    label: 'Centros de custo',
    description: 'Centros de custo importados da MasterData original.',
    valueLabel: 'Código',
    metadataFields: [{ key: 'descricao', label: 'Descrição' }]
  },
  {
    id: 'conta_contabil',
    label: 'Contas contábeis',
    description: 'Contas contábeis auxiliares do processo logístico.',
    valueLabel: 'Conta',
    metadataFields: [{ key: 'descricao', label: 'Descrição' }]
  },
  {
    id: 'ativo_logistico',
    label: 'Ativos logísticos',
    description: 'Ativos, veículos e carretas cadastrados para a operação.',
    valueLabel: 'Ativo',
    metadataFields: [
      { key: 'modelo', label: 'Modelo' },
      { key: 'local', label: 'Local' },
      { key: 'sub_local', label: 'Sub-local' },
      { key: 'coordenada', label: 'Coordenada' }
    ]
  },
  {
    id: 'posicao_estoque',
    label: 'Posições de estoque',
    description: 'Locais e posições auxiliares de estoque.',
    valueLabel: 'Local',
    metadataFields: [
      { key: 'posicao', label: 'Posição' },
      { key: 'coordenada', label: 'Coordenada' }
    ]
  },
  {
    id: 'portaria',
    label: 'Portaria',
    description: 'Contatos de portaria usados na operação.',
    valueLabel: 'Telefone',
    metadataFields: [{ key: 'descricao', label: 'Descrição' }]
  },
  {
    id: 'horario',
    label: 'Horários',
    description: 'Janelas de horário importadas da MasterData.',
    valueLabel: 'Horário',
    metadataFields: []
  },
  {
    id: 'status_nacional',
    label: 'Status nacional',
    description: 'Status usados no fluxo nacional.',
    valueLabel: 'Status',
    metadataFields: []
  },
  {
    id: 'status_internacional',
    label: 'Status internacional',
    description: 'Status usados no fluxo internacional.',
    valueLabel: 'Status',
    metadataFields: []
  },
  {
    id: 'tipo_frete_internacional',
    label: 'Tipos de frete internacional',
    description: 'Tipos/modais do formulário internacional.',
    valueLabel: 'Tipo',
    metadataFields: []
  },
  {
    id: 'modalidade_frete',
    label: 'Modalidades de frete',
    description: 'Modalidades de contratação, como CIF e EXW.',
    valueLabel: 'Modalidade',
    metadataFields: []
  },
  {
    id: 'tipo_embalagem',
    label: 'Tipos de embalagem',
    description: 'Embalagens usadas nos volumes internacionais.',
    valueLabel: 'Embalagem',
    metadataFields: []
  }
];

async function getSchemaMode(): Promise<FreightSchemaMode> {
  if (schemaModeCache) return schemaModeCache;

  const [coreResult, optionsResult, volumesResult] = await Promise.all([
    supabase.from('freight_requests').select('freight_type, protocol', { head: true }).limit(1),
    supabase.from('freight_master_options').select('id', { head: true }).limit(1),
    supabase.from('freight_request_volumes').select('id', { head: true }).limit(1)
  ]);

  schemaModeCache = coreResult.error || optionsResult.error || volumesResult.error ? 'legacy' : 'full';
  return schemaModeCache;
}

async function getNextFreightProtocol(): Promise<number | undefined> {
  const { data, error } = await supabase
    .from('freight_requests')
    .select('protocol')
    .lt('protocol', PROTOCOL_OVERFLOW_THRESHOLD)
    .order('protocol', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('Falha ao calcular próximo protocolo de frete:', error);
    return undefined;
  }

  const current = Number(data?.[0]?.protocol || 0);
  return Number.isFinite(current) ? current + 1 : 1;
}

function isProtocolConflict(error: any) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return error?.code === '23505' && message.includes('protocol');
}

async function insertFreightRequestRow(row: Record<string, unknown>) {
  let lastError: any;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextProtocol = await getNextFreightProtocol();
    const rowWithProtocol = nextProtocol ? { ...row, protocol: nextProtocol } : row;
    const { data, error } = await supabase
      .from('freight_requests')
      .insert(rowWithProtocol)
      .select('*')
      .single();

    if (!error) return data;
    lastError = error;
    if (!isProtocolConflict(error)) throw error;
  }

  throw lastError || new Error('Não foi possível gerar protocolo de frete.');
}

function protocolFromLegacyRow(row: any) {
  if (row.protocol) return Number(row.protocol);
  const created = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  if (Number.isFinite(created)) return Number(String(created).slice(-8));
  const hex = String(row.id || '').replace(/\D/g, '').slice(0, 8);
  return Number(hex || 0);
}

function normalizeLegacyPayload(raw: any) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.__conectaFrete === 'v1') {
    return {
      data: raw.data || {},
      volumes: Array.isArray(raw.volumes) ? raw.volumes : [],
      freightItems: Array.isArray(raw.freightItems) ? raw.freightItems : [],
      attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      history: Array.isArray(raw.history) ? raw.history : []
    };
  }

  return {
    data: {},
    volumes: [],
    freightItems: Array.isArray(raw) ? raw : [],
    attachments: [],
    history: []
  };
}

function freightDataForPayload(input: Partial<FreightRequest>) {
  const {
    id,
    protocol,
    createdAt,
    updatedAt,
    volumes,
    items,
    attachments,
    payloadOriginal,
    ...data
  } = input;
  return data;
}

function buildLegacyPayload(input: Partial<FreightRequest>, previousRaw?: any) {
  const previous = normalizeLegacyPayload(previousRaw);
  const nextData = {
    ...previous.data,
    ...freightDataForPayload(input)
  };

  return {
    __conectaFrete: 'v1',
    data: nextData,
    volumes: input.volumes ?? previous.volumes,
    freightItems: input.items ?? previous.freightItems,
    attachments: input.attachments ?? previous.attachments,
    history: previous.history
  };
}

function sumWeights(volumes?: FreightVolume[]) {
  const total = (volumes || []).reduce((sum, volume) => sum + Number(volume.pesoBruto || 0), 0);
  return total > 0 ? total : null;
}

function legacyDbStatus(status?: string) {
  const normalized = String(status || REQUESTED_FREIGHT_STATUS)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('cancel')) return 'cancelado';
  if (normalized.includes('concl') || normalized.includes('entreg')) return 'entregue';
  if (normalized.includes('rota') || normalized.includes('transito') || normalized.includes('desembaraco')) return 'em_transito';
  if (normalized.includes('agend') || normalized.includes('cotacao') || normalized.includes('coleta') || normalized.includes('aprov')) return 'aprovado';
  return 'pendente';
}

function uiStatusFromLegacyDb(status?: string): FreightStatus {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'cancelado') return 'Cancelado';
  if (normalized === 'entregue') return 'Concluído';
  if (normalized === 'em_transito') return 'Em Rota';
  if (normalized === 'aprovado') return 'Agendado';
  return REQUESTED_FREIGHT_STATUS;
}

function legacyRequestToRow(input: Partial<FreightRequest>, user: Awaited<ReturnType<typeof currentUserMeta>>, previousRaw?: any) {
  const payload = buildLegacyPayload(input, previousRaw);
  const freightType = (input.freightType || payload.data.freightType || 'nacional') as FreightType;
  const origin = freightType === 'internacional'
    ? input.enderecoOrigem || input.empresaRemetente || payload.data.enderecoOrigem || payload.data.empresaRemetente
    : input.enderecoRetirada || payload.data.enderecoRetirada;
  const destination = freightType === 'internacional'
    ? input.enderecoDestino || input.empresaDestinatario || payload.data.enderecoDestino || payload.data.empresaDestinatario
    : input.enderecoEntrega || payload.data.enderecoEntrega;
  const deliveryDate = input.prazoEntrega || input.prazoDesejado || payload.data.prazoEntrega || payload.data.prazoDesejado;

  return {
    type: freightType,
    origin: requiredText(origin),
    destination: requiredText(destination),
    items: payload,
    weight: sumWeights(payload.volumes),
    volume: payload.volumes.length || payload.freightItems.length || null,
    priority: 'normal',
    status: legacyDbStatus(input.status || payload.data.status),
    notes: nullable(input.observacoes || input.observacoesFinais || input.observacoesLogistica || payload.data.observacoes || payload.data.observacoesFinais),
    requested_by: user.id,
    requested_by_name: nullable(input.solicitanteNome || payload.data.solicitanteNome || user.name),
    delivery_date: dateOnlyOrNull(deliveryDate)
  };
}

function mapLegacyRequest(row: any): FreightRequest {
  const payload = normalizeLegacyPayload(row.items);
  const data = payload.data || {};
  const freightType = (data.freightType || row.type || 'nacional') as FreightType;
  const attachments = payload.attachments || [];

  return {
    id: row.id,
    protocol: protocolFromLegacyRow(row),
    freightType,
    status: normalizeFreightStatus(data.status || uiStatusFromLegacyDb(row.status)),
    setorId: data.setorId,
    setor: data.setor,
    projetoId: data.projetoId,
    projeto: data.projeto,
    projetoDescricao: data.projetoDescricao,
    prazoEntrega: data.prazoEntrega || row.delivery_date,
    solicitanteNome: data.solicitanteNome || row.requested_by_name,
    responsavelEntrega: data.responsavelEntrega,
    itemDescricao: data.itemDescricao,
    responsavelLocal: data.responsavelLocal,
    enderecoRetirada: data.enderecoRetirada || row.origin,
    enderecoEntrega: data.enderecoEntrega || row.destination,
    pagamento: data.pagamento,
    observacoes: data.observacoes || row.notes,
    fotosProdutoUrls: data.fotosProdutoUrls || attachments.filter((item: FreightAttachment) => item.category === 'produto').map((item: FreightAttachment) => item.fileUrl),
    motorista: data.motorista,
    veiculo: data.veiculo,
    placa: data.placa,
    agendamentoAt: data.agendamentoAt,
    atendimentoAt: data.atendimentoAt,
    observacoesLogistica: data.observacoesLogistica,
    fotoEntregaUrls: data.fotoEntregaUrls || attachments.filter((item: FreightAttachment) => item.category === 'entrega').map((item: FreightAttachment) => item.fileUrl),
    necessidade: data.necessidade,
    definitivaTemporaria: data.definitivaTemporaria,
    observacoesNecessidade: data.observacoesNecessidade,
    empresaRemetente: data.empresaRemetente,
    enderecoOrigem: data.enderecoOrigem || row.origin,
    enderecoColetaOrigem: data.enderecoColetaOrigem,
    nomeContatoOrigem: data.nomeContatoOrigem,
    emailContatoOrigem: data.emailContatoOrigem,
    telefoneContatoOrigem: data.telefoneContatoOrigem,
    empresaDestinatario: data.empresaDestinatario,
    enderecoDestino: data.enderecoDestino || row.destination,
    enderecoEntregaDestino: data.enderecoEntregaDestino,
    nomeContatoDestino: data.nomeContatoDestino,
    emailContatoDestino: data.emailContatoDestino,
    telefoneContatoDestino: data.telefoneContatoDestino,
    prazoDesejado: data.prazoDesejado || row.delivery_date,
    tipoFrete: data.tipoFrete,
    modalidadeFrete: data.modalidadeFrete,
    necessitaSeguro: data.necessitaSeguro,
    observacoesFinais: data.observacoesFinais,
    empresaSolicitante: data.empresaSolicitante,
    cnpj: data.cnpj,
    telefoneSolicitante: data.telefoneSolicitante,
    emailSolicitante: data.emailSolicitante,
    responsavelCustos: data.responsavelCustos,
    payloadOriginal: row.items || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByEmail: data.createdByEmail,
    volumes: payload.volumes,
    items: payload.freightItems,
    attachments
  };
}

function mapRequest(row: any): FreightRequest {
  if (!Object.prototype.hasOwnProperty.call(row, 'freight_type') && Object.prototype.hasOwnProperty.call(row, 'type')) {
    return mapLegacyRequest(row);
  }

  return {
    id: row.id,
    protocol: Number(row.protocol || 0),
    freightType: row.freight_type || 'nacional',
    status: normalizeFreightStatus(row.status),
    setorId: row.setor_id || undefined,
    setor: row.setor || undefined,
    projetoId: row.projeto_id || undefined,
    projeto: row.projeto || undefined,
    projetoDescricao: row.projeto_descricao || undefined,
    prazoEntrega: row.prazo_entrega || undefined,
    solicitanteNome: row.solicitante_nome || undefined,
    responsavelEntrega: row.responsavel_entrega || undefined,
    itemDescricao: row.item_descricao || undefined,
    responsavelLocal: row.responsavel_local || undefined,
    enderecoRetirada: row.endereco_retirada || undefined,
    enderecoEntrega: row.endereco_entrega || undefined,
    pagamento: row.pagamento || undefined,
    observacoes: row.observacoes || undefined,
    fotosProdutoUrls: row.fotos_produto_urls || [],
    motorista: row.motorista || undefined,
    veiculo: row.veiculo || undefined,
    placa: row.placa || undefined,
    agendamentoAt: row.agendamento_at || undefined,
    atendimentoAt: row.atendimento_at || undefined,
    observacoesLogistica: row.observacoes_logistica || undefined,
    fotoEntregaUrls: row.foto_entrega_urls || [],
    necessidade: row.necessidade || undefined,
    definitivaTemporaria: row.definitiva_temporaria || undefined,
    observacoesNecessidade: row.observacoes_necessidade || undefined,
    empresaRemetente: row.empresa_remetente || undefined,
    enderecoOrigem: row.endereco_origem || undefined,
    enderecoColetaOrigem: row.endereco_coleta_origem || undefined,
    nomeContatoOrigem: row.nome_contato_origem || undefined,
    emailContatoOrigem: row.email_contato_origem || undefined,
    telefoneContatoOrigem: row.telefone_contato_origem || undefined,
    empresaDestinatario: row.empresa_destinatario || undefined,
    enderecoDestino: row.endereco_destino || undefined,
    enderecoEntregaDestino: row.endereco_entrega_destino || undefined,
    nomeContatoDestino: row.nome_contato_destino || undefined,
    emailContatoDestino: row.email_contato_destino || undefined,
    telefoneContatoDestino: row.telefone_contato_destino || undefined,
    prazoDesejado: row.prazo_desejado || undefined,
    tipoFrete: row.tipo_frete || undefined,
    modalidadeFrete: row.modalidade_frete || undefined,
    necessitaSeguro: row.necessita_seguro || undefined,
    observacoesFinais: row.observacoes_finais || undefined,
    empresaSolicitante: row.empresa_solicitante || undefined,
    cnpj: row.cnpj || undefined,
    telefoneSolicitante: row.telefone_solicitante || undefined,
    emailSolicitante: row.email_solicitante || undefined,
    responsavelCustos: row.responsavel_custos || undefined,
    payloadOriginal: row.payload_original || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByEmail: row.created_by_email || undefined,
    volumes: (row.freight_request_volumes || []).map(mapVolume),
    items: (row.freight_request_items || []).map(mapItem),
    attachments: (row.freight_attachments || []).map(mapAttachment)
  };
}

function mapVolume(row: any): FreightVolume {
  return {
    id: row.id,
    itemNumero: row.item_numero || 1,
    quantidade: row.quantidade == null ? undefined : Number(row.quantidade),
    dimensoes: row.dimensoes || undefined,
    pesoBruto: row.peso_bruto == null ? undefined : Number(row.peso_bruto),
    tipoEmbalagem: row.tipo_embalagem || undefined
  };
}

function mapItem(row: any): FreightItem {
  return {
    id: row.id,
    itemNumero: row.item_numero || 1,
    quantidade: row.quantidade == null ? undefined : Number(row.quantidade),
    descricao: row.descricao || undefined,
    serialPartNumber: row.serial_part_number || undefined,
    ncm: row.ncm || undefined,
    fabricante: row.fabricante || undefined,
    paisOrigem: row.pais_origem || undefined,
    valorItem: row.valor_item == null ? undefined : Number(row.valor_item),
    pesoUnitario: row.peso_unitario == null ? undefined : Number(row.peso_unitario)
  };
}

function mapAttachment(row: any): FreightAttachment {
  return {
    id: row.id,
    freightRequestId: row.freight_request_id || undefined,
    category: row.category || 'produto',
    fileName: row.file_name || undefined,
    fileUrl: row.file_url,
    mimeType: row.mime_type || undefined,
    sizeBytes: row.size_bytes == null ? undefined : Number(row.size_bytes),
    createdAt: row.created_at
  };
}

function requestToRow(input: Partial<FreightRequest>) {
  const freightType = input.freightType || 'nacional';
  const legacyPayload = buildLegacyPayload(input);
  const origin = freightType === 'internacional'
    ? input.enderecoOrigem || input.empresaRemetente
    : input.enderecoRetirada;
  const destination = freightType === 'internacional'
    ? input.enderecoDestino || input.empresaDestinatario
    : input.enderecoEntrega;
  const deliveryDate = input.prazoEntrega || input.prazoDesejado;

  return {
    type: freightType,
    origin: nullable(origin),
    destination: nullable(destination),
    items: legacyPayload,
    weight: sumWeights(input.volumes),
    volume: (input.volumes?.length || input.items?.length) || null,
    priority: 'normal',
    notes: nullable(input.observacoes || input.observacoesFinais || input.observacoesLogistica),
    delivery_date: dateOnlyOrNull(deliveryDate),
    freight_type: freightType,
    status: normalizeFreightStatus(input.status),
    setor_id: uuidOrNull(input.setorId),
    setor: nullable(input.setor),
    projeto_id: uuidOrNull(input.projetoId),
    projeto: nullable(input.projeto),
    projeto_descricao: nullable(input.projetoDescricao),
    prazo_entrega: dateOrNull(input.prazoEntrega),
    solicitante_nome: nullable(input.solicitanteNome),
    responsavel_entrega: nullable(input.responsavelEntrega),
    item_descricao: nullable(input.itemDescricao),
    responsavel_local: nullable(input.responsavelLocal),
    endereco_retirada: nullable(input.enderecoRetirada),
    endereco_entrega: nullable(input.enderecoEntrega),
    pagamento: nullable(input.pagamento),
    observacoes: nullable(input.observacoes),
    fotos_produto_urls: onlyTruthy(input.fotosProdutoUrls),
    motorista: nullable(input.motorista),
    veiculo: nullable(input.veiculo),
    placa: nullable(input.placa),
    agendamento_at: dateOrNull(input.agendamentoAt),
    atendimento_at: dateOrNull(input.atendimentoAt),
    observacoes_logistica: nullable(input.observacoesLogistica),
    foto_entrega_urls: onlyTruthy(input.fotoEntregaUrls),
    necessidade: nullable(input.necessidade),
    definitiva_temporaria: nullable(input.definitivaTemporaria),
    observacoes_necessidade: nullable(input.observacoesNecessidade),
    empresa_remetente: nullable(input.empresaRemetente),
    endereco_origem: nullable(input.enderecoOrigem),
    endereco_coleta_origem: nullable(input.enderecoColetaOrigem),
    nome_contato_origem: nullable(input.nomeContatoOrigem),
    email_contato_origem: nullable(input.emailContatoOrigem),
    telefone_contato_origem: nullable(input.telefoneContatoOrigem),
    empresa_destinatario: nullable(input.empresaDestinatario),
    endereco_destino: nullable(input.enderecoDestino),
    endereco_entrega_destino: nullable(input.enderecoEntregaDestino),
    nome_contato_destino: nullable(input.nomeContatoDestino),
    email_contato_destino: nullable(input.emailContatoDestino),
    telefone_contato_destino: nullable(input.telefoneContatoDestino),
    prazo_desejado: nullable(input.prazoDesejado),
    tipo_frete: nullable(input.tipoFrete),
    modalidade_frete: nullable(input.modalidadeFrete),
    necessita_seguro: nullable(input.necessitaSeguro),
    observacoes_finais: nullable(input.observacoesFinais),
    empresa_solicitante: nullable(input.empresaSolicitante),
    cnpj: nullable(input.cnpj),
    telefone_solicitante: nullable(input.telefoneSolicitante),
    email_solicitante: nullable(input.emailSolicitante),
    responsavel_custos: nullable(input.responsavelCustos),
    payload_original: input.payloadOriginal || {}
  };
}

function partialRequestToRow(input: Partial<FreightRequest>) {
  const row: Record<string, unknown> = {};
  const set = (prop: keyof FreightRequest, column: string, mapper: (value: unknown) => unknown = nullable) => {
    if (Object.prototype.hasOwnProperty.call(input, prop)) {
      row[column] = mapper(input[prop]);
    }
  };

  set('freightType', 'type', value => value || undefined);
  set('freightType', 'freight_type', value => value || undefined);
  set('status', 'status', value => normalizeFreightStatus(String(value || REQUESTED_FREIGHT_STATUS)));
  set('enderecoRetirada', 'origin');
  set('enderecoEntrega', 'destination');
  set('observacoes', 'notes');
  set('prazoEntrega', 'delivery_date', dateOnlyOrNull);
  set('setorId', 'setor_id', uuidOrNull);
  set('setor', 'setor');
  set('projetoId', 'projeto_id', uuidOrNull);
  set('projeto', 'projeto');
  set('projetoDescricao', 'projeto_descricao');
  set('prazoEntrega', 'prazo_entrega', dateOrNull);
  set('solicitanteNome', 'solicitante_nome');
  set('responsavelEntrega', 'responsavel_entrega');
  set('itemDescricao', 'item_descricao');
  set('responsavelLocal', 'responsavel_local');
  set('enderecoRetirada', 'endereco_retirada');
  set('enderecoEntrega', 'endereco_entrega');
  set('pagamento', 'pagamento');
  set('observacoes', 'observacoes');
  set('fotosProdutoUrls', 'fotos_produto_urls', value => onlyTruthy(value as string[]));
  set('motorista', 'motorista');
  set('veiculo', 'veiculo');
  set('placa', 'placa');
  set('agendamentoAt', 'agendamento_at', dateOrNull);
  set('atendimentoAt', 'atendimento_at', dateOrNull);
  set('observacoesLogistica', 'observacoes_logistica');
  set('fotoEntregaUrls', 'foto_entrega_urls', value => onlyTruthy(value as string[]));
  set('necessidade', 'necessidade');
  set('definitivaTemporaria', 'definitiva_temporaria');
  set('observacoesNecessidade', 'observacoes_necessidade');
  set('empresaRemetente', 'empresa_remetente');
  set('enderecoOrigem', 'endereco_origem');
  set('enderecoColetaOrigem', 'endereco_coleta_origem');
  set('nomeContatoOrigem', 'nome_contato_origem');
  set('emailContatoOrigem', 'email_contato_origem');
  set('telefoneContatoOrigem', 'telefone_contato_origem');
  set('empresaDestinatario', 'empresa_destinatario');
  set('enderecoDestino', 'endereco_destino');
  set('enderecoEntregaDestino', 'endereco_entrega_destino');
  set('nomeContatoDestino', 'nome_contato_destino');
  set('emailContatoDestino', 'email_contato_destino');
  set('telefoneContatoDestino', 'telefone_contato_destino');
  set('prazoDesejado', 'prazo_desejado');
  set('tipoFrete', 'tipo_frete');
  set('modalidadeFrete', 'modalidade_frete');
  set('necessitaSeguro', 'necessita_seguro');
  set('observacoesFinais', 'observacoes_finais');
  set('empresaSolicitante', 'empresa_solicitante');
  set('cnpj', 'cnpj');
  set('telefoneSolicitante', 'telefone_solicitante');
  set('emailSolicitante', 'email_solicitante');
  set('responsavelCustos', 'responsavel_custos');
  set('payloadOriginal', 'payload_original', value => value || {});
  return row;
}

function volumeToRow(requestId: string, volume: FreightVolume) {
  return {
    freight_request_id: requestId,
    item_numero: volume.itemNumero || 1,
    quantidade: numOrNull(volume.quantidade),
    dimensoes: nullable(volume.dimensoes),
    peso_bruto: numOrNull(volume.pesoBruto),
    tipo_embalagem: nullable(volume.tipoEmbalagem)
  };
}

function itemToRow(requestId: string, item: FreightItem) {
  return {
    freight_request_id: requestId,
    item_numero: item.itemNumero || 1,
    quantidade: numOrNull(item.quantidade),
    descricao: nullable(item.descricao),
    serial_part_number: nullable(item.serialPartNumber),
    ncm: nullable(item.ncm),
    fabricante: nullable(item.fabricante),
    pais_origem: nullable(item.paisOrigem),
    valor_item: numOrNull(item.valorItem),
    peso_unitario: numOrNull(item.pesoUnitario)
  };
}

async function hydrateFreightRows(rows: any[]): Promise<FreightRequest[]> {
  const ids = rows.map(row => row.id).filter(Boolean);
  if (!ids.length) return rows.map(mapRequest);

  const [volumesResult, itemsResult, attachmentsResult] = await Promise.all([
    supabase.from('freight_request_volumes').select('*').in('freight_request_id', ids),
    supabase.from('freight_request_items').select('*').in('freight_request_id', ids),
    supabase.from('freight_attachments').select('*').in('freight_request_id', ids)
  ]);

  if (volumesResult.error || itemsResult.error || attachmentsResult.error) {
    const relationshipError = volumesResult.error || itemsResult.error || attachmentsResult.error;
    throw relationshipError;
  }

  const groupByRequest = (records: any[] = []) =>
    records.reduce((acc: Record<string, any[]>, record) => {
      const requestId = record.freight_request_id;
      if (!acc[requestId]) acc[requestId] = [];
      acc[requestId].push(record);
      return acc;
    }, {});

  const volumes = groupByRequest(volumesResult.data || []);
  const items = groupByRequest(itemsResult.data || []);
  const attachments = groupByRequest(attachmentsResult.data || []);

  return rows.map(row => mapRequest({
    ...row,
    freight_request_volumes: volumes[row.id] || [],
    freight_request_items: items[row.id] || [],
    freight_attachments: attachments[row.id] || []
  }));
}

async function currentUserMeta() {
  const user = await getCurrentUser();
  return {
    id: user?.id || null,
    email: user?.email || null,
    name: user?.name || user?.email || 'Usuario'
  };
}

export async function getFreightLookups(): Promise<FreightLookups> {
  const [setoresResult, projetosResult, optionsResult] = await Promise.all([
    supabase.from('setor').select('id, setor, descricao, responsavel').order('setor', { ascending: true }),
    supabase.from('projeto').select('id, projeto, descricao').order('projeto', { ascending: true }),
    supabase.from('freight_master_options').select('*').eq('active', true).order('sort_order', { ascending: true })
  ]);

  if (optionsResult.error) schemaModeCache = 'legacy';

  const options = optionsResult.data || [];
  const byCategory = (category: string): FreightLookupOption[] =>
    options
      .filter((row: any) => row.category === category)
      .map((row: any) => ({
        id: row.id,
        label: row.label,
        value: row.value,
        metadata: row.metadata || {},
        source: 'freight_master_options'
      }));

  const freightSetores = byCategory('setor_frete');
  const freightProjetos = byCategory('projeto_frete');
  const normalizeStatusOptions = (items: FreightLookupOption[], fallback: FreightLookupOption[]) => {
    const seen = new Set<string>();
    return (items.length ? items : fallback)
      .map(option => {
        const status = normalizeFreightStatus(option.value || option.label);
        return {
          ...option,
          label: status,
          value: status
        };
      })
      .filter(option => {
        if (seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      });
  };
  const fallbackSetores = (setoresResult.data || []).map((row: any) => ({
    id: row.id,
    label: row.descricao ? `${row.setor} - ${row.descricao}` : row.setor,
    value: row.setor,
    metadata: { descricao: row.descricao, responsavel: row.responsavel },
    source: 'setor'
  }));
  const fallbackProjetos = (projetosResult.data || []).map((row: any) => ({
    id: row.id,
    label: row.descricao ? `${row.projeto} - ${row.descricao}` : row.projeto,
    value: row.projeto,
    metadata: { descricao: row.descricao },
    source: 'projeto'
  }));

  return {
    setores: freightSetores.length ? freightSetores : fallbackSetores,
    projetos: freightProjetos.length ? freightProjetos : fallbackProjetos,
    motoristas: byCategory('motorista'),
    veiculos: byCategory('veiculo'),
    enderecos: byCategory('endereco_recorrente'),
    statusNacional: normalizeStatusOptions(byCategory('status_nacional'), DEFAULT_STATUS_NACIONAL),
    statusInternacional: normalizeStatusOptions(byCategory('status_internacional'), DEFAULT_STATUS_INTERNACIONAL),
    tiposFrete: byCategory('tipo_frete_internacional').length ? byCategory('tipo_frete_internacional') : DEFAULT_TIPOS_FRETE,
    modalidades: byCategory('modalidade_frete').length ? byCategory('modalidade_frete') : DEFAULT_MODALIDADES,
    embalagens: byCategory('tipo_embalagem').length ? byCategory('tipo_embalagem') : DEFAULT_EMBALAGENS,
    sla: byCategory('sla')
  };
}

export async function saveFreightMasterOption(category: string, label: string, metadata?: Record<string, unknown>) {
  const value = label.trim();
  if (!value) throw new Error('Informe um valor.');

  if (await getSchemaMode() === 'legacy') return;

  const { error } = await supabase
    .from('freight_master_options')
    .upsert({
      category,
      label: value,
      value,
      metadata: metadata || {},
      active: true
    }, { onConflict: 'category,value' });

  if (error) throw error;
}

export async function getFreightMasterOptions(includeInactive = true): Promise<FreightMasterOptionRecord[]> {
  let query = supabase
    .from('freight_master_options')
    .select('id, category, label, value, metadata, active, sort_order')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (!includeInactive) query = query.eq('active', true);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    category: row.category,
    label: row.label,
    value: row.value,
    metadata: row.metadata || {},
    active: row.active !== false,
    sortOrder: row.sort_order == null ? undefined : Number(row.sort_order)
  }));
}

export async function saveFreightMasterOptionRecord(input: FreightMasterOptionRecord): Promise<void> {
  const category = text(input.category);
  const value = text(input.value || input.label);
  const label = text(input.label || input.value);

  if (!category) throw new Error('Categoria inválida.');
  if (!value || !label) throw new Error('Informe código/valor e descrição.');

  const row = {
    category,
    label,
    value,
    metadata: input.metadata || {},
    active: input.active !== false,
    sort_order: input.sortOrder ?? 0
  };

  const request = input.id
    ? supabase.from('freight_master_options').update(row).eq('id', input.id)
    : supabase.from('freight_master_options').upsert(row, { onConflict: 'category,value' });

  const { error } = await request;
  if (error) throw error;
}

export async function setFreightMasterOptionActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('freight_master_options')
    .update({ active })
    .eq('id', id);

  if (error) throw error;
}

export async function getFreightRequests(filters: FreightFilters = {}): Promise<FreightRequest[]> {
  if (await getSchemaMode() === 'legacy') {
    let legacyQuery = supabase
      .from('freight_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (filters.type) legacyQuery = legacyQuery.eq('type', filters.type);

    const { data, error } = await legacyQuery;
    if (error) throw error;

    let rows = (data || []).map(mapLegacyRequest);
    if (filters.status && filters.status !== 'Todos') {
      rows = rows.filter(request => normalizeFreightStatus(request.status) === normalizeFreightStatus(filters.status));
    }
    if (filters.onlyPending) {
      rows = rows.filter(request => isRequestedFreightStatus(request.status));
    }
    if (filters.motorista && filters.motorista !== 'TODOS') {
      const motorista = filters.motorista.toLowerCase();
      rows = rows.filter(request => String(request.motorista || '').toLowerCase().includes(motorista));
    }

    const search = filters.search?.trim().toLowerCase();
    if (!search) return rows;

    return rows.filter(request => [
      request.protocol,
      request.setor,
      request.projeto,
      request.solicitanteNome,
      request.itemDescricao,
      request.motorista,
      request.veiculo,
      request.placa,
      request.necessidade,
      request.empresaRemetente,
      request.empresaDestinatario,
      request.enderecoRetirada,
      request.enderecoEntrega,
      request.enderecoOrigem,
      request.enderecoDestino
    ].some(value => String(value || '').toLowerCase().includes(search)));
  }

  let query = supabase
    .from('freight_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (filters.type) query = query.eq('freight_type', filters.type);
  if (filters.status && filters.status !== 'Todos') {
    const status = normalizeFreightStatus(filters.status);
    query = isRequestedFreightStatus(status) ? query.in('status', [REQUESTED_FREIGHT_STATUS, 'Pendente']) : query.eq('status', status);
  }
  if (filters.onlyPending) query = query.in('status', [REQUESTED_FREIGHT_STATUS, 'Pendente']);
  if (filters.motorista && filters.motorista !== 'TODOS') query = query.ilike('motorista', `%${filters.motorista}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = await hydrateFreightRows(data || []);
  const search = filters.search?.trim().toLowerCase();
  if (!search) return rows;

  return rows.filter(request => [
    request.protocol,
    request.setor,
    request.projeto,
    request.solicitanteNome,
    request.itemDescricao,
    request.motorista,
    request.veiculo,
    request.placa,
    request.necessidade,
    request.empresaRemetente,
    request.empresaDestinatario
  ].some(value => String(value || '').toLowerCase().includes(search)));
}

export async function getFreightRequest(id: string): Promise<FreightRequest | null> {
  if (await getSchemaMode() === 'legacy') {
    const { data, error } = await supabase
      .from('freight_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapLegacyRequest(data) : null;
  }

  const { data, error } = await supabase
    .from('freight_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const hydrated = await hydrateFreightRows([data]);
  return hydrated[0] || null;
}

export async function createFreightRequest(input: CreateFreightInput): Promise<FreightRequest> {
  const user = await currentUserMeta();

  if (await getSchemaMode() === 'legacy') {
    const createdPayload = buildLegacyPayload({
      ...input,
      createdByEmail: user.email || undefined
    });
    createdPayload.history = [{
      id: crypto.randomUUID(),
      freightRequestId: '',
      action: 'created',
      newStatus: normalizeFreightStatus(input.status),
      comment: `Solicitação ${input.freightType} criada.`,
      changedAt: new Date().toISOString(),
      changedByEmail: user.email || undefined
    }];

    const { data, error } = await supabase
      .from('freight_requests')
      .insert({
        ...legacyRequestToRow({
          ...input,
          createdByEmail: user.email || undefined,
          payloadOriginal: createdPayload
        }, user, createdPayload),
        items: createdPayload
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapLegacyRequest(data);
  }

  const row = {
    ...requestToRow(input),
    requested_by: user.id,
    requested_by_name: nullable(input.solicitanteNome || user.name),
    created_by: user.id,
    updated_by: user.id,
    created_by_email: user.email
  };

  const data = await insertFreightRequestRow(row);

  const request = mapRequest(data);
  const volumes = (input.volumes || []).filter(volume => volume.quantidade || volume.dimensoes || volume.pesoBruto || volume.tipoEmbalagem);
  const items = (input.items || []).filter(item => item.quantidade || item.descricao || item.serialPartNumber || item.ncm || item.fabricante || item.paisOrigem || item.valorItem || item.pesoUnitario);

  if (volumes.length) {
    const { error: volumesError } = await supabase.from('freight_request_volumes').insert(volumes.map(volume => volumeToRow(request.id, volume)));
    if (volumesError) throw volumesError;
  }

  if (items.length) {
    const { error: itemsError } = await supabase.from('freight_request_items').insert(items.map(item => itemToRow(request.id, item)));
    if (itemsError) throw itemsError;
  }

  await appendFreightHistory(request.id, {
    action: 'created',
    newStatus: request.status,
    comment: `Solicitação ${request.freightType} criada.`
  });

  return (await getFreightRequest(request.id)) || request;
}

export async function updateFreightRequest(id: string, input: Partial<FreightRequest>): Promise<void> {
  const user = await currentUserMeta();

  if (await getSchemaMode() === 'legacy') {
    const current = await getFreightRequest(id);
    if (!current) throw new Error('Solicitação de frete não encontrada.');
    const merged = {
      ...current,
      ...input,
      volumes: input.volumes ?? current.volumes,
      items: input.items ?? current.items,
      attachments: input.attachments ?? current.attachments
    };

    const { error } = await supabase
      .from('freight_requests')
      .update(legacyRequestToRow(merged, user, current.payloadOriginal))
      .eq('id', id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('freight_requests')
    .update({
      ...partialRequestToRow(input),
      updated_by: user.id
    })
    .eq('id', id);

  if (error) throw error;
}

export async function replaceFreightCollections(
  requestId: string,
  volumes: FreightVolume[],
  items: FreightItem[]
): Promise<void> {
  if (await getSchemaMode() === 'legacy') {
    await updateFreightRequest(requestId, { volumes, items });
    return;
  }

  const [volumesDelete, itemsDelete] = await Promise.all([
    supabase.from('freight_request_volumes').delete().eq('freight_request_id', requestId),
    supabase.from('freight_request_items').delete().eq('freight_request_id', requestId)
  ]);

  if (volumesDelete.error) throw volumesDelete.error;
  if (itemsDelete.error) throw itemsDelete.error;

  const cleanVolumes = volumes.filter(volume => volume.quantidade || volume.dimensoes || volume.pesoBruto || volume.tipoEmbalagem);
  const cleanItems = items.filter(item => item.quantidade || item.descricao || item.serialPartNumber || item.ncm || item.fabricante || item.paisOrigem || item.valorItem || item.pesoUnitario);

  if (cleanVolumes.length) {
    const { error } = await supabase.from('freight_request_volumes').insert(cleanVolumes.map(volume => volumeToRow(requestId, volume)));
    if (error) throw error;
  }

  if (cleanItems.length) {
    const { error } = await supabase.from('freight_request_items').insert(cleanItems.map(item => itemToRow(requestId, item)));
    if (error) throw error;
  }
}

export async function updateFreightStatus(
  request: FreightRequest,
  newStatus: FreightStatus,
  comment?: string,
  extra?: Partial<FreightRequest>
): Promise<void> {
  const user = await currentUserMeta();

  if (await getSchemaMode() === 'legacy') {
    const current = await getFreightRequest(request.id);
    if (!current) throw new Error('Solicitação de frete não encontrada.');
    const previousPayload = normalizeLegacyPayload(current.payloadOriginal);
    const history = [
      {
        id: crypto.randomUUID(),
        freightRequestId: request.id,
        action: 'status_change',
        previousStatus: request.status,
        newStatus,
        comment,
        changedAt: new Date().toISOString(),
        changedByEmail: user.email || undefined
      },
      ...previousPayload.history
    ];
    const merged = {
      ...current,
      ...extra,
      status: newStatus,
      volumes: extra?.volumes ?? current.volumes,
      items: extra?.items ?? current.items,
      attachments: extra?.attachments ?? current.attachments
    };
    const payload = buildLegacyPayload(merged, current.payloadOriginal);
    payload.history = history;

    const { error } = await supabase
      .from('freight_requests')
      .update({
        ...legacyRequestToRow(merged, user, payload),
        items: payload,
        status: legacyDbStatus(newStatus)
      })
      .eq('id', request.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('freight_requests')
    .update({
      ...partialRequestToRow({ ...extra, status: newStatus }),
      status: newStatus,
      updated_by: user.id
    })
    .eq('id', request.id);

  if (error) throw error;

  await appendFreightHistory(request.id, {
    action: 'status_change',
    previousStatus: request.status,
    newStatus,
    comment,
    payload: extra || {}
  });
}

export async function appendFreightHistory(
  requestId: string,
  input: {
    action: string;
    previousStatus?: string;
    newStatus?: string;
    comment?: string;
    payload?: Record<string, unknown>;
  }
) {
  const user = await currentUserMeta();

  if (await getSchemaMode() === 'legacy') {
    const { data, error: readError } = await supabase
      .from('freight_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (readError) throw readError;
    if (!data) throw new Error('Solicitação de frete não encontrada.');

    const payload = normalizeLegacyPayload(data.items);
    payload.history = [
      {
        id: crypto.randomUUID(),
        freightRequestId: requestId,
        action: input.action,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        comment: input.comment,
        changedAt: new Date().toISOString(),
        changedByEmail: user.email || undefined,
        payload: input.payload || {}
      },
      ...payload.history
    ];

    const { error } = await supabase
      .from('freight_requests')
      .update({ items: { ...(data.items || {}), history: payload.history } })
      .eq('id', requestId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('freight_status_history').insert({
    freight_request_id: requestId,
    action: input.action,
    previous_status: input.previousStatus || null,
    new_status: input.newStatus || null,
    comment: input.comment || null,
    changed_by: user.id,
    changed_by_email: user.email,
    payload: input.payload || {}
  });
  if (error) throw error;
}

export async function getFreightHistory(requestId: string): Promise<FreightHistory[]> {
  if (await getSchemaMode() === 'legacy') {
    const { data, error } = await supabase
      .from('freight_requests')
      .select('items')
      .eq('id', requestId)
      .maybeSingle();

    if (error) throw error;
    return normalizeLegacyPayload(data?.items).history.map((row: any) => ({
      id: row.id || crypto.randomUUID(),
      freightRequestId: row.freightRequestId || requestId,
      action: row.action || 'status_change',
      previousStatus: row.previousStatus,
      newStatus: row.newStatus,
      comment: row.comment,
      changedAt: row.changedAt || new Date().toISOString(),
      changedByEmail: row.changedByEmail
    }));
  }

  const { data, error } = await supabase
    .from('freight_status_history')
    .select('*')
    .eq('freight_request_id', requestId)
    .order('changed_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    freightRequestId: row.freight_request_id,
    action: row.action,
    previousStatus: row.previous_status || undefined,
    newStatus: row.new_status || undefined,
    comment: row.comment || undefined,
    changedAt: row.changed_at,
    changedByEmail: row.changed_by_email || undefined
  }));
}

export async function uploadFreightFiles(
  requestId: string,
  files: File[],
  category: FreightAttachment['category']
): Promise<FreightAttachment[]> {
  if (!files.length) return [];
  const user = await currentUserMeta();
  const uploaded: FreightAttachment[] = [];
  const legacyMode = await getSchemaMode() === 'legacy';
  const bucketName = legacyMode ? 'wheel-damage-photos' : 'freight-attachments';

  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = legacyMode
      ? `freight/${requestId}/${category}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
      : `${requestId}/${category}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(path);
    const attachmentRow = {
      freight_request_id: requestId,
      category,
      file_name: file.name,
      file_url: urlData.publicUrl,
      mime_type: file.type || null,
      size_bytes: file.size,
      created_by: user.id
    };

    if (legacyMode) {
      uploaded.push({
        id: crypto.randomUUID(),
        freightRequestId: requestId,
        category,
        fileName: file.name,
        fileUrl: urlData.publicUrl,
        mimeType: file.type || undefined,
        sizeBytes: file.size,
        createdAt: new Date().toISOString()
      });
      continue;
    }

    const { data, error } = await supabase
      .from('freight_attachments')
      .insert(attachmentRow)
      .select('*')
      .single();

    if (error) throw error;
    uploaded.push(mapAttachment(data));
  }

  const request = await getFreightRequest(requestId);
  if (request) {
    const productUrls = [
      ...request.fotosProdutoUrls,
      ...uploaded.filter(item => item.category === 'produto').map(item => item.fileUrl)
    ];
    const deliveryUrls = [
      ...request.fotoEntregaUrls,
      ...uploaded.filter(item => item.category === 'entrega').map(item => item.fileUrl)
    ];

    const urlListsChanged = productUrls.length !== request.fotosProdutoUrls.length || deliveryUrls.length !== request.fotoEntregaUrls.length;
    if (legacyMode && uploaded.length) {
      await updateFreightRequest(requestId, {
        fotosProdutoUrls: productUrls,
        fotoEntregaUrls: deliveryUrls,
        attachments: [
          ...(request.attachments || []),
          ...uploaded
        ]
      });
    } else if (urlListsChanged) {
      if (legacyMode) {
        await updateFreightRequest(requestId, {
          fotosProdutoUrls: productUrls,
          fotoEntregaUrls: deliveryUrls,
          attachments: [
            ...(request.attachments || []),
            ...uploaded
          ]
        });
      } else {
        const { error } = await supabase
          .from('freight_requests')
          .update({
            fotos_produto_urls: productUrls,
            foto_entrega_urls: deliveryUrls,
            updated_by: user.id
          })
          .eq('id', requestId);
        if (error) throw error;
      }
    }
  }

  return uploaded;
}

export async function deleteFreightAttachment(
  requestId: string,
  attachment: Pick<FreightAttachment, 'id' | 'fileUrl' | 'category'>
): Promise<void> {
  const user = await currentUserMeta();
  const current = await getFreightRequest(requestId);
  if (!current) throw new Error('Solicitação de frete não encontrada.');

  const nextAttachments = (current.attachments || []).filter(item => {
    if (attachment.id && item.id) return item.id !== attachment.id;
    return item.fileUrl !== attachment.fileUrl;
  });
  const nextProductUrls = current.fotosProdutoUrls.filter(url => url !== attachment.fileUrl);
  const nextDeliveryUrls = current.fotoEntregaUrls.filter(url => url !== attachment.fileUrl);

  if (await getSchemaMode() === 'legacy') {
    await updateFreightRequest(requestId, {
      fotosProdutoUrls: nextProductUrls,
      fotoEntregaUrls: nextDeliveryUrls,
      attachments: nextAttachments
    });
    return;
  }

  let deleteQuery = supabase
    .from('freight_attachments')
    .delete()
    .eq('freight_request_id', requestId);

  deleteQuery = attachment.id
    ? deleteQuery.eq('id', attachment.id)
    : deleteQuery.eq('file_url', attachment.fileUrl).eq('category', attachment.category);

  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  const { error } = await supabase
    .from('freight_requests')
    .update({
      fotos_produto_urls: nextProductUrls,
      foto_entrega_urls: nextDeliveryUrls,
      updated_by: user.id
    })
    .eq('id', requestId);

  if (error) throw error;
}

export async function sendFreightNotification(requestId: string, eventType: 'created' | 'status') {
  try {
    const response = await fetch('/api/freight/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, eventType })
    });
    return await response.json().catch(() => ({}));
  } catch (error) {
    console.warn('Falha ao chamar API de e-mail de frete:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Falha de rede' };
  }
}

export function formatFreightDate(value?: string, withTime = true) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: withTime ? '2-digit' : undefined,
    minute: withTime ? '2-digit' : undefined
  }).format(date);
}

export function freightLane(status: string) {
  const normalized = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('cancel')) return 'cancelado';
  if (normalized.includes('concluido')) return 'finalizado';
  if (normalized.includes('em rota') || normalized.includes('transito')) return 'em_rota';
  if (normalized.includes('agendado') || normalized.includes('cotacao') || normalized.includes('aguardando')) return 'em_andamento';
  return 'nao_iniciado';
}
