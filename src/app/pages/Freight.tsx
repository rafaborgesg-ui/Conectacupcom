import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardList,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  Globe2,
  Info,
  Lock,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Save,
  Search,
  Smartphone,
  Truck,
  Upload,
  X
} from 'lucide-react';
import {
  appendFreightHistory,
  createFreightRequest,
  deleteFreightAttachment,
  formatFreightDate,
  freightLane,
  getFreightHistory,
  getFreightLookups,
  getFreightRequests,
  isRequestedFreightStatus,
  replaceFreightCollections,
  saveFreightMasterOption,
  sendFreightNotification,
  updateFreightRequest,
  updateFreightStatus,
  uploadFreightFiles,
  type FreightHistory,
  type FreightItem,
  type FreightLookupOption,
  type FreightRequest,
  type FreightStatus,
  type FreightVolume
} from '../utils/freightStorage';
import { usePermissions } from '../utils/usePermissions';
import { getChassis, type Chassis } from '../utils/chassisStorage';
import { createClient } from '../utils/supabase/client';

type FreightMode = 'nacional' | 'motorista' | 'internacional';
type TabKey = 'dashboard' | 'nova' | 'atendimento' | 'kanban' | 'motorista' | 'relatorios';

const laneLabels: Record<string, string> = {
  nao_iniciado: 'Aguardando agendamento',
  em_andamento: 'Agendado',
  em_rota: 'Em Rota',
  finalizado: 'Entregue'
};

const laneOrder = ['nao_iniciado', 'em_andamento', 'em_rota', 'finalizado'];

const laneTargetStatus: Record<string, FreightStatus> = {
  nao_iniciado: 'Solicitado',
  em_andamento: 'Agendado',
  em_rota: 'Em Rota',
  finalizado: 'Concluído'
};

const laneStyles: Record<string, { border: string; bg: string; soft: string }> = {
  nao_iniciado: {
    border: 'bg-slate-300',
    bg: 'bg-slate-50',
    soft: 'bg-slate-100 text-slate-600'
  },
  em_andamento: {
    border: 'bg-amber-400',
    bg: 'bg-amber-50',
    soft: 'bg-amber-100 text-amber-700'
  },
  em_rota: {
    border: 'bg-blue-500',
    bg: 'bg-blue-50',
    soft: 'bg-blue-100 text-blue-700'
  },
  finalizado: {
    border: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    soft: 'bg-emerald-100 text-emerald-700'
  }
};

const statusOptionsNational: FreightStatus[] = ['Solicitado', 'Agendado', 'Em Rota', 'Concluído', 'Cancelado'];
const statusOptionsInternational: FreightStatus[] = ['Solicitado', 'Em cotação', 'Aguardando coleta', 'Em trânsito', 'Desembaraço', 'Concluído', 'Cancelado'];
const driverVisibleStatuses = new Set<FreightStatus>(['Agendado', 'Em Rota']);

const emptyNationalForm = {
  setor: '',
  setorId: '',
  prazoEntrega: '',
  projeto: '',
  projetoId: '',
  projetoDescricao: '',
  solicitanteNome: '',
  itemDescricao: '',
  responsavelLocal: '',
  enderecoRetirada: '',
  enderecoEntrega: '',
  observacoes: ''
};

type BatchItem = {
  id: string;
  itemDescricao: string;
  overrideOpen: boolean;
  prazoEntrega: string;
  enderecoRetirada: string;
  enderecoEntrega: string;
  responsavelLocal: string;
  observacoes: string;
};

function emptyBatchItem(): BatchItem {
  return {
    id: Math.random().toString(36).slice(2),
    itemDescricao: '',
    overrideOpen: false,
    prazoEntrega: '',
    enderecoRetirada: '',
    enderecoEntrega: '',
    responsavelLocal: '',
    observacoes: '',
  };
}

const emptyNationalEditForm = {
  ...emptyNationalForm,
  status: 'Solicitado' as FreightStatus,
  motorista: '',
  veiculo: '',
  placa: '',
  agendamentoAt: '',
  observacoesLogistica: ''
};

const emptyInternationalForm = {
  necessidade: '',
  definitivaTemporaria: '',
  observacoesNecessidade: '',
  empresaRemetente: '',
  enderecoOrigem: '',
  enderecoColetaOrigem: '',
  nomeContatoOrigem: '',
  emailContatoOrigem: '',
  telefoneContatoOrigem: '',
  empresaDestinatario: '',
  enderecoDestino: '',
  enderecoEntregaDestino: '',
  nomeContatoDestino: '',
  emailContatoDestino: '',
  telefoneContatoDestino: '',
  prazoDesejado: '',
  tipoFrete: 'Rodoviário',
  modalidadeFrete: '',
  necessitaSeguro: 'Sim',
  observacoesFinais: '',
  solicitanteNome: '',
  empresaSolicitante: '',
  cnpj: '',
  telefoneSolicitante: '',
  emailSolicitante: '',
  responsavelCustos: ''
};

const newVolume = (itemNumero = 1): FreightVolume => ({
  itemNumero,
  quantidade: undefined,
  dimensoes: '',
  pesoBruto: undefined,
  tipoEmbalagem: 'Palete'
});

const newItem = (itemNumero = 1): FreightItem => ({
  itemNumero,
  quantidade: undefined,
  descricao: '',
  serialPartNumber: '',
  ncm: '',
  fabricante: '',
  paisOrigem: '',
  valorItem: undefined,
  pesoUnitario: undefined
});

function statusBadgeClass(status: string) {
  const lane = freightLane(status);
  if (status === 'Cancelado') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (status === 'Em cotação' || status === 'Aguardando coleta' || status === 'Desembaraço') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (lane === 'finalizado') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (lane === 'em_rota') return 'bg-red-50 text-red-700 border-red-200';
  if (lane === 'em_andamento') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function isDriverVisibleStatus(status?: string | null) {
  return driverVisibleStatuses.has(status as FreightStatus);
}

function fieldClass() {
  return 'box-border block h-12 w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-4 text-base leading-normal text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-50 disabled:text-slate-400 sm:h-10 sm:px-3 sm:text-sm';
}

function areaClass() {
  return 'min-h-24 w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100';
}

function buttonClass(variant: 'primary' | 'secondary' | 'dark' | 'danger' = 'secondary') {
  const base = 'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    primary: 'bg-red-600 text-white hover:bg-red-700',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    dark: 'bg-slate-950 text-white hover:bg-slate-800',
    danger: 'bg-red-50 text-red-700 hover:bg-red-100'
  };
  return `${base} ${variants[variant]}`;
}

function labelClass() {
  return 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';
}

function normalizeNumber(value: string) {
  if (value === '') return undefined;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatProtocol(request: FreightRequest) {
  return `#${String(request.protocol || 0).padStart(4, '0')}`;
}

type FreightMedia = {
  id?: string;
  fileUrl: string;
  fileName?: string;
  category: FreightAttachmentCategory;
  mimeType?: string;
  isImage: boolean;
};

type FreightAttachmentCategory = FreightRequest['attachments'] extends Array<infer Attachment>
  ? Attachment extends { category: infer Category }
    ? Category
    : string
  : string;

function isImageUrl(url?: string, mimeType?: string) {
  if (mimeType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)(\?.*)?$/i.test(url || '');
}

function getFreightMedia(request: FreightRequest, categories?: FreightAttachmentCategory[]): FreightMedia[] {
  const allowed = categories?.length ? new Set<string>(categories) : null;
  const seen = new Set<string>();
  const media: FreightMedia[] = [];
  const add = (item: { id?: string; fileUrl?: string; fileName?: string; category?: FreightAttachmentCategory; mimeType?: string }) => {
    const fileUrl = String(item.fileUrl || '').trim();
    const category = item.category || 'produto';
    if (!fileUrl || seen.has(fileUrl) || (allowed && !allowed.has(String(category)))) return;
    seen.add(fileUrl);
    media.push({
      id: item.id,
      fileUrl,
      fileName: item.fileName,
      category,
      mimeType: item.mimeType,
      isImage: isImageUrl(fileUrl, item.mimeType)
    });
  };

  (request.attachments || []).forEach(add);
  request.fotosProdutoUrls.forEach((fileUrl, index) => add({ fileUrl, fileName: `Foto do produto ${index + 1}`, category: 'produto' }));
  request.fotoEntregaUrls.forEach((fileUrl, index) => add({ fileUrl, fileName: `Foto da entrega ${index + 1}`, category: 'entrega' }));
  return media;
}

function FreightMediaSection({
  title,
  media,
  compact = false,
  onRemove,
  removingUrl
}: {
  title: string;
  media: FreightMedia[];
  compact?: boolean;
  onRemove?: (file: FreightMedia) => void;
  removingUrl?: string | null;
}) {
  if (!media.length) return null;

  const imageMedia = media.filter(file => file.isImage);
  const documentMedia = media.filter(file => !file.isImage);
  const visibleImages = compact ? imageMedia.slice(0, 2) : imageMedia;
  const hiddenImageCount = imageMedia.length - visibleImages.length;

  return (
    <div className="min-w-0 space-y-2">
      <h4 className={`font-bold text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>{title}</h4>
      {visibleImages.length ? (
        <div className={`grid min-w-0 gap-2 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {visibleImages.map((file, index) => (
            <a key={`${file.fileUrl}-${index}`} href={file.fileUrl} target="_blank" rel="noreferrer" className="group min-w-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 hover:border-red-200">
              <div className="relative">
                <img src={file.fileUrl} alt={`${title} ${index + 1}`} className={`${compact ? 'h-20' : 'h-40'} w-full object-cover transition group-hover:scale-[1.02]`} loading="lazy" />
                {onRemove ? (
                  <button
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-60"
                    type="button"
                    disabled={removingUrl === file.fileUrl}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemove(file);
                    }}
                    aria-label={`Remover ${file.fileName || `Foto ${index + 1}`}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {compact && hiddenImageCount > 0 && index === visibleImages.length - 1 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-slate-950/50 text-xs font-bold text-white">+{hiddenImageCount}</span>
                ) : null}
              </div>
              {!compact ? (
                <div className="px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700">Foto {index + 1}</span>
                </div>
              ) : null}
            </a>
          ))}
        </div>
      ) : null}

      {documentMedia.length ? (
        <div className={`grid min-w-0 gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {documentMedia.map((file, index) => (
            <div key={`${file.fileUrl}-${index}`} className="flex min-w-0 items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <a href={file.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-xs font-semibold text-slate-700 hover:text-red-700">
                <FileSpreadsheet className="mb-2 h-4 w-4" />
                <span className="block truncate">{file.fileName || `Anexo ${index + 1}`}</span>
              </a>
              {onRemove ? (
                <button
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-60"
                  type="button"
                  disabled={removingUrl === file.fileUrl}
                  onClick={() => onRemove(file)}
                  aria-label={`Remover ${file.fileName || `Anexo ${index + 1}`}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DeliveryPhotoManager({
  media,
  compact = false,
  saving = false,
  removingUrl,
  onUpload,
  onRemove
}: {
  media: FreightMedia[];
  compact?: boolean;
  saving?: boolean;
  removingUrl?: string | null;
  onUpload: (files: File[]) => Promise<void>;
  onRemove: (file: FreightMedia) => Promise<void>;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <FreightMediaSection title="Foto da Entrega (Motorista)" media={media} compact={compact} onRemove={file => void onRemove(file)} removingUrl={removingUrl} />
      <label className={`block min-w-0 rounded-md border border-dashed border-slate-300 bg-slate-50 ${compact ? 'p-3 text-sm' : 'p-4 text-sm'}`}>
        <span className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <Camera className="h-4 w-4 shrink-0" />
          Foto da Entrega (Motorista)
        </span>
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          disabled={saving}
          onChange={event => {
            const files = Array.from(event.currentTarget.files || []);
            event.currentTarget.value = '';
            if (files.length) void onUpload(files);
          }}
        />
        <span className={`flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 ${saving ? 'opacity-70' : ''}`}>
          {saving ? 'Enviando...' : 'Escolher fotos'}
        </span>
        <span className="mt-2 block break-words text-xs text-slate-500">Ao selecionar, a foto é anexada automaticamente. Você pode usar a câmera ou escolher da galeria.</span>
      </label>
    </div>
  );
}

function firstLine(value?: string) {
  return String(value || '-').split(/\r?\n/).map(item => item.trim()).filter(Boolean)[0] || '-';
}

function compactText(value?: string, maxLength = 34) {
  const normalized = String(value || '-').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function requestPriority(request: FreightRequest) {
  const payload = request.payloadOriginal || {};
  return String(
    payload.prioridade ||
    payload.priority ||
    (payload as any).Prioridade ||
    'undefined'
  );
}

function splitSelection(value?: string) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function setMultiSelectValue(current: string, value: string, selected: boolean) {
  const values = new Set(splitSelection(current));
  if (selected) values.add(value);
  else values.delete(value);
  return Array.from(values).join(', ');
}

type RouteEstimate = {
  status: 'idle' | 'loading' | 'OK' | 'ERROR' | 'MISSING_FIELDS';
  provider?: string;
  distanceText?: string;
  durationText?: string;
  trafficText?: string;
  origin?: string;
  destination?: string;
  message?: string;
};

function routeProviderLabel(provider?: string, status?: RouteEstimate['status']) {
  if (provider === 'distancematrix_ai') return 'DistanceMatrix.ai';
  if (provider === 'google_distance_matrix') return 'Google Distance Matrix';
  return status === 'loading' ? 'calculando...' : '—';
}

async function fetchRouteEstimate(request: FreightRequest, departureAt?: string): Promise<RouteEstimate> {
  const origin = request.enderecoRetirada || '';
  const destination = request.enderecoEntrega || '';
  if (!origin || !destination) {
    return { status: 'MISSING_FIELDS', origin, destination, message: 'Retirada ou entrega ausente.' };
  }

  try {
    const response = await fetch('/api/freight/route-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, departureAt, mode: 'driving' })
    });
    const data = await response.json().catch(() => ({}));
    return {
      status: data.status || (response.ok ? 'OK' : 'ERROR'),
      provider: data.provider,
      distanceText: data.distanceText,
      durationText: data.durationText,
      trafficText: data.trafficText,
      origin: data.origin || origin,
      destination: data.destination || destination,
      message: data.message || (!response.ok ? 'API de estimativa indisponível.' : undefined)
    };
  } catch (error: any) {
    return {
      status: 'ERROR',
      origin,
      destination,
      message: error.message || 'Falha ao consultar estimativa.'
    };
  }
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SelectOptionList({ options }: { options: FreightLookupOption[] }) {
  return (
    <>
      {options.map(option => (
        <option key={option.id || option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </>
  );
}

function freightAddressOptionValue(option: FreightLookupOption) {
  const metadata = option.metadata || {};
  return [
    metadata.valor,
    metadata.endereco,
    metadata.address,
    metadata.descricao,
    option.value,
    option.label
  ].map(item => String(item || '').trim()).find(Boolean) || option.value;
}

function recurringAddressShortcutLabel(option: FreightLookupOption) {
  return String(option.value || option.label || '').trim();
}

function recurringAddressFullValue(option: FreightLookupOption) {
  const metadata = option.metadata || {};
  return String(metadata.descricao || metadata.endereco || metadata.address || freightAddressOptionValue(option)).trim();
}

function googleMapsAddressUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function wazeAddressUrl(address: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

function normalizedAddressText(value?: string) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function resolveAddressDisplay(value?: string, options: FreightLookupOption[] = []) {
  const raw = String(value || '').trim();
  if (!raw) return { display: '-', linkTarget: '' };

  const match = options.find(option => {
    const metadata = option.metadata || {};
    return [
      option.value,
      option.label,
      metadata.valor,
      metadata.endereco,
      metadata.address,
      metadata.descricao
    ].some(candidate => String(candidate || '').trim().toLowerCase() === raw.toLowerCase());
  });

  if (!match) return { display: raw, linkTarget: raw };

  const fullAddress = freightAddressOptionValue(match);
  const shortName = String(match.label || match.value || '').trim();
  const normalizedShortName = normalizedAddressText(shortName);
  const normalizedFullAddress = normalizedAddressText(fullAddress);
  const display = shortName && fullAddress && normalizedShortName.includes(normalizedFullAddress)
    ? shortName
    : shortName && fullAddress && normalizedShortName !== normalizedFullAddress
    ? `${shortName} - ${fullAddress}`
    : fullAddress || shortName || raw;

  return { display, linkTarget: fullAddress || raw };
}

function SelectAddressOptionList({ options }: { options: FreightLookupOption[] }) {
  return (
    <>
      {options.map(option => {
        const value = freightAddressOptionValue(option);
        return (
          <option key={option.id || option.value} value={value} label={option.label}>
            {option.label}
          </option>
        );
      })}
    </>
  );
}

function toDateTimeLocalInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function normalizeFreightProfileValue(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isLocalFreightAdminUser() {
  try {
    const user = JSON.parse(localStorage.getItem('porsche-cup-user') || '{}');
    const values = [user.profileId, user.role, user.accessType, user.tipoAcesso, user.tipo_acesso]
      .map(normalizeFreightProfileValue);
    return values.some(value => value === 'admin' || value === 'administrador');
  } catch {
    return false;
  }
}

function nationalEditFormFromRequest(request: FreightRequest): typeof emptyNationalEditForm {
  return {
    setor: request.setor || '',
    setorId: request.setorId || '',
    prazoEntrega: toDateTimeLocalInput(request.prazoEntrega),
    projeto: request.projeto || '',
    projetoId: request.projetoId || '',
    projetoDescricao: request.projetoDescricao || '',
    solicitanteNome: request.solicitanteNome || '',
    itemDescricao: request.itemDescricao || '',
    responsavelLocal: request.responsavelLocal || '',
    enderecoRetirada: request.enderecoRetirada || '',
    enderecoEntrega: request.enderecoEntrega || '',
    observacoes: request.observacoes || '',
    status: request.status || 'Solicitado',
    motorista: request.motorista || '',
    veiculo: request.veiculo || '',
    placa: request.placa || '',
    agendamentoAt: toDateTimeLocalInput(request.agendamentoAt),
    observacoesLogistica: request.observacoesLogistica || ''
  };
}

function freightDeadlineInfo(request: FreightRequest) {
  if (isRequestedFreightStatus(request.status)) {
    return {
      label: 'Prazo',
      value: request.prazoEntrega || request.prazoDesejado
    };
  }

  return {
    label: 'Agendamento',
    value: request.agendamentoAt
  };
}

function freightDeliveryDate(request: FreightRequest) {
  const deliveryAttachmentTimes = (request.attachments || [])
    .filter(attachment => attachment.category === 'entrega')
    .map(attachment => new Date(attachment.createdAt || '').getTime())
    .filter(time => !Number.isNaN(time));

  if (deliveryAttachmentTimes.length) {
    return new Date(Math.max(...deliveryAttachmentTimes)).toISOString();
  }

  return request.updatedAt || request.agendamentoAt || request.createdAt;
}

function requesterEmail(request: FreightRequest) {
  return request.createdByEmail || request.emailSolicitante || '-';
}

function formattedFreightDeliveryDate(request: FreightRequest) {
  return request.status === 'Concluído' ? formatFreightDate(freightDeliveryDate(request)) : '-';
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function slaDaysFromOption(option?: FreightLookupOption) {
  const metadataDays = Number(option?.metadata?.dias);
  if (Number.isFinite(metadataDays) && metadataDays >= 0) return metadataDays;

  const textDays = Number(String(option?.value || option?.label || '').match(/\d+/)?.[0]);
  return Number.isFinite(textDays) && textDays >= 0 ? textDays : 1;
}

function attendanceSlaDays(lookups: { sla?: FreightLookupOption[] }) {
  const options = lookups.sla || [];
  const option = options.find(item => String(item.metadata?.tipo || '') === 'agendamento_logistica')
    || options.find(item => `${item.label} ${item.value}`.toLowerCase().includes('agendamento'))
    || options[0];
  return slaDaysFromOption(option);
}

function requesterSlaDays(lookups: { sla?: FreightLookupOption[] }) {
  const options = lookups.sla || [];
  const option = options.find(item => String(item.metadata?.tipo || '') === 'solicitante_frete_nacional')
    || options.find(item => `${item.label} ${item.value}`.toLowerCase().includes('solicitante'))
    || options[0];
  return slaDaysFromOption(option);
}

function formatSlaDaysLabel(days: number) {
  return `${days} dia${days === 1 ? '' : 's'}`;
}

function requesterMinimumDeadline(days: number, now = new Date()) {
  const minimum = new Date(now.getTime() + days * ONE_DAY_MS);
  if (minimum.getSeconds() || minimum.getMilliseconds()) {
    minimum.setMinutes(minimum.getMinutes() + 1);
  }
  minimum.setSeconds(0, 0);
  return minimum;
}

function freightSlaElapsedDays(request: FreightRequest, now = Date.now()) {
  const startedAt = new Date(request.createdAt || '').getTime();
  if (Number.isNaN(startedAt)) return 0;

  const finishedAt = request.atendimentoAt ? new Date(request.atendimentoAt).getTime() : now;
  const reference = Number.isNaN(finishedAt) ? now : finishedAt;
  return Math.max(0, Math.floor((reference - startedAt) / ONE_DAY_MS));
}

function freightRequesterSlaElapsedDays(request: FreightRequest) {
  const startedAt = new Date(request.createdAt || '').getTime();
  const requestedDeadline = new Date(request.prazoEntrega || request.prazoDesejado || '').getTime();
  if (Number.isNaN(startedAt) || Number.isNaN(requestedDeadline)) return null;

  return Math.max(0, Math.floor((requestedDeadline - startedAt) / ONE_DAY_MS));
}

function freightDateTime(value?: string | null, fallback = Number.MAX_SAFE_INTEGER) {
  const time = new Date(value || '').getTime();
  return Number.isNaN(time) ? fallback : time;
}

function kanbanSortValue(request: FreightRequest, lane: string) {
  if (lane === 'nao_iniciado') return freightDateTime(request.prazoEntrega || request.prazoDesejado || request.createdAt);
  if (lane === 'finalizado') return freightDateTime(freightDeliveryDate(request), 0);
  return freightDateTime(request.agendamentoAt || request.prazoEntrega || request.updatedAt || request.createdAt);
}

function sortKanbanLane(requests: FreightRequest[], lane: string) {
  return [...requests].sort((a, b) => {
    const direction = lane === 'finalizado' ? -1 : 1;
    return (kanbanSortValue(a, lane) - kanbanSortValue(b, lane)) * direction;
  });
}

function isScheduledFreightLate(request: FreightRequest) {
  return Boolean(freightDelayLabelFromDate(request.agendamentoAt));
}

function scheduledFreightDelayLabel(request: FreightRequest) {
  return freightDelayLabelFromDate(request.agendamentoAt) || 'Atrasado';
}

function freightDelayLabelFromDate(value?: string | null) {
  const referenceAt = freightDateTime(value, Number.NaN);
  if (Number.isNaN(referenceAt)) return null;

  const delayMs = Date.now() - referenceAt;
  if (delayMs <= 0) return null;

  const hours = Math.max(1, Math.floor(delayMs / (60 * 60 * 1000)));
  if (hours < 24) {
    return `${hours} hora${hours === 1 ? '' : 's'} atrasado`;
  }

  const days = Math.max(1, Math.floor(hours / 24));
  return `${days} dia${days === 1 ? ' de atraso' : 's de atraso'}`;
}

function kanbanDelayLabel(request: FreightRequest, lane: string) {
  if (lane === 'finalizado') return null;
  const referenceDate = lane === 'nao_iniciado'
    ? request.prazoEntrega || request.prazoDesejado
    : request.agendamentoAt;
  return freightDelayLabelFromDate(referenceDate);
}

function DetailDrawer({
  request,
  history,
  addressOptions,
  saving,
  removingPhotoUrl,
  driverLayout = false,
  onClose,
  onSaveObservation,
  onDeliveryUpload,
  onDeliveryRemove,
  onStatus,
  onDelivery
}: {
  request: FreightRequest | null;
  history: FreightHistory[];
  addressOptions: FreightLookupOption[];
  saving: boolean;
  removingPhotoUrl?: string | null;
  driverLayout?: boolean;
  onClose: () => void;
  onSaveObservation: (value: string) => Promise<boolean>;
  onDeliveryUpload: (request: FreightRequest, files: File[]) => Promise<void>;
  onDeliveryRemove: (request: FreightRequest, file: FreightMedia) => Promise<void>;
  onStatus?: (request: FreightRequest, status: FreightStatus, comment?: string) => void | Promise<void>;
  onDelivery?: (request: FreightRequest) => void | Promise<void>;
}) {
  const [obs, setObs] = useState('');
  const [observationNotice, setObservationNotice] = useState<string | null>(null);
  const [detailRouteEstimate, setDetailRouteEstimate] = useState<RouteEstimate | null>(null);

  useEffect(() => {
    setObs('');
    setObservationNotice(null);
  }, [request?.id]);

  useEffect(() => {
    let cancelled = false;

    if (!request || request.freightType === 'internacional') {
      setDetailRouteEstimate(null);
      return;
    }

    setDetailRouteEstimate({
      status: 'loading',
      origin: request.enderecoRetirada,
      destination: request.enderecoEntrega
    });

    fetchRouteEstimate(request, request.agendamentoAt).then(result => {
      if (!cancelled) setDetailRouteEstimate(result);
    });

    return () => {
      cancelled = true;
    };
  }, [request?.id, request?.freightType, request?.enderecoRetirada, request?.enderecoEntrega, request?.agendamentoAt]);

  if (!request) return null;

  const productMedia = getFreightMedia(request, ['produto']);
  const deliveryMedia = getFreightMedia(request, ['entrega']);
  const otherMedia = getFreightMedia(request, ['volume', 'itens', 'documento']);
  const showMediaSection = request.freightType !== 'internacional' || Boolean(productMedia.length || deliveryMedia.length || otherMedia.length);
  const detailRouteEstimates = detailRouteEstimate ? { [request.id]: detailRouteEstimate } : {};
  const deadlineInfo = freightDeadlineInfo(request);
  const saveObservation = async () => {
    setObservationNotice(null);
    const saved = await onSaveObservation(obs);
    if (!saved) return;
    setObs('');
    setObservationNotice('Observação registrada no histórico.');
  };

  if (driverLayout && request.freightType !== 'internacional') {
    const canStartRoute = request.status === 'Agendado';
    const canCompleteDelivery = request.status === 'Em Rota' && deliveryMedia.length > 0;

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={onClose}>
        <div data-freight-detail-drawer="true" className="h-full w-full max-w-4xl overflow-y-auto overscroll-contain bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="min-w-0 pr-4">
              <p className="text-sm font-bold text-red-600">{formatProtocol(request)}</p>
              <h2 className="text-xl font-bold text-slate-950">Frete nacional</h2>
              <p className="text-sm text-slate-500">{request.setor || '-'}</p>
            </div>
            <button className={buttonClass('secondary')} onClick={onClose} type="button">
              <X className="h-4 w-4" />
              Fechar
            </button>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            <details open className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-950">Dados</summary>
              <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
                <DriverDetailField label="Protocolo" value={formatProtocol(request)} />
                <DriverDetailField label="Status" value={request.status || '-'} />
                <DriverDetailField label="Motorista" value={request.motorista || '-'} />
                <DriverDetailField label="Veículo" value={request.veiculo || '-'} />
                <DriverDetailField label="Placa" value={request.placa || '-'} />
                <DriverDetailField label="Setor" value={request.setor || '-'} />
                <DriverDetailField label="Data e Hora agendada" value={formatFreightDate(request.agendamentoAt)} wide />
                <DriverDetailTextArea label="Descrição do item" value={request.itemDescricao || request.necessidade || '-'} />
                {productMedia.length ? (
                  <div className="sm:col-span-2">
                    <FreightMediaSection title="Foto solicitante" media={productMedia} />
                  </div>
                ) : null}
                <DriverDetailTextArea label="Observações do solicitante" value={request.observacoes || request.observacoesFinais || '-'} />
                <DriverDetailAddress label="Endereço de retirada" value={request.enderecoRetirada || request.enderecoOrigem} options={addressOptions} />
                <DriverDetailAddress label="Endereço de entrega" value={request.enderecoEntrega || request.enderecoDestino} options={addressOptions} />
                <DriverRouteMetricFields estimate={detailRouteEstimate} />
              </div>
            </details>

            <details open className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-950">
                Responsável pelo preenchimento: {request.motorista || 'Motorista'}
              </summary>
              <div className="space-y-5 border-t border-slate-100 p-4">
                <DeliveryPhotoManager
                  media={deliveryMedia}
                  saving={saving}
                  removingUrl={removingPhotoUrl}
                  onUpload={files => onDeliveryUpload(request, files)}
                  onRemove={file => onDeliveryRemove(request, file)}
                />
                <FreightMediaSection title="Anexos" media={otherMedia} />
              </div>
            </details>

            <details open className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-950">Registrar Progresso</summary>
              <div className="space-y-3 border-t border-slate-100 p-4">
                <p className="text-sm text-slate-500">Clique para avançar o status da entrega.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    className={buttonClass('secondary')}
                    onClick={() => onStatus?.(request, 'Em Rota')}
                    type="button"
                    disabled={saving || !canStartRoute}
                  >
                    <Route className="h-4 w-4" />
                    Iniciar Rota
                  </button>
                  <button
                    className={buttonClass('primary')}
                    onClick={() => onDelivery?.(request)}
                    type="button"
                    disabled={saving || !canCompleteDelivery}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Finalizar Entrega
                  </button>
                </div>
                {request.status === 'Em Rota' && !deliveryMedia.length ? (
                  <p className="text-sm font-semibold text-red-700">Para finalizar, é necessário primeiro registrar uma foto da entrega.</p>
                ) : null}
              </div>
            </details>

            <details open className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-950">Log e Observações</summary>
              <div className="space-y-4 border-t border-slate-100 p-4">
                <div>
                  <label className={labelClass()}>Observações logística</label>
                  <textarea className={areaClass()} value={obs} onChange={event => setObs(event.target.value)} placeholder="Digite uma observação para registrar no histórico." />
                </div>
                {observationNotice ? (
                  <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                    {observationNotice}
                  </div>
                ) : null}
                <button className={buttonClass('dark')} onClick={saveObservation} type="button" disabled={saving}>
                  <Save className="h-4 w-4" />
                  Salvar observação
                </button>
                <div className="rounded-md border border-slate-200 bg-slate-50">
                  {history.length ? history.map(item => (
                    <div key={item.id} className="border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                      <div className="font-semibold text-slate-900">{item.newStatus || item.action}</div>
                      <div className="text-slate-500">{formatFreightDate(item.changedAt)} · {item.changedByEmail || '-'}</div>
                      {item.comment ? <div className="mt-1 whitespace-pre-wrap text-slate-700">{item.comment}</div> : null}
                    </div>
                  )) : (
                    <p className="p-4 text-sm text-slate-500">Sem histórico registrado.</p>
                  )}
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={onClose}>
      <div data-freight-detail-drawer="true" className="h-full w-full max-w-3xl overflow-y-auto overscroll-contain bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-red-600">{formatProtocol(request)}</p>
            <h2 className="text-xl font-bold text-slate-950">{request.freightType === 'internacional' ? 'Frete internacional' : 'Frete nacional'}</h2>
            <p className="text-sm text-slate-500">{request.setor || request.necessidade || '-'}</p>
          </div>
          <button className={buttonClass('secondary')} onClick={onClose} type="button">
            <X className="h-4 w-4" />
            Fechar
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-3 md:grid-cols-4">
            <InfoBox label="Status" value={request.status} />
            <InfoBox label={deadlineInfo.label} value={formatFreightDate(deadlineInfo.value)} />
            <InfoBox label="Motorista" value={request.motorista || '-'} />
            <InfoBox label="Veículo" value={[request.veiculo, request.placa].filter(Boolean).join(' - ') || '-'} />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-950">Dados da solicitação</h3>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <InfoLine label="Setor" value={request.setor || '-'} />
              <InfoLine label="Projeto" value={request.projeto || request.projetoDescricao || '-'} />
              <InfoLine label="Solicitante" value={request.solicitanteNome || request.emailSolicitante || request.createdByEmail || '-'} />
              <InfoLine label="Responsável no local" value={request.responsavelLocal || request.responsavelEntrega || '-'} />
              <AddressInfoLine label="Origem" value={request.enderecoRetirada || request.enderecoOrigem} options={addressOptions} />
              <AddressInfoLine label="Destino" value={request.enderecoEntrega || request.enderecoDestino} options={addressOptions} />
              <div className="md:col-span-2">
                <InfoLine label="Materiais / necessidade" value={request.itemDescricao || request.necessidade || '-'} multiline />
              </div>
              <div className="md:col-span-2">
                <InfoLine label="Observações" value={request.observacoes || request.observacoesFinais || '-'} multiline />
              </div>
            </div>
          </section>

          {request.freightType !== 'internacional' ? (
            <RouteEstimatePanel selectedRequests={[request]} estimates={detailRouteEstimates} showProtocol={false} />
          ) : null}

          {(request.volumes?.length || request.items?.length) ? (
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="font-semibold text-slate-950">Volumes e mercadorias</h3>
              </div>
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Volumes</p>
                  <div className="space-y-2">
                    {(request.volumes || []).map(volume => (
                      <div key={volume.id || volume.itemNumero} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                        {volume.quantidade || '-'} un · {volume.dimensoes || '-'} · {volume.pesoBruto || '-'} kg · {volume.tipoEmbalagem || '-'}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Itens</p>
                  <div className="space-y-2">
                    {(request.items || []).map(item => (
                      <div key={item.id || item.itemNumero} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                        <div className="font-semibold text-slate-900">{item.quantidade || '-'}x {item.descricao || '-'}</div>
                        <div className="text-xs text-slate-500">NCM {item.ncm || '-'} · {item.fabricante || '-'} · {item.paisOrigem || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-950">Observação logística</h3>
            </div>
            <div className="space-y-3 p-4">
              <textarea className={areaClass()} value={obs} onChange={event => setObs(event.target.value)} placeholder="Digite uma observação para registrar no histórico." />
              {observationNotice ? (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                  {observationNotice}
                </div>
              ) : null}
              <button className={buttonClass('dark')} onClick={saveObservation} type="button">
                <Save className="h-4 w-4" />
                Salvar observação
              </button>
            </div>
          </section>

          {showMediaSection ? (
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="font-semibold text-slate-950">Anexos e fotos</h3>
              </div>
              <div className="space-y-5 p-4">
                <FreightMediaSection title="Foto solicitante" media={productMedia} />
                {request.freightType !== 'internacional' ? (
                  <DeliveryPhotoManager
                    media={deliveryMedia}
                    saving={saving}
                    removingUrl={removingPhotoUrl}
                    onUpload={files => onDeliveryUpload(request, files)}
                    onRemove={file => onDeliveryRemove(request, file)}
                  />
                ) : (
                  <FreightMediaSection title="Foto da Entrega (Motorista)" media={deliveryMedia} />
                )}
                <FreightMediaSection title="Anexos" media={otherMedia} />
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-950">Histórico</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {history.length ? history.map(item => (
                <div key={item.id} className="px-4 py-3 text-sm">
                  <div className="font-semibold text-slate-900">{item.newStatus || item.action}</div>
                  <div className="text-slate-500">{formatFreightDate(item.changedAt)} · {item.changedByEmail || '-'}</div>
                  {item.comment ? <div className="mt-1 text-slate-700">{item.comment}</div> : null}
                </div>
              )) : (
                <p className="p-4 text-sm text-slate-500">Sem histórico registrado.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function driverReadonlyFieldClass() {
  return 'box-border block min-h-12 w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-base leading-normal text-slate-900 outline-none sm:min-h-10 sm:px-3 sm:py-2 sm:text-sm';
}

function DriverDetailField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label className={labelClass()}>{label}</label>
      <input className={`${driverReadonlyFieldClass()} font-semibold`} value={value} readOnly />
    </div>
  );
}

function DriverDetailTextArea({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:col-span-2">
      <label className={labelClass()}>{label}</label>
      <textarea className={`${driverReadonlyFieldClass()} min-h-24 resize-none`} value={value} readOnly />
    </div>
  );
}

function DriverDetailAddress({ label, value, options }: { label: string; value?: string; options?: FreightLookupOption[] }) {
  const resolved = resolveAddressDisplay(value, options);
  const hasLink = Boolean(resolved.linkTarget);

  return (
    <div className="sm:col-span-2">
      <label className={labelClass()}>{label}</label>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
        {resolved.display}
      </div>
      {hasLink ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <a className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-blue-700 hover:bg-slate-50" href={googleMapsAddressUrl(resolved.linkTarget)} target="_blank" rel="noreferrer">
            Google Maps
          </a>
          <a className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-blue-700 hover:bg-slate-50" href={wazeAddressUrl(resolved.linkTarget)} target="_blank" rel="noreferrer">
            Waze
          </a>
        </div>
      ) : null}
    </div>
  );
}

function DriverRouteMetricFields({ estimate }: { estimate: RouteEstimate | null }) {
  const isLoading = !estimate || estimate.status === 'loading';
  const hasError = estimate?.status === 'ERROR' || estimate?.status === 'MISSING_FIELDS';
  const distance = isLoading ? 'calculando...' : estimate?.distanceText || '—';
  const duration = isLoading ? 'calculando...' : estimate?.trafficText || estimate?.durationText || '—';

  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      <DriverDetailField label="Distância" value={distance} />
      <DriverDetailField label="Tempo (trânsito)" value={duration} />
      {hasError && estimate?.message ? (
        <p className="sm:col-span-2 text-xs font-semibold text-red-700">{estimate.message}</p>
      ) : null}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-slate-950">{value}</div>
    </div>
  );
}

function InfoLine({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-sm text-slate-900 ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</div>
    </div>
  );
}

function AddressInfoLine({ label, value, options }: { label: string; value?: string; options?: FreightLookupOption[] }) {
  const resolved = resolveAddressDisplay(value, options);
  const hasLink = Boolean(resolved.linkTarget);

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900">
        {resolved.display}
        {hasLink ? (
          <span className="ml-1 whitespace-nowrap">
            (
            <a className="font-semibold text-blue-700 hover:text-blue-900" href={googleMapsAddressUrl(resolved.linkTarget)} target="_blank" rel="noreferrer">Google</a>
            <span className="text-slate-400"> | </span>
            <a className="font-semibold text-blue-700 hover:text-blue-900" href={wazeAddressUrl(resolved.linkTarget)} target="_blank" rel="noreferrer">Waze</a>
            )
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FreightPage({ mode }: { mode: FreightMode }) {
  const isInternational = mode === 'internacional';
  const isDriver = mode === 'motorista';
  const { isUserAdmin, profile } = usePermissions();
  const [tab, setTab] = useState<TabKey>(isInternational ? 'dashboard' : isDriver ? 'motorista' : 'dashboard');
  const profileId = normalizeFreightProfileValue(profile?.id);
  const profileName = normalizeFreightProfileValue(profile?.name);
  const isOperatorFreightProfile = !isInternational && !isDriver && (profileId === 'operator' || profileName === 'operador');
  const isDriverFreightProfile = !isInternational && !isDriver && (profileId === 'driver' || profileId === 'motorista' || profileName === 'motorista');
  const forcedTab: TabKey | null = isDriver || isDriverFreightProfile ? 'motorista' : isOperatorFreightProfile ? 'nova' : null;
  const activeTab = forcedTab || tab;
  const isSingleTabView = Boolean(forcedTab);
  const [requests, setRequests] = useState<FreightRequest[]>([]);
  const [lookups, setLookups] = useState({
    setores: [] as FreightLookupOption[],
    projetos: [] as FreightLookupOption[],
    motoristas: [] as FreightLookupOption[],
    veiculos: [] as FreightLookupOption[],
    enderecos: [] as FreightLookupOption[],
    statusNacional: [] as FreightLookupOption[],
    statusInternacional: [] as FreightLookupOption[],
    tiposFrete: [] as FreightLookupOption[],
    modalidades: [] as FreightLookupOption[],
    embalagens: [] as FreightLookupOption[],
    sla: [] as FreightLookupOption[]
  });
  const [filters, setFilters] = useState({ search: '', status: 'Todos', motorista: 'TODOS', setor: '', projeto: '', protocolo: '', dateFrom: '', dateTo: '' });
  const [standardFiltersOpen, setStandardFiltersOpen] = useState(false);
  const [kanbanFiltersOpen, setKanbanFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<FreightRequest | null>(null);
  const [history, setHistory] = useState<FreightHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [successDialog, setSuccessDialog] = useState<{ title: string; text: string } | null>(null);
  const [nationalForm, setNationalForm] = useState(emptyNationalForm);
  const [editingRequest, setEditingRequest] = useState<FreightRequest | null>(null);
  const [nationalEditForm, setNationalEditForm] = useState(emptyNationalEditForm);
  const [editProductFiles, setEditProductFiles] = useState<File[]>([]);
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [photoSavingByRequest, setPhotoSavingByRequest] = useState<Record<string, boolean>>({});
  const [removingPhotoUrl, setRemovingPhotoUrl] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState({ motorista: '', veiculo: '', placa: '', agendamentoAt: '', observacoesLogistica: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [internationalForm, setInternationalForm] = useState(emptyInternationalForm);
  const [volumes, setVolumes] = useState<FreightVolume[]>([newVolume()]);
  const [items, setItems] = useState<FreightItem[]>([newItem()]);
  const [volumeFiles, setVolumeFiles] = useState<File[]>([]);
  const [itemFiles, setItemFiles] = useState<File[]>([]);

  const freightType = isInternational ? 'internacional' : 'nacional';
  const canEditFreightRequests = !isInternational && !isDriver && !isSingleTabView && (isUserAdmin() || isLocalFreightAdminUser());

  useEffect(() => {
    loadData();
  }, [freightType]);

  useEffect(() => {
    if (forcedTab && tab !== forcedTab) {
      setTab(forcedTab);
    }
  }, [forcedTab, tab]);

  useEffect(() => {
    setStandardFiltersOpen(false);
    setKanbanFiltersOpen(false);
  }, [activeTab]);

  const activeTabRef = useRef<TabKey>(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (isInternational) return;

    let refreshing = false;
    const intervalId = window.setInterval(() => {
      if (refreshing || activeTabRef.current !== 'kanban') return;
      refreshing = true;
      loadData({ silent: true }).finally(() => {
        refreshing = false;
      });
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [freightType, isInternational]);

  useEffect(() => {
    if (isInternational || selected || editingRequest || !['nova', 'motorista'].includes(activeTab)) return;

    const mobileQuery = window.matchMedia('(max-width: 639px)');
    let animationFrame = 0;
    let touchStartY = 0;
    const clampTargetSelector = activeTab === 'nova'
      ? '[data-freight-national-form="true"]'
      : '[data-freight-driver-panel="true"]';

    const previousHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;
    const previousBodyOverscroll = document.body.style.overscrollBehaviorY;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousBodyWidth = document.body.style.width;
    const pendingTimeouts = new Set<number>();

    document.documentElement.style.overscrollBehaviorY = 'none';
    document.body.style.overscrollBehaviorY = 'none';
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.width = '100%';

    const getTargetMaxScroll = () => {
      const target = document.querySelector<HTMLElement>(clampTargetSelector);
      if (!target) return null;

      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const targetBottom = target.getBoundingClientRect().bottom + window.scrollY;
      return Math.max(0, Math.ceil(targetBottom - viewportHeight));
    };

    const clampScrollToTarget = () => {
      animationFrame = 0;
      if (!mobileQuery.matches) return;

      const maxScroll = getTargetMaxScroll();
      if (maxScroll === null) return;

      if (window.scrollY > maxScroll + 2) {
        window.scrollTo({ top: maxScroll, behavior: 'auto' });
      }
    };

    const scheduleClamp = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(clampScrollToTarget);
    };

    const scheduleClampSequence = () => {
      scheduleClamp();
      [80, 180, 360, 700, 1200].forEach(delay => {
        const timeoutId = window.setTimeout(() => {
          pendingTimeouts.delete(timeoutId);
          scheduleClamp();
        }, delay);
        pendingTimeouts.add(timeoutId);
      });
    };

    const handleViewportChange = () => {
      scheduleClampSequence();
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY || 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!mobileQuery.matches) return;

      const currentY = event.touches[0]?.clientY || touchStartY;
      const isScrollingDown = touchStartY - currentY > 0;
      if (!isScrollingDown) return;

      const maxScroll = getTargetMaxScroll();
      if (maxScroll === null) return;

      if (window.scrollY >= maxScroll - 1) {
        event.preventDefault();
        window.scrollTo({ top: maxScroll, behavior: 'auto' });
      }
    };

    scheduleClamp();
    window.addEventListener('scroll', scheduleClamp, { passive: true });
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('focusin', scheduleClampSequence, true);
    window.addEventListener('focusout', scheduleClampSequence, true);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      pendingTimeouts.forEach(timeoutId => window.clearTimeout(timeoutId));
      document.documentElement.style.overscrollBehaviorY = previousHtmlOverscroll;
      document.body.style.overscrollBehaviorY = previousBodyOverscroll;
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.body.style.overflowX = previousBodyOverflowX;
      document.body.style.width = previousBodyWidth;
      window.removeEventListener('scroll', scheduleClamp);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('focusin', scheduleClampSequence, true);
      window.removeEventListener('focusout', scheduleClampSequence, true);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [activeTab, editingRequest, isInternational, selected]);

  async function loadData(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setLoading(true);
      setMessage(null);
    }
    try {
      const [lookupData, requestData] = await Promise.all([
        getFreightLookups(),
        getFreightRequests({ type: freightType })
      ]);
      setLookups(lookupData);
      setRequests(requestData);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao carregar o módulo de frete.' });
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      if (activeTab !== 'motorista' && filters.status !== 'Todos' && request.status !== filters.status) return false;
      if (filters.motorista !== 'TODOS' && !(request.motorista || '').toLowerCase().includes(filters.motorista.toLowerCase())) return false;
      if (filters.setor && request.setor !== filters.setor) return false;
      if (filters.projeto && request.projeto !== filters.projeto) return false;
      if (activeTab === 'kanban' && !isInternational && (filters.dateFrom || filters.dateTo)) {
        if (!request.agendamentoAt) return false;
        const scheduledAt = new Date(request.agendamentoAt).getTime();
        if (Number.isNaN(scheduledAt)) return false;
        if (filters.dateFrom) {
          const from = new Date(`${filters.dateFrom}T00:00:00`).getTime();
          if (scheduledAt < from) return false;
        }
        if (filters.dateTo) {
          const to = new Date(`${filters.dateTo}T23:59:59`).getTime();
          if (scheduledAt > to) return false;
        }
      }
      if (filters.protocolo) {
        const terms = filters.protocolo.split(',').map(item => item.trim().replace(/^#/, '')).filter(Boolean);
        if (terms.length && !terms.some(term => String(request.protocol).includes(term))) return false;
      }
      const search = filters.search.trim().toLowerCase();
      if (!search) return true;
      return [
        request.protocol,
        request.setor,
        request.projeto,
        request.solicitanteNome,
        request.createdByEmail,
        request.emailSolicitante,
        request.itemDescricao,
        request.motorista,
        request.veiculo,
        request.placa,
        request.necessidade,
        request.empresaRemetente,
        request.empresaDestinatario
      ].some(value => String(value || '').toLowerCase().includes(search));
    });
  }, [activeTab, filters, isInternational, requests]);

  const stats = useMemo(() => {
    const source = filteredRequests;
    return {
      total: source.length,
      pendente: source.filter(item => isRequestedFreightStatus(item.status)).length,
      agendado: source.filter(item => ['Agendado', 'Em cotação', 'Aguardando coleta'].includes(item.status)).length,
      rota: source.filter(item => ['Em Rota', 'Em trânsito', 'Desembaraço'].includes(item.status)).length,
      concluido: source.filter(item => item.status === 'Concluído').length
    };
  }, [filteredRequests]);

  async function openDetails(request: FreightRequest) {
    setSelected(request);
    try {
      setHistory(await getFreightHistory(request.id));
    } catch {
      setHistory([]);
    }
  }

  function updateNationalField(field: keyof typeof emptyNationalForm, value: string) {
    if (field === 'prazoEntrega') {
      const requesterSla = requesterSlaDays(lookups);
      const minimumDeadline = requesterMinimumDeadline(requesterSla);
      const minimumValue = toDateTimeLocalInput(minimumDeadline.toISOString());

      if (value && value < minimumValue) {
        setNationalForm(current => ({ ...current, prazoEntrega: minimumValue }));
        setMessage({
          type: 'error',
          text: `O prazo de entrega precisa respeitar o mínimo de ${formatSlaDaysLabel(requesterSla)} de antecedência. Selecione ${formatFreightDate(minimumDeadline.toISOString())} ou depois.`
        });
        return;
      }

      setMessage(current => current?.type === 'error' && current.text.startsWith('O prazo de entrega precisa') ? null : current);
    }

    if (field === 'setor') {
      const option = lookups.setores.find(item => item.value === value);
      const setorId = option?.source === 'setor' ? option.id || '' : '';
      setNationalForm(current => ({ ...current, setor: value, setorId }));
      return;
    }

    if (field === 'projeto') {
      const option = lookups.projetos.find(item => item.value === value);
      const projetoId = option?.source === 'projeto' ? option.id || '' : '';
      setNationalForm(current => ({
        ...current,
        projeto: value,
        projetoId,
        projetoDescricao: String(option?.metadata?.descricao || '')
      }));
      return;
    }

    setNationalForm(current => ({ ...current, [field]: value }));
  }

  function openEditRequest(request: FreightRequest) {
    if (!canEditFreightRequests) {
      setMessage({ type: 'error', text: 'Apenas administradores podem editar solicitações.' });
      return;
    }
    setEditingRequest(request);
    setNationalEditForm(nationalEditFormFromRequest(request));
    setEditProductFiles([]);
  }

  function closeEditRequest() {
    setEditingRequest(null);
    setNationalEditForm(emptyNationalEditForm);
    setEditProductFiles([]);
  }

  function updateNationalEditField(field: keyof typeof emptyNationalEditForm, value: string) {
    if (field === 'setor') {
      const option = lookups.setores.find(item => item.value === value);
      const setorId = option?.source === 'setor' ? option.id || '' : '';
      setNationalEditForm(current => ({ ...current, setor: value, setorId }));
      return;
    }

    if (field === 'projeto') {
      const option = lookups.projetos.find(item => item.value === value);
      const projetoId = option?.source === 'projeto' ? option.id || '' : '';
      setNationalEditForm(current => ({
        ...current,
        projeto: value,
        projetoId,
        projetoDescricao: String(option?.metadata?.descricao || '')
      }));
      return;
    }

    if (field === 'veiculo') {
      const option = lookups.veiculos.find(item => item.value === value);
      const placa = String(option?.metadata?.placa || '').trim();
      setNationalEditForm(current => ({
        ...current,
        veiculo: value,
        placa: placa || current.placa
      }));
      return;
    }

    setNationalEditForm(current => ({ ...current, [field]: value }));
  }

  async function handleSaveNationalEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingRequest) return;
    if (!canEditFreightRequests) {
      setMessage({ type: 'error', text: 'Apenas administradores podem editar solicitações.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const previousPayload = editingRequest.payloadOriginal && typeof editingRequest.payloadOriginal === 'object'
        ? editingRequest.payloadOriginal
        : {};
      const payloadOriginal = {
        ...previousPayload,
        ...nationalEditForm,
        freightType: 'nacional'
      };

      await updateFreightRequest(editingRequest.id, {
        freightType: 'nacional',
        status: nationalEditForm.status,
        setor: nationalEditForm.setor,
        setorId: nationalEditForm.setorId || undefined,
        projeto: nationalEditForm.projeto,
        projetoId: nationalEditForm.projetoId || undefined,
        projetoDescricao: nationalEditForm.projetoDescricao || undefined,
        prazoEntrega: nationalEditForm.prazoEntrega,
        solicitanteNome: nationalEditForm.solicitanteNome,
        responsavelEntrega: undefined,
        itemDescricao: nationalEditForm.itemDescricao,
        responsavelLocal: nationalEditForm.responsavelLocal,
        enderecoRetirada: nationalEditForm.enderecoRetirada,
        enderecoEntrega: nationalEditForm.enderecoEntrega,
        pagamento: undefined,
        observacoes: nationalEditForm.observacoes,
        motorista: nationalEditForm.motorista,
        veiculo: nationalEditForm.veiculo,
        placa: nationalEditForm.placa,
        agendamentoAt: nationalEditForm.agendamentoAt,
        observacoesLogistica: nationalEditForm.observacoesLogistica,
        payloadOriginal
      });

      if (editProductFiles.length) {
        await uploadFreightFiles(editingRequest.id, editProductFiles, 'produto');
      }

      await appendFreightHistory(editingRequest.id, {
        action: 'admin_edit',
        previousStatus: editingRequest.status,
        newStatus: nationalEditForm.status,
        comment: 'Solicitação editada por administrador.',
        payload: {
          protocol: editingRequest.protocol,
          editedFields: Object.keys(nationalEditForm),
          addedFiles: editProductFiles.length
        }
      });

      setMessage({ type: 'success', text: `${formatProtocol(editingRequest)} atualizado.` });
      closeEditRequest();
      await loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao editar solicitação.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateNational(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const requesterSla = requesterSlaDays(lookups);
    const minimumDeadline = requesterMinimumDeadline(requesterSla);
    const requestedDeadline = new Date(nationalForm.prazoEntrega);

    if (!nationalForm.prazoEntrega || Number.isNaN(requestedDeadline.getTime()) || requestedDeadline.getTime() < minimumDeadline.getTime()) {
      setMessage({
        type: 'error',
        text: `O prazo de entrega precisa respeitar o mínimo de ${formatSlaDaysLabel(requesterSla)} de antecedência. Selecione ${formatFreightDate(minimumDeadline.toISOString())} ou depois.`
      });
      return;
    }

    setSaving(true);
    try {
      const created = await createFreightRequest({
        freightType: 'nacional',
        status: 'Solicitado',
        ...nationalForm,
        setorId: nationalForm.setorId || undefined,
        projetoId: nationalForm.projetoId || undefined,
        responsavelEntrega: undefined,
        pagamento: undefined,
        fotosProdutoUrls: [],
        fotoEntregaUrls: [],
        payloadOriginal: {
          ...nationalForm,
          responsavelEntrega: undefined,
          pagamento: undefined
        }
      });

      if (productFiles.length) {
        await uploadFreightFiles(created.id, productFiles, 'produto');
      }

      await sendFreightNotification(created.id, 'created');
      setNationalForm(emptyNationalForm);
      setProductFiles([]);
      setTab(forcedTab || 'dashboard');
      setSuccessDialog({
        title: `Protocolo ${formatProtocol(created)} cadastrado com sucesso`,
        text: 'Você receberá uma cópia por e-mail com os dados da solicitação. O acompanhamento também será enviado por e-mail a cada atualização: agendado, em rota e concluído.'
      });
      await loadData({ silent: true });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao cadastrar solicitação.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleBatchCreateNational(items: (typeof emptyNationalForm)[]) {
    setMessage(null);
    const requesterSla = requesterSlaDays(lookups);
    const minimumDl = requesterMinimumDeadline(requesterSla);

    for (const item of items) {
      const requested = new Date(item.prazoEntrega);
      if (!item.prazoEntrega || Number.isNaN(requested.getTime()) || requested.getTime() < minimumDl.getTime()) {
        setMessage({
          type: 'error',
          text: `Um ou mais fretes tem prazo inválido. O mínimo é ${formatSlaDaysLabel(requesterSla)} de antecedência.`
        });
        return;
      }
    }

    setSaving(true);
    try {
      const created = await Promise.all(items.map(item => createFreightRequest({
        freightType: 'nacional',
        status: 'Solicitado',
        ...item,
        setorId: item.setorId || undefined,
        projetoId: item.projetoId || undefined,
        responsavelEntrega: undefined,
        pagamento: undefined,
        fotosProdutoUrls: [],
        fotoEntregaUrls: [],
        payloadOriginal: { ...item, responsavelEntrega: undefined, pagamento: undefined }
      })));

      if (productFiles.length) {
        await Promise.all(created.map(c => uploadFreightFiles(c.id, productFiles, 'produto')));
      }
      await Promise.all(created.map(c => sendFreightNotification(c.id, 'created')));

      setNationalForm(emptyNationalForm);
      setProductFiles([]);
      setTab(forcedTab || 'dashboard');
      setSuccessDialog({
        title: `${created.length} solicitaç${created.length === 1 ? 'ão' : 'ões'} cadastrada${created.length === 1 ? '' : 's'} com sucesso`,
        text: 'Você receberá cópias por e-mail com os dados de cada solicitação.'
      });
      await loadData({ silent: true });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao cadastrar solicitações.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInternational(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const created = await createFreightRequest({
        freightType: 'internacional',
        status: 'Solicitado',
        ...internationalForm,
        volumes,
        items,
        fotosProdutoUrls: [],
        fotoEntregaUrls: [],
        payloadOriginal: { ...internationalForm, volumes, items }
      });

      if (volumeFiles.length) await uploadFreightFiles(created.id, volumeFiles, 'volume');
      if (itemFiles.length) await uploadFreightFiles(created.id, itemFiles, 'itens');

      await sendFreightNotification(created.id, 'created');
      setInternationalForm(emptyInternationalForm);
      setVolumes([newVolume()]);
      setItems([newItem()]);
      setVolumeFiles([]);
      setItemFiles([]);
      setTab('dashboard');
      setMessage({ type: 'success', text: `Solicitação internacional ${formatProtocol(created)} cadastrada.` });
      await loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao cadastrar solicitação internacional.' });
    } finally {
      setSaving(false);
    }
  }

  function startSchedule(request?: FreightRequest) {
    if (request) {
      setSelectedIds([request.id]);
      setScheduleDraft({
        motorista: request.motorista || '',
        veiculo: request.veiculo || '',
        placa: request.placa || '',
        agendamentoAt: request.agendamentoAt ? request.agendamentoAt.slice(0, 16) : '',
        observacoesLogistica: request.observacoesLogistica || ''
      });
    } else {
      setScheduleDraft({ motorista: '', veiculo: '', placa: '', agendamentoAt: '', observacoesLogistica: '' });
    }
    setTab('atendimento');
  }

  async function applySchedule() {
    const targets = requests.filter(request => selectedIds.includes(request.id));
    if (!targets.length) {
      setMessage({ type: 'error', text: 'Selecione ao menos uma solicitação para agendar.' });
      return;
    }
    if (!scheduleDraft.motorista || !scheduleDraft.veiculo || !scheduleDraft.agendamentoAt) {
      setMessage({ type: 'error', text: 'Preencha motorista, veículo e data/hora do agendamento.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await Promise.all([
        saveFreightMasterOption('motorista', scheduleDraft.motorista).catch(() => undefined),
        saveFreightMasterOption('veiculo', scheduleDraft.veiculo, { placa: scheduleDraft.placa }).catch(() => undefined)
      ]);

      const atendimentoAt = new Date().toISOString();
      for (const request of targets) {
        await updateFreightStatus(request, 'Agendado', 'Agendamento logístico salvo.', {
          motorista: scheduleDraft.motorista,
          veiculo: scheduleDraft.veiculo,
          placa: scheduleDraft.placa,
          agendamentoAt: scheduleDraft.agendamentoAt,
          atendimentoAt,
          observacoesLogistica: scheduleDraft.observacoesLogistica
        });
        await sendFreightNotification(request.id, 'status');
      }

      setSelectedIds([]);
      setScheduleDraft({ motorista: '', veiculo: '', placa: '', agendamentoAt: '', observacoesLogistica: '' });
      setMessage({ type: 'success', text: `${targets.length} solicitação(ões) agendada(s).` });
      await loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao salvar agendamento.' });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(request: FreightRequest, newStatus: FreightStatus, comment?: string) {
    setSaving(true);
    try {
      await updateFreightStatus(request, newStatus, comment || `Status alterado para ${newStatus}.`);
      await sendFreightNotification(request.id, 'status');
      setMessage({ type: 'success', text: `${formatProtocol(request)} atualizado para ${newStatus}.` });
      if (selected?.id === request.id) {
        await refreshRequestAfterMediaChange(request.id);
      } else {
        await loadData();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar status.' });
    } finally {
      setSaving(false);
    }
  }

  async function cancelFreightRequests(targets: FreightRequest[], reason: string) {
    const normalizedReason = reason.trim();
    if (!targets.length) {
      setMessage({ type: 'error', text: 'Selecione ao menos uma solicitação para cancelar.' });
      return;
    }
    if (!normalizedReason) {
      setMessage({ type: 'error', text: 'Informe o motivo do cancelamento.' });
      return;
    }

    setSaving(true);
    try {
      for (const request of targets) {
        const cancelNote = `Motivo do cancelamento: ${normalizedReason}`;
        const updatedNotes = [request.observacoesLogistica, cancelNote].filter(Boolean).join('\n');
        await updateFreightStatus(request, 'Cancelado', cancelNote, {
          observacoesLogistica: updatedNotes
        });
        await sendFreightNotification(request.id, 'status');
      }
      setSelectedIds([]);
      setMessage({ type: 'success', text: `${targets.length} solicitação(ões) cancelada(s).` });
      await loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao cancelar solicitação.' });
    } finally {
      setSaving(false);
    }
  }

  async function refreshRequestAfterMediaChange(requestId: string) {
    const refreshed = await getFreightRequests({ type: freightType });
    setRequests(refreshed);
    const updated = refreshed.find(item => item.id === requestId) || null;
    if (selected?.id === requestId) {
      setSelected(updated);
      if (updated) setHistory(await getFreightHistory(updated.id));
    }
  }

  async function handleDeliveryPhotoUpload(request: FreightRequest, files: File[]) {
    const selectedFiles = files.filter(Boolean);
    if (!selectedFiles.length) return;

    setSaving(true);
    setPhotoSavingByRequest(current => ({ ...current, [request.id]: true }));
    setMessage(null);
    try {
      await uploadFreightFiles(request.id, selectedFiles, 'entrega');
      await appendFreightHistory(request.id, {
        action: 'Foto da entrega',
        comment: `${selectedFiles.length} foto(s) da entrega anexada(s) pelo motorista.`
      });
      setMessage({ type: 'success', text: `${selectedFiles.length} foto(s) anexada(s) em ${formatProtocol(request)}.` });
      await refreshRequestAfterMediaChange(request.id);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao anexar foto da entrega.' });
    } finally {
      setPhotoSavingByRequest(current => ({ ...current, [request.id]: false }));
      setSaving(false);
    }
  }

  async function handleDeliveryPhotoRemove(request: FreightRequest, file: FreightMedia) {
    setSaving(true);
    setRemovingPhotoUrl(file.fileUrl);
    setMessage(null);
    try {
      await deleteFreightAttachment(request.id, {
        id: file.id,
        fileUrl: file.fileUrl,
        category: file.category
      });
      await appendFreightHistory(request.id, {
        action: 'Foto da entrega removida',
        comment: `${file.fileName || 'Foto da entrega'} removida pelo motorista.`
      });
      setMessage({ type: 'success', text: `Foto removida de ${formatProtocol(request)}.` });
      await refreshRequestAfterMediaChange(request.id);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao remover foto da entrega.' });
    } finally {
      setRemovingPhotoUrl(null);
      setSaving(false);
    }
  }

  async function handleDeliveryPhoto(request: FreightRequest) {
    const deliveryMedia = getFreightMedia(request, ['entrega']);
    if (!deliveryMedia.length) {
      setMessage({ type: 'error', text: 'Anexe ao menos uma foto de entrega antes de concluir.' });
      return;
    }

    setSaving(true);
    try {
      await updateFreightStatus(request, 'Concluído', 'Entrega concluída com foto pelo motorista.');
      await sendFreightNotification(request.id, 'status');
      setMessage({ type: 'success', text: `${formatProtocol(request)} concluído com foto.` });
      if (selected?.id === request.id) {
        await refreshRequestAfterMediaChange(request.id);
      } else {
        await loadData();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao concluir entrega.' });
    } finally {
      setSaving(false);
    }
  }

  async function saveDetailObservation(value: string): Promise<boolean> {
    if (!selected) return false;
    const comment = value.trim();
    if (!comment) {
      setMessage({ type: 'error', text: 'Digite uma observação antes de salvar.' });
      return false;
    }
    try {
      await appendFreightHistory(selected.id, { action: 'Observação logística', comment });
      setMessage({ type: 'success', text: 'Observação registrada no histórico.' });
      const refreshed = await getFreightRequests({ type: freightType });
      setRequests(refreshed);
      const updated = refreshed.find(item => item.id === selected.id) || null;
      setSelected(updated);
      if (updated) setHistory(await getFreightHistory(updated.id));
      return true;
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao salvar observação.' });
      return false;
    }
  }

  function exportXlsx() {
    const rows = filteredRequests.map(request => ({
      Protocolo: formatProtocol(request),
      Tipo: request.freightType,
      Status: request.status,
      Setor: request.setor || '',
      Projeto: request.projeto || request.projetoDescricao || '',
      Solicitante: request.solicitanteNome || request.emailSolicitante || request.createdByEmail || '',
      Prazo: formatFreightDate(request.prazoEntrega || request.prazoDesejado),
      Motorista: request.motorista || '',
      Veiculo: request.veiculo || '',
      Placa: request.placa || '',
      Origem: request.enderecoRetirada || request.enderecoOrigem || '',
      Destino: request.enderecoEntrega || request.enderecoDestino || '',
      Item: request.itemDescricao || request.necessidade || '',
      Observacoes: request.observacoes || request.observacoesFinais || ''
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Fretes');
    XLSX.writeFile(workbook, `fretes_${freightType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const header = isInternational
    ? { title: 'Frete Internacional', subtitle: 'Importação, exportação, volumes, mercadorias, anexos e status internos.', icon: Globe2 }
    : isDriver || isDriverFreightProfile
      ? { title: 'Frete Nacional - Motorista', subtitle: 'Fluxo mobile para retirada, rota, conclusão e foto de entrega.', icon: Smartphone }
      : { title: 'Frete Nacional', subtitle: '', icon: Truck };
  const HeaderIcon = header.icon;
  const showPageHeader = !isSingleTabView && (isInternational || activeTab === 'dashboard');
  const currentUserData = useMemo(() => {
    try {
      const raw = localStorage.getItem('porsche-cup-user');
      if (!raw) return null;
      const user = JSON.parse(raw);
      return { name: String(user.name || profile?.name || ''), email: String(user.email || '') };
    } catch {
      return null;
    }
  }, [profile]);

  useEffect(() => {
    if (currentUserData?.name && !nationalForm.solicitanteNome) {
      setNationalForm(current => ({ ...current, solicitanteNome: currentUserData.name }));
    }
  }, [currentUserData]);

  const nationalRequesterSlaDays = requesterSlaDays(lookups);
  const nationalMinimumDeadlineInput = toDateTimeLocalInput(requesterMinimumDeadline(nationalRequesterSlaDays).toISOString());
  const nationalDeadlineMessage = activeTab === 'nova'
    && !isInternational
    && message?.type === 'error'
    && message.text.startsWith('O prazo de entrega precisa')
    ? message.text
    : null;

  return (
    <div className="overflow-x-clip bg-slate-50 px-3 pb-0 pt-3 sm:p-4 md:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5">
        {showPageHeader ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
                <HeaderIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-bold text-slate-950 md:text-3xl">{header.title}</h1>
                {header.subtitle ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{header.subtitle}</p> : null}
              </div>
            </div>
            {activeTab === 'dashboard' ? (
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                <button className={buttonClass('secondary')} onClick={() => loadData()} type="button" disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <button className={buttonClass('secondary')} onClick={exportXlsx} type="button">
                  <Download className="h-4 w-4" />
                  Exportar
                </button>
                {!isDriver ? (
                  <button className={buttonClass('primary')} onClick={() => setTab('nova')} type="button">
                    <Plus className="h-4 w-4" />
                    Nova solicitação
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {message && !nationalDeadlineMessage ? (
          <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
            {message.text}
          </div>
        ) : null}

        {activeTab === 'dashboard' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total" value={stats.total} icon={ClipboardList} tone="bg-slate-100 text-slate-700" />
            <StatCard label="Solicitadas" value={stats.pendente} icon={AlertTriangle} tone="bg-amber-100 text-amber-700" />
            <StatCard label={isInternational ? 'Em andamento' : 'Agendados'} value={stats.agendado} icon={CalendarClock} tone="bg-blue-100 text-blue-700" />
            <StatCard label={isInternational ? 'Trânsito/desembaraço' : 'Em rota'} value={stats.rota} icon={Route} tone="bg-red-100 text-red-700" />
            <StatCard label="Concluídos" value={stats.concluido} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
          </div>
        ) : null}

        {!isSingleTabView ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto border-b border-slate-200 px-1 pb-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3, visible: true },
              { id: 'nova', label: 'Nova solicitação', icon: Plus, visible: !isDriver },
              { id: 'atendimento', label: 'Atendimento', icon: CalendarClock, visible: !isInternational },
              { id: 'kanban', label: 'Kanban', icon: Columns3, visible: !isInternational },
              { id: 'motorista', label: 'Motorista', icon: Smartphone, visible: !isInternational },
              { id: 'relatorios', label: 'Relatórios', icon: FileSpreadsheet, visible: true }
            ].filter(item => item.visible).map(item => (
              <button
                key={item.id}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold transition ${activeTab === item.id ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                onClick={() => setTab(item.id as TabKey)}
                type="button"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        {activeTab !== 'nova' && !(activeTab === 'kanban' && !isInternational) ? (
          <>
            <FilterToggleButton
              filtersOpen={standardFiltersOpen}
              onToggle={() => setStandardFiltersOpen(current => !current)}
            />
            {standardFiltersOpen ? (
              <FilterBar
                filters={filters}
                setFilters={setFilters}
                statuses={isInternational ? statusOptionsInternational : statusOptionsNational}
                lookups={lookups}
                isInternational={isInternational}
                hideStatus={activeTab === 'motorista' && !isInternational}
                hideProject={activeTab === 'motorista' && !isInternational}
              />
            ) : null}
          </>
        ) : null}

        {activeTab === 'kanban' && !isInternational ? (
          <FreightKanbanFilters
            filters={filters}
            setFilters={setFilters}
            requests={requests}
            lookups={lookups}
            filtersOpen={kanbanFiltersOpen}
            refreshing={loading}
            onToggleFilters={() => setKanbanFiltersOpen(current => !current)}
            onRefresh={loadData}
          />
        ) : null}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <div className="text-center text-slate-500">
              <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Carregando solicitações...
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <RequestsTable
                requests={filteredRequests}
                isInternational={isInternational}
                slaLimitDays={attendanceSlaDays(lookups)}
                requesterSlaLimitDays={nationalRequesterSlaDays}
                canEdit={canEditFreightRequests}
                onOpen={openDetails}
                onEdit={openEditRequest}
                onSchedule={startSchedule}
                saving={saving}
              />
            )}

            {activeTab === 'nova' && !isInternational && (
              <NationalForm
                form={nationalForm}
                files={productFiles}
                lookups={lookups}
                saving={saving}
                requesterSlaDays={nationalRequesterSlaDays}
                minimumDeadline={nationalMinimumDeadlineInput}
                deadlineMessage={nationalDeadlineMessage}
                currentUser={currentUserData || undefined}
                onChange={updateNationalField}
                onFiles={files => setProductFiles(files)}
                onSubmit={handleCreateNational}
                onBatchSubmit={handleBatchCreateNational}
                onCancel={isSingleTabView ? undefined : () => setTab('dashboard')}
              />
            )}

            {activeTab === 'nova' && isInternational && (
              <InternationalForm
                form={internationalForm}
                setForm={setInternationalForm}
                volumes={volumes}
                setVolumes={setVolumes}
                items={items}
                setItems={setItems}
                lookups={lookups}
                saving={saving}
                volumeFiles={volumeFiles}
                itemFiles={itemFiles}
                setVolumeFiles={setVolumeFiles}
                setItemFiles={setItemFiles}
                onSubmit={handleCreateInternational}
              />
            )}

            {activeTab === 'atendimento' && !isInternational && (
              <AttendancePanel
                requests={filteredRequests.filter(request => isRequestedFreightStatus(request.status) || selectedIds.includes(request.id))}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                draft={scheduleDraft}
                setDraft={setScheduleDraft}
                lookups={lookups}
                saving={saving}
                onApply={applySchedule}
                onOpen={openDetails}
                onCancel={cancelFreightRequests}
              />
            )}

            {activeTab === 'kanban' && !isInternational && (
              <KanbanPanel
                requests={filteredRequests}
                isDriver={false}
                saving={saving}
                onOpen={openDetails}
                onStatus={changeStatus}
                onDelivery={handleDeliveryPhoto}
              />
            )}

            {activeTab === 'motorista' && !isInternational && (
              <KanbanPanel
                requests={filteredRequests}
                isDriver={true}
                saving={saving}
                onOpen={openDetails}
                onStatus={changeStatus}
                onDelivery={handleDeliveryPhoto}
              />
            )}

            {activeTab === 'relatorios' && (
              <ReportsPanel requests={filteredRequests} isInternational={isInternational} onExport={exportXlsx} />
            )}
          </>
        )}
      </div>

      <DetailDrawer
        request={selected}
        history={history}
        addressOptions={lookups.enderecos}
        saving={saving || Boolean(selected && photoSavingByRequest[selected.id])}
        removingPhotoUrl={removingPhotoUrl}
        driverLayout={activeTab === 'motorista' && !isInternational}
        onClose={() => setSelected(null)}
        onSaveObservation={saveDetailObservation}
        onDeliveryUpload={handleDeliveryPhotoUpload}
        onDeliveryRemove={handleDeliveryPhotoRemove}
        onStatus={changeStatus}
        onDelivery={handleDeliveryPhoto}
      />
      <EditRequestDrawer
        request={editingRequest}
        form={nationalEditForm}
        files={editProductFiles}
        lookups={lookups}
        saving={saving}
        onChange={updateNationalEditField}
        onFiles={setEditProductFiles}
        onClose={closeEditRequest}
        onSubmit={handleSaveNationalEdit}
      />
      <SuccessDialog
        dialog={successDialog}
        onClose={() => setSuccessDialog(null)}
      />
    </div>
  );
}

function SuccessDialog({
  dialog,
  onClose
}: {
  dialog: { title: string; text: string } | null;
  onClose: () => void;
}) {
  if (!dialog) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-emerald-200 bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="freight-success-title">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 id="freight-success-title" className="text-lg font-bold text-slate-950">{dialog.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{dialog.text}</p>
        <button className={`${buttonClass('primary')} mt-5 w-full`} type="button" onClick={onClose}>
          Entendi
        </button>
      </div>
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
  statuses,
  lookups,
  isInternational,
  hideStatus = false,
  hideProject = false
}: {
  filters: any;
  setFilters: (value: any) => void;
  statuses: FreightStatus[];
  lookups: any;
  isInternational: boolean;
  hideStatus?: boolean;
  hideProject?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <div className="xl:col-span-2">
          <label className={labelClass()}>Busca</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={`${fieldClass()} pl-9`} value={filters.search} onChange={event => setFilters((current: any) => ({ ...current, search: event.target.value }))} placeholder="Protocolo, solicitante, item, motorista..." />
          </div>
        </div>
        {!hideStatus ? (
          <div>
          <label className={labelClass()}>Status</label>
          <select className={fieldClass()} value={filters.status} onChange={event => setFilters((current: any) => ({ ...current, status: event.target.value }))}>
            <option>Todos</option>
            {statuses.map(status => <option key={status}>{status}</option>)}
          </select>
          </div>
        ) : null}
        {!isInternational ? (
          <div>
            <label className={labelClass()}>Motorista</label>
            <select className={fieldClass()} value={filters.motorista} onChange={event => setFilters((current: any) => ({ ...current, motorista: event.target.value }))}>
              <option>TODOS</option>
              <SelectOptionList options={lookups.motoristas} />
            </select>
          </div>
        ) : null}
        <div>
          <label className={labelClass()}>Setor</label>
          <select className={fieldClass()} value={filters.setor} onChange={event => setFilters((current: any) => ({ ...current, setor: event.target.value }))}>
            <option value="">Todos</option>
            <SelectOptionList options={lookups.setores} />
          </select>
        </div>
        {!isInternational && !hideProject ? (
          <div>
            <label className={labelClass()}>Projeto</label>
            <select className={fieldClass()} value={filters.projeto} onChange={event => setFilters((current: any) => ({ ...current, projeto: event.target.value }))}>
              <option value="">Todos</option>
              <SelectOptionList options={lookups.projetos} />
            </select>
          </div>
        ) : null}
        <div>
          <label className={labelClass()}>Protocolo</label>
          <input className={fieldClass()} value={filters.protocolo} onChange={event => setFilters((current: any) => ({ ...current, protocolo: event.target.value }))} placeholder="#12, #15" />
        </div>
      </div>
    </div>
  );
}

function FilterToggleButton({
  filtersOpen,
  onToggle
}: {
  filtersOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex justify-end">
      <button
        className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${filtersOpen ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
        type="button"
        onClick={onToggle}
      >
        {filtersOpen ? 'Recolher filtros' : 'Exibir filtros'}
        <BarChart3 className="h-3.5 w-3.5 text-red-500" />
      </button>
    </div>
  );
}

function FreightKanbanFilters({
  filters,
  setFilters,
  requests,
  lookups,
  filtersOpen,
  refreshing,
  onToggleFilters,
  onRefresh
}: {
  filters: any;
  setFilters: (value: any) => void;
  requests: FreightRequest[];
  lookups: any;
  filtersOpen: boolean;
  refreshing: boolean;
  onToggleFilters: () => void;
  onRefresh: () => void;
}) {
  const motoristaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    requests.forEach(request => {
      const motorista = (request.motorista || '').trim();
      if (!motorista) return;
      counts.set(motorista, (counts.get(motorista) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
      .slice(0, 5);
  }, [requests]);

  const statusCounts = useMemo(() => {
    return statusOptionsNational.map(status => ({
      status,
      count: requests.filter(request => request.status === status).length
    })).filter(item => item.status !== 'Cancelado' || item.count);
  }, [requests]);

  const update = (patch: Record<string, string>) => setFilters((current: any) => ({ ...current, ...patch }));
  const setThisMonth = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    update({
      dateFrom: first.toISOString().slice(0, 10),
      dateTo: last.toISOString().slice(0, 10)
    });
  };
  const setThisYear = () => {
    const now = new Date();
    update({
      dateFrom: `${now.getFullYear()}-01-01`,
      dateTo: `${now.getFullYear()}-12-31`
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-950">Fretes Porsche Cup</h2>
        <div className="flex items-center gap-2">
          <button
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${filtersOpen ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            type="button"
            onClick={onToggleFilters}
          >
            Filtros
            <BarChart3 className="h-3.5 w-3.5 text-red-500" />
          </button>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Atualizar Kanban"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {filtersOpen ? (
        <>
      <div className="mt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${fieldClass()} pl-9`}
            value={filters.search}
            onChange={event => update({ search: event.target.value })}
            placeholder="Buscar por #protocolo, placa, setor..."
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-slate-500">Motorista:</span>
        <button
          className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${filters.motorista === 'TODOS' ? 'bg-red-600 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
          type="button"
          onClick={() => update({ motorista: 'TODOS' })}
        >
          TODOS
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${filters.motorista === 'TODOS' ? 'bg-white text-red-600' : 'bg-white text-slate-600'}`}>{requests.length}</span>
        </button>
        {motoristaCounts.map(item => (
          <button
            key={item.label}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${filters.motorista === item.label ? 'bg-red-600 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            type="button"
            onClick={() => update({ motorista: item.label })}
          >
            {item.label}
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${filters.motorista === item.label ? 'bg-white text-red-600' : 'bg-white text-slate-600'}`}>{item.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-slate-500">Status:</span>
        {statusCounts.map(item => (
          <button
            key={item.status}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${filters.status === item.status ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-200' : 'bg-red-600 text-white hover:bg-red-700'}`}
            type="button"
            onClick={() => update({ status: filters.status === item.status ? 'Todos' : item.status })}
          >
            {item.status}
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-red-600">{item.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <div>
          <label className={labelClass()}>Projeto</label>
          <select className={fieldClass()} value={filters.projeto} onChange={event => update({ projeto: event.target.value })}>
            <option value="">Todos os Projetos</option>
            <SelectOptionList options={lookups.projetos} />
          </select>
        </div>
        <div>
          <label className={labelClass()}>De</label>
          <input className={fieldClass()} type="date" value={filters.dateFrom} onChange={event => update({ dateFrom: event.target.value })} />
        </div>
        <div>
          <label className={labelClass()}>Até</label>
          <input className={fieldClass()} type="date" value={filters.dateTo} onChange={event => update({ dateTo: event.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="h-9 rounded-md border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200" type="button" onClick={setThisMonth}>Este Mês</button>
          <button className="h-9 rounded-md border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200" type="button" onClick={setThisYear}>Este Ano</button>
          <button className="h-9 rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700" type="button" onClick={() => update({ dateFrom: '', dateTo: '' })}>Limpar</button>
        </div>
      </div>
        </>
      ) : null}
    </div>
  );
}

function DashboardHeaderInfo({ label, description }: { label: string; description: string }) {
  return (
    <span className="group relative inline-flex cursor-help items-center" tabIndex={0} title={description}>
      {label}
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        {description}
      </span>
    </span>
  );
}

function RequestsTable({
  requests,
  isInternational,
  slaLimitDays,
  requesterSlaLimitDays,
  canEdit,
  onOpen,
  onEdit,
  onSchedule,
  saving
}: {
  requests: FreightRequest[];
  isInternational: boolean;
  slaLimitDays: number;
  requesterSlaLimitDays: number;
  canEdit: boolean;
  onOpen: (request: FreightRequest) => void;
  onEdit: (request: FreightRequest) => void;
  onSchedule: (request: FreightRequest) => void;
  saving: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-950">Solicitações</h2>
          <p className="text-sm text-slate-500">{requests.length} registro(s) encontrados</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className={`${isInternational ? 'min-w-full' : 'min-w-[1960px]'} divide-y divide-slate-100 text-sm`}>
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Protocolo</th>
              <th className="px-4 py-3">Status</th>
              {isInternational ? (
                <>
                  <th className="px-4 py-3">Necessidade</th>
                  <th className="px-4 py-3">Origem / destino</th>
                  <th className="px-4 py-3">Transporte</th>
                  <th className="px-4 py-3">Logística</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3">Setor</th>
                  <th className="px-4 py-3">Projeto</th>
                  <th className="px-4 py-3">Solicitante</th>
                  <th className="px-4 py-3">E-mail solicitante</th>
                  <th className="px-4 py-3">
                    <DashboardHeaderInfo label="Registro" description="Data em que a solicitação de frete foi criada." />
                  </th>
                  <th className="px-4 py-3">Itens</th>
                  <th className="px-4 py-3">
                    <DashboardHeaderInfo label="Prazo" description="Prazo final desejado pelo solicitante para conclusão do frete" />
                  </th>
                  <th className="px-4 py-3">
                    <DashboardHeaderInfo label="Agendamento" description="Data em que o setor logística definiu que o frete será iniciado" />
                  </th>
                  <th className="px-4 py-3">
                    <DashboardHeaderInfo label="Atendimento" description="Data em que o setor logístico realizou o agendamento do frete" />
                  </th>
                  <th className="px-4 py-3">
                    <DashboardHeaderInfo
                      label="SLA Solicitante"
                      description={`SLA do solicitante de fretes nacionais: antecedência mínima entre o registro da solicitação e o prazo solicitado. Meta: ${formatSlaDaysLabel(requesterSlaLimitDays)}`}
                    />
                  </th>
                  <th className="px-4 py-3">
                    <DashboardHeaderInfo
                      label="SLA Agendamento"
                      description={`SLA para agendamento do frete pela logística (status: solicitado -> Agendado). Meta: ${slaLimitDays} dia${slaLimitDays === 1 ? '' : 's'}`}
                    />
                  </th>
                  <th className="px-4 py-3">
                    <DashboardHeaderInfo label="Data de entrega" description="Data em que o frete foi concluído" />
                  </th>
                  <th className="px-4 py-3">Veículo</th>
                  <th className="px-4 py-3">Motorista</th>
                </>
              )}
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map(request => {
              const slaDays = freightSlaElapsedDays(request);
              const isSlaLate = slaDays > slaLimitDays;
              const requesterSlaDays = freightRequesterSlaElapsedDays(request);
              const isRequesterSlaLate = requesterSlaDays === null || requesterSlaDays < requesterSlaLimitDays;
              return (
              <tr key={request.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-950">{formatProtocol(request)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(request.status)}`}>{request.status}</span>
                </td>
                {isInternational ? (
                  <>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{request.necessidade || '-'}</div>
                      <div className="text-xs text-slate-500">{request.definitivaTemporaria || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{request.empresaRemetente || '-'}</div>
                      <div className="text-xs text-slate-500">{request.empresaDestinatario || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{`${request.tipoFrete || '-'} · ${request.modalidadeFrete || '-'}`}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{request.motorista || '-'}</div>
                      <div className="text-xs text-slate-500">{[request.veiculo, request.placa].filter(Boolean).join(' - ') || formatFreightDate(request.agendamentoAt)}</div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-semibold text-slate-900">{request.setor || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{request.projeto || request.projetoDescricao || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{request.solicitanteNome || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{requesterEmail(request)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatFreightDate(request.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-sm whitespace-pre-wrap text-slate-700">{request.itemDescricao || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatFreightDate(request.prazoEntrega)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatFreightDate(request.agendamentoAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatFreightDate(request.atendimentoAt)}</td>
                    <td className="px-4 py-3">
                      {requesterSlaDays === null ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${isRequesterSlaLate ? 'border-red-200 bg-red-100 text-red-700' : 'border-emerald-200 bg-emerald-100 text-emerald-700'}`}>
                          {formatSlaDaysLabel(requesterSlaDays)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${isSlaLate ? 'border-red-200 bg-red-100 text-red-700' : 'border-emerald-200 bg-emerald-100 text-emerald-700'}`}>
                        {slaDays} dia{slaDays === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formattedFreightDeliveryDate(request)}</td>
                    <td className="px-4 py-3 text-slate-700">{[request.veiculo, request.placa].filter(Boolean).join(' - ') || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{request.motorista || '-'}</td>
                  </>
                )}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {!isInternational && canEdit ? (
                      <button
                        className={buttonClass('secondary')}
                        onClick={() => onEdit(request)}
                        type="button"
                        disabled={saving}
                        title="Editar solicitação"
                        aria-label={`Editar ${formatProtocol(request)}`}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                    ) : null}
                    <button className={buttonClass('secondary')} onClick={() => onOpen(request)} type="button">
                      <Eye className="h-4 w-4" />
                      Detalhes
                    </button>
                    {!isInternational && isRequestedFreightStatus(request.status) ? (
                      <button className={buttonClass('dark')} onClick={() => onSchedule(request)} type="button" disabled={saving}>
                        <CalendarClock className="h-4 w-4" />
                        Agendar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
              );
            })}
            {!requests.length ? (
              <tr>
                <td className="px-4 py-10 text-center text-slate-500" colSpan={isInternational ? 7 : 17}>Nenhuma solicitação encontrada.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchItemCard({
  item,
  index,
  lookups,
  chassisCategories,
  containersList,
  minimumDeadline,
  requesterSlaDays: slaDays,
  onChange,
  onRemove,
  canRemove,
}: {
  item: BatchItem;
  index: number;
  lookups: any;
  chassisCategories: Map<string, Chassis[]>;
  containersList: { id: string; name: string }[];
  minimumDeadline: string;
  requesterSlaDays: number;
  onChange: (updates: Partial<BatchItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [selectedChassisCat, setSelectedChassisCat] = useState<string | null>(null);
  const [containerMenuOpen, setContainerMenuOpen] = useState(false);
  const [openAddressMenu, setOpenAddressMenu] = useState<string | null>(null);

  const appendDescription = (text: string) => {
    const current = item.itemDescricao.trim();
    onChange({ itemDescricao: current ? `${current}\n${text}` : text });
    setSelectedChassisCat(null);
  };

  const hasChips = chassisCategories.size > 0 || containersList.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-800">Frete #{index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="rounded p-1 text-slate-400 hover:text-red-500">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="space-y-3 p-4">
        {hasChips && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400">Inserir rápido:</span>
            {Array.from(chassisCategories.keys()).map(gen => (
              <div key={gen} className="relative">
                <button
                  type="button"
                  className={`inline-flex items-center rounded border px-2.5 py-1 text-xs transition ${selectedChassisCat === gen ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'}`}
                  onClick={() => setSelectedChassisCat(c => c === gen ? null : gen)}
                >
                  + Carro {gen}
                </button>
                {selectedChassisCat === gen && (
                  <div className="absolute left-0 top-full z-20 mt-1 max-h-48 min-w-36 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <p className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Carro {gen}</p>
                    {(chassisCategories.get(gen) || []).map(c => (
                      <button key={c.id} type="button" className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => appendDescription(`1x Carro ${gen} #${c.codigo}`)}>
                        {c.codigo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {containersList.length > 0 && (
              <div className="relative">
                <button type="button"
                  className={`inline-flex items-center rounded border px-2.5 py-1 text-xs transition ${containerMenuOpen ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'}`}
                  onClick={() => { setContainerMenuOpen(o => !o); setSelectedChassisCat(null); }}>
                  + Container
                </button>
                {containerMenuOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 max-h-48 min-w-44 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <p className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Selecione o Container</p>
                    {containersList.map(c => (
                      <button key={c.id} type="button" className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => { appendDescription(`1x CNTR (${c.name})`); setContainerMenuOpen(false); }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div>
          <label className={labelClass()}>Discriminação dos itens<span className="text-red-500"> *</span></label>
          <textarea
            className={`${areaClass()} min-h-[100px]`}
            value={item.itemDescricao}
            onChange={e => onChange({ itemDescricao: e.target.value })}
            placeholder={'Ex:\n1x Parachoque traseiro\n2x Molde de alumínio'}
            required
          />
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          onClick={() => onChange({ overrideOpen: !item.overrideOpen })}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${item.overrideOpen ? 'rotate-180' : ''}`} />
          {item.overrideOpen ? 'Ocultar campos específicos' : 'Personalizar campos para este frete'}
        </button>
        {item.overrideOpen && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-400">Deixe em branco para usar o valor padrão acima. Os campos abaixo substituem o padrão apenas neste frete.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass()}>Prazo específico</label>
                <input
                  className={fieldClass()}
                  type="datetime-local"
                  min={minimumDeadline}
                  step={60}
                  value={item.prazoEntrega}
                  onChange={e => onChange({ prazoEntrega: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass()}>Responsável local específico</label>
                <input
                  className={fieldClass()}
                  value={item.responsavelLocal}
                  onChange={e => onChange({ responsavelLocal: e.target.value })}
                  placeholder="Substitui o responsável padrão"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RecurringAddressField
                label="Retirada específica"
                value={item.enderecoRetirada}
                options={lookups.enderecos}
                open={openAddressMenu === 'retirada'}
                onToggle={() => setOpenAddressMenu(c => c === 'retirada' ? null : 'retirada')}
                onClose={() => setOpenAddressMenu(null)}
                onChange={v => onChange({ enderecoRetirada: v })}
              />
              <RecurringAddressField
                label="Entrega específica"
                value={item.enderecoEntrega}
                options={lookups.enderecos}
                open={openAddressMenu === 'entrega'}
                onToggle={() => setOpenAddressMenu(c => c === 'entrega' ? null : 'entrega')}
                onClose={() => setOpenAddressMenu(null)}
                onChange={v => onChange({ enderecoEntrega: v })}
              />
            </div>
            <div>
              <label className={labelClass()}>Observações específicas</label>
              <textarea
                className={areaClass()}
                value={item.observacoes}
                onChange={e => onChange({ observacoes: e.target.value })}
                placeholder="Observações exclusivas para este frete"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NationalForm({
  form,
  files,
  lookups,
  saving,
  requesterSlaDays,
  minimumDeadline,
  deadlineMessage,
  currentUser,
  onChange,
  onFiles,
  onSubmit,
  onBatchSubmit,
  onCancel
}: {
  form: typeof emptyNationalForm;
  files: File[];
  lookups: any;
  saving: boolean;
  requesterSlaDays: number;
  minimumDeadline: string;
  deadlineMessage?: string | null;
  currentUser?: { name: string; email: string };
  onChange: (field: keyof typeof emptyNationalForm, value: string) => void;
  onFiles: (files: File[]) => void;
  onSubmit: (event: FormEvent) => void;
  onBatchSubmit?: (items: (typeof emptyNationalForm)[]) => Promise<void>;
  onCancel?: () => void;
}) {
  const [freightMode, setFreightMode] = useState<'single' | 'batch'>('single');
  const [batchItems, setBatchItems] = useState<BatchItem[]>([emptyBatchItem()]);
  const [openAddressMenu, setOpenAddressMenu] = useState<'retirada' | 'entrega' | null>(null);
  const [filePreviews, setFilePreviews] = useState<Array<{ name: string; url: string }>>([]);
  const [chassisData, setChassisData] = useState<Chassis[]>([]);
  const [containersList, setContainersList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedChassisCat, setSelectedChassisCat] = useState<string | null>(null);
  const [containerMenuOpen, setContainerMenuOpen] = useState<boolean>(false);
  const [nameLocked, setNameLocked] = useState<boolean>(true);

  useEffect(() => {
    getChassis().then(setChassisData).catch(() => {});
    createClient()
      .from('containers')
      .select('id, name')
      .order('name')
      .then(({ data }) => { if (data) setContainersList(data as Array<{ id: string; name: string }>); });
  }, []);

  useEffect(() => {
    const previews = files.map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
    setFilePreviews(previews);
    return () => previews.forEach(preview => URL.revokeObjectURL(preview.url));
  }, [files]);

  const removeFile = (index: number) => {
    onFiles(files.filter((_, i) => i !== index));
  };

  const chassisCategories = useMemo(() => {
    const map = new Map<string, Chassis[]>();
    chassisData.forEach(c => {
      const gen = c.geracao || 'Outros';
      if (!map.has(gen)) map.set(gen, []);
      map.get(gen)!.push(c);
    });
    return map;
  }, [chassisData]);

  const progressFields = [form.projeto, form.setor, form.prazoEntrega, form.enderecoRetirada, form.enderecoEntrega, form.itemDescricao, form.responsavelLocal];
  const filledCount = progressFields.filter(Boolean).length;
  const progressPct = Math.round((filledCount / progressFields.length) * 100);

  const appendDescription = (text: string) => {
    const current = form.itemDescricao.trim();
    onChange('itemDescricao', current ? `${current}\n${text}` : text);
    setSelectedChassisCat(null);
  };

  return (
    <>
      {/* Page header */}
      <div className="mb-4">
        <nav className="mb-2 flex items-center gap-1 text-xs text-slate-400">
          <span>Fretes</span>
          <ChevronRight className="h-3 w-3" />
          <span>Frete Nacional</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-slate-600">Cadastrar Solicitação</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            <h1 className="text-lg font-bold text-slate-950 sm:text-xl">Cadastrar solicitação de frete nacional</h1>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-xs text-slate-500">Progresso da solicitação</span>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-red-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-xs font-bold text-red-600">{progressPct}%</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition ${freightMode === 'single' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setFreightMode('single')}
          >
            {freightMode === 'single' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            Frete único
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition ${freightMode === 'batch' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setFreightMode('batch')}
          >
            {freightMode === 'batch' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            Vários fretes
          </button>
        </div>
      </div>

    <form data-freight-national-form="true" className="w-full space-y-4" onSubmit={onSubmit}>

      {/* Single unified card */}
      <div className="rounded-lg border border-slate-200 bg-white">

        {/* 1. Dados Gerais */}
        <div className="px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Projeto">
              <select className={fieldClass()} value={form.projeto} onChange={e => onChange('projeto', e.target.value)}>
                <option value="">Selecione...</option>
                <SelectOptionList options={lookups.projetos} />
              </select>
            </Field>
            <Field label="Setor Solicitante *">
              <select className={fieldClass()} value={form.setor} onChange={e => onChange('setor', e.target.value)} required>
                <option value="">Selecione...</option>
                <SelectOptionList options={lookups.setores} />
              </select>
            </Field>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className={labelClass()}>Prazo de Entrega<span className="text-red-500"> *</span></span>
                {!deadlineMessage && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                    Prazo mínimo: {formatSlaDaysLabel(requesterSlaDays)}
                  </span>
                )}
              </div>
              <input
                className={fieldClass()}
                type="datetime-local"
                min={minimumDeadline}
                step={60}
                value={form.prazoEntrega}
                onChange={e => onChange('prazoEntrega', e.target.value)}
                required
              />
            </div>
          </div>
          {deadlineMessage ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{deadlineMessage}</span>
            </div>
          ) : null}
        </div>

        {/* 2. Responsáveis */}
        <div className="px-5 pb-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass()}>Responsável pela Solicitação<span className="text-red-500"> *</span></label>
              <div className={`flex h-10 items-center gap-2 rounded-md border px-3 ${nameLocked ? 'border-slate-200 bg-slate-50' : 'border-red-300 bg-white'}`}>
                <div className="min-w-0 flex-1 overflow-hidden">
                  {nameLocked ? (
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-sm text-slate-800">
                        {currentUser?.name || form.solicitanteNome || '—'}
                      </span>
                      {currentUser?.email ? (
                        <span className="shrink-0 text-xs text-slate-400">({currentUser.email})</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-baseline gap-2">
                      <input
                        className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                        value={form.solicitanteNome}
                        onChange={e => onChange('solicitanteNome', e.target.value)}
                        placeholder="Nome do solicitante..."
                        autoFocus
                        required
                      />
                      {currentUser?.email ? (
                        <span className="shrink-0 text-xs text-slate-400">({currentUser.email})</span>
                      ) : null}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  title={nameLocked ? 'Clique para editar o nome' : 'Clique para travar o nome'}
                  className="shrink-0 rounded p-0.5 transition hover:bg-slate-200"
                  onClick={() => setNameLocked(l => !l)}
                >
                  <Lock className={`h-3.5 w-3.5 ${nameLocked ? 'text-slate-400' : 'text-red-500'}`} />
                </button>
              </div>
              {!nameLocked && (
                <p className="mt-1 text-[11px] text-slate-500">Editando em nome de outro solicitante. O e-mail permanece fixo.</p>
              )}
            </div>
            <Field label="Responsável no Local da Retirada *">
              <input
                className={fieldClass()}
                value={form.responsavelLocal}
                onChange={e => onChange('responsavelLocal', e.target.value)}
                placeholder="Ex: Carlos Almoxarife / Ramal 404"
                required
              />
            </Field>
          </div>
        </div>

        {/* 3. Rota */}
        <div className="px-5 pb-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <RecurringAddressField
              label="Endereço de Retirada (Origem) *"
              value={form.enderecoRetirada}
              options={lookups.enderecos}
              open={openAddressMenu === 'retirada'}
              onToggle={() => setOpenAddressMenu(cur => cur === 'retirada' ? null : 'retirada')}
              onClose={() => setOpenAddressMenu(null)}
              onChange={v => onChange('enderecoRetirada', v)}
            />
            <RecurringAddressField
              label="Endereço de Entrega (Destino) *"
              value={form.enderecoEntrega}
              options={lookups.enderecos}
              open={openAddressMenu === 'entrega'}
              onToggle={() => setOpenAddressMenu(cur => cur === 'entrega' ? null : 'entrega')}
              onClose={() => setOpenAddressMenu(null)}
              onChange={v => onChange('enderecoEntrega', v)}
            />
          </div>
          {form.enderecoRetirada && form.enderecoEntrega ? (
            <a
              href={`https://www.google.com/maps/dir/${encodeURIComponent(form.enderecoRetirada)}/${encodeURIComponent(form.enderecoEntrega)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              <Route className="h-3 w-3" />
              Ver no Mapa
            </a>
          ) : null}
        </div>

        {/* 4. Itens */}
        {freightMode === 'single' ? (
          <div className="px-5 pb-5 sm:px-6">
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className={labelClass()}>Descreva as quantidades e itens a serem transportados<span className="text-red-500"> *</span></span>
                  {form.itemDescricao ? (
                    <button type="button" className="text-[11px] font-medium text-slate-400 hover:text-red-600" onClick={() => onChange('itemDescricao', '')}>
                      Limpar
                    </button>
                  ) : null}
                </div>
                <textarea
                  className={`${areaClass()} min-h-[120px]`}
                  value={form.itemDescricao}
                  onChange={e => onChange('itemDescricao', e.target.value)}
                  placeholder={'Exemplo:\n1x Parachoque traseiro\n2x Molde de alumínio'}
                  required
                />
              </div>

              {(chassisCategories.size > 0 || containersList.length > 0) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-400">Inserir rápido:</span>
                  {Array.from(chassisCategories.keys()).map(gen => (
                    <div key={gen} className="relative">
                      <button
                        type="button"
                        className={`inline-flex items-center rounded border px-2.5 py-1 text-xs transition ${selectedChassisCat === gen ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'}`}
                        onClick={() => setSelectedChassisCat(cur => cur === gen ? null : gen)}
                      >
                        + Carro {gen}
                      </button>
                      {selectedChassisCat === gen ? (
                        <div className="absolute left-0 top-full z-20 mt-1 max-h-48 min-w-36 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                          <p className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Carro {gen}</p>
                          {(chassisCategories.get(gen) || []).map(c => (
                            <button key={c.id} type="button" className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                              onClick={() => appendDescription(`1x Carro ${gen} #${c.codigo}`)}>
                              {c.codigo}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {containersList.length > 0 ? (
                    <div className="relative">
                      <button type="button"
                        className={`inline-flex items-center rounded border px-2.5 py-1 text-xs transition ${containerMenuOpen ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'}`}
                        onClick={() => { setContainerMenuOpen(o => !o); setSelectedChassisCat(null); }}>
                        + Container
                      </button>
                      {containerMenuOpen ? (
                        <div className="absolute left-0 top-full z-20 mt-1 max-h-48 min-w-44 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                          <p className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Selecione o Container</p>
                          {containersList.map(c => (
                            <button key={c.id} type="button" className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                              onClick={() => { appendDescription(`1x CNTR (${c.name})`); setContainerMenuOpen(false); }}>
                              {c.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className={labelClass()}>Observações Especiais</label>
                <textarea
                  className={areaClass()}
                  value={form.observacoes}
                  onChange={e => onChange('observacoes', e.target.value)}
                  placeholder="Requisitos específicos para motorista, tipo de veículo (baú, sider, plataforma), carga frágil ou restrições de horário de descarga..."
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-5 sm:px-6">
            <div className="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Cada item abaixo gerará uma <strong>solicitação de frete separada</strong>. Os campos padrão (setor, prazo, responsáveis, endereços) se aplicam a todos, a menos que você personalize individualmente.
            </div>
            <div className="space-y-3">
              {batchItems.map((item, index) => (
                <BatchItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  lookups={lookups}
                  chassisCategories={chassisCategories}
                  containersList={containersList}
                  minimumDeadline={minimumDeadline}
                  requesterSlaDays={requesterSlaDays}
                  canRemove={batchItems.length > 1}
                  onChange={updates => setBatchItems(prev => prev.map((it, i) => i === index ? { ...it, ...updates } : it))}
                  onRemove={() => setBatchItems(prev => prev.filter((_, i) => i !== index))}
                />
              ))}
            </div>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              onClick={() => setBatchItems(prev => [...prev, emptyBatchItem()])}
            >
              <Plus className="h-4 w-4" />
              Adicionar outro frete
            </button>
          </div>
        )}

        {/* 5. Fotos & Documentos */}
        <div className="px-5 pb-6 sm:px-6">
          <label className={`${labelClass()} mb-3`}>Foto</label>
          {filePreviews.length === 0 ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white py-10 text-center transition hover:border-slate-400 hover:bg-slate-50">
              <Camera className="h-8 w-8 text-slate-300" />
              <span className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Escolher arquivos
              </span>
              <span className="text-xs text-slate-400">Arraste ou clique para anexar fotos dos itens ou NFe (PNG, JPG, PDF até 15MB)</span>
              <span className="text-xs italic text-slate-400">Nenhuma foto selecionada até o momento.</span>
              <input
                className="sr-only"
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={e => { onFiles(Array.from(e.target.files || [])); e.currentTarget.value = ''; }}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-500">Arquivos selecionados ({files.length})</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filePreviews.map((preview, i) => (
                  <div key={`${preview.name}-${i}`} className="relative overflow-hidden rounded border border-slate-200 bg-white">
                    <img src={preview.url} alt={`Arquivo ${i + 1}`} className="aspect-square w-full object-cover" />
                    <div className="truncate px-2 py-1 text-[11px] text-slate-600">{preview.name}</div>
                    <button
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm hover:text-red-600"
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={`Remover ${preview.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                Adicionar mais arquivos
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={e => { onFiles([...files, ...Array.from(e.target.files || [])]); e.currentTarget.value = ''; }}
                />
              </label>
            </div>
          )}
        </div>

      </div>

      {/* Footer actions */}
      <div className="flex flex-col-reverse gap-2 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" className={`${buttonClass('secondary')} h-9 px-4 text-sm`} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            Salvar Rascunho
          </button>
          {onCancel ? (
            <button type="button" className={`${buttonClass('secondary')} h-9 px-4 text-sm`} disabled={saving} onClick={onCancel}>
              Cancelar
            </button>
          ) : null}
        </div>
        {freightMode === 'single' ? (
          <button
            key={saving ? 'saving-national-submit' : 'ready-national-submit'}
            className={`${buttonClass('primary')} h-10 px-6`}
            type="submit"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? (
              <><RefreshCw className="h-4 w-4 animate-spin" />Salvando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" />Cadastrar solicitação</>
            )}
          </button>
        ) : (
          <button
            type="button"
            className={`${buttonClass('primary')} h-10 px-6`}
            disabled={saving}
            onClick={async () => {
              if (!onBatchSubmit) return;
              const merged = batchItems.map(item => ({
                ...form,
                itemDescricao: item.itemDescricao,
                prazoEntrega: item.prazoEntrega || form.prazoEntrega,
                enderecoRetirada: item.enderecoRetirada || form.enderecoRetirada,
                enderecoEntrega: item.enderecoEntrega || form.enderecoEntrega,
                responsavelLocal: item.responsavelLocal || form.responsavelLocal,
                observacoes: item.observacoes || form.observacoes,
              }));
              await onBatchSubmit(merged);
              setBatchItems([emptyBatchItem()]);
            }}
          >
            {saving ? (
              <><RefreshCw className="h-4 w-4 animate-spin" />Salvando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" />Cadastrar {batchItems.length} solicitaç{batchItems.length === 1 ? 'ão' : 'ões'}</>
            )}
          </button>
        )}
      </div>
    </form>
    </>
  );
}

function RecurringAddressField({
  label,
  value,
  options,
  open,
  onToggle,
  onClose,
  onChange
}: {
  label: string;
  value: string;
  options: FreightLookupOption[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const renderMenuContent = () => (
    <>
      <div className="max-h-72 overflow-y-auto">
        {options.length ? options.map(option => {
          const shortcut = recurringAddressShortcutLabel(option);
          const fullAddress = recurringAddressFullValue(option);
          return (
            <button
              key={option.id || option.value || option.label}
              className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
              type="button"
              title={fullAddress}
              onClick={() => {
                onChange(fullAddress);
                onClose();
              }}
            >
              {shortcut || fullAddress}
            </button>
          );
        }) : (
          <div className="px-3 py-2 text-slate-500">Nenhum endereço cadastrado.</div>
        )}
      </div>
      <button
        className="block w-full border-t border-slate-100 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
        type="button"
        onClick={() => {
          onChange('');
          onClose();
        }}
      >
        Limpar
      </button>
    </>
  );
  const mobileMenu = open && typeof document !== 'undefined'
    ? createPortal(
      <>
        <button
          className="fixed inset-0 z-[9998] bg-transparent sm:hidden"
          type="button"
          aria-label="Fechar endereços"
          onClick={onClose}
        />
        <div className="fixed left-4 right-4 top-1/2 z-[9999] max-h-[70dvh] -translate-y-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-2xl sm:hidden">
          {renderMenuContent()}
        </div>
      </>,
      document.body
    )
    : null;

  const addrIsReq = label.endsWith(' *');
  const addrLabelText = addrIsReq ? label.slice(0, -2) : label;
  return (
    <div className="block min-w-0">
      <span className={labelClass()}>{addrLabelText}{addrIsReq && <span className="text-red-500"> *</span>}</span>
      <div className="relative min-w-0">
        <button
          className="absolute right-1 top-1/2 z-10 inline-flex h-10 -translate-y-1/2 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white sm:h-8"
          type="button"
          onClick={onToggle}
        >
          <MapPin className="h-3.5 w-3.5 text-pink-500" />
          Endereços
        </button>
        {open ? (
          <>
            {mobileMenu}
            <div className="absolute right-0 top-full z-30 mt-1 hidden w-64 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg sm:block">
              {renderMenuContent()}
            </div>
          </>
        ) : null}
        <input className={`${fieldClass()} pr-32`} value={value} onChange={event => onChange(event.target.value)} />
      </div>
    </div>
  );
}

function EditRequestDrawer({
  request,
  form,
  files,
  lookups,
  saving,
  onChange,
  onFiles,
  onClose,
  onSubmit
}: {
  request: FreightRequest | null;
  form: typeof emptyNationalEditForm;
  files: File[];
  lookups: any;
  saving: boolean;
  onChange: (field: keyof typeof emptyNationalEditForm, value: string) => void;
  onFiles: (files: File[]) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
      <form className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl" onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edição administrativa</p>
            <h2 className="text-xl font-bold text-slate-950">Editar solicitação {formatProtocol(request)}</h2>
            <p className="mt-1 text-sm text-slate-500">Altere os dados da solicitação nacional e salve para atualizar o Supabase.</p>
          </div>
          <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" type="button" onClick={onClose} aria-label="Fechar edição">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-5">
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="font-semibold text-slate-950">Dados da solicitação</h3>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <Field label="Protocolo">
                  <input className={fieldClass()} value={formatProtocol(request)} disabled />
                </Field>
                <Field label="Status">
                  <select className={fieldClass()} value={form.status} onChange={event => onChange('status', event.target.value)} required>
                    {statusOptionsNational.map(status => <option key={status}>{status}</option>)}
                  </select>
                </Field>
                <Field label="Setor">
                  <select className={fieldClass()} value={form.setor} onChange={event => onChange('setor', event.target.value)} required>
                    <option value="">Selecione...</option>
                    <SelectOptionList options={lookups.setores} />
                  </select>
                </Field>
                <Field label="Projeto">
                  <select className={fieldClass()} value={form.projeto} onChange={event => onChange('projeto', event.target.value)} required>
                    <option value="">Selecione...</option>
                    <SelectOptionList options={lookups.projetos} />
                  </select>
                </Field>
                <Field label="Prazo de entrega">
                  <input className={fieldClass()} type="datetime-local" value={form.prazoEntrega} onChange={event => onChange('prazoEntrega', event.target.value)} required />
                </Field>
                <Field label="Responsável pela solicitação">
                  <input className={fieldClass()} value={form.solicitanteNome} onChange={event => onChange('solicitanteNome', event.target.value)} required />
                </Field>
                <Field label="Responsável no local da retirada">
                  <input className={fieldClass()} value={form.responsavelLocal} onChange={event => onChange('responsavelLocal', event.target.value)} />
                </Field>
                <Field label="Endereço de retirada">
                  <input className={fieldClass()} list="edit-freight-addresses" value={form.enderecoRetirada} onChange={event => onChange('enderecoRetirada', event.target.value)} />
                </Field>
                <Field label="Endereço de entrega">
                  <input className={fieldClass()} list="edit-freight-addresses" value={form.enderecoEntrega} onChange={event => onChange('enderecoEntrega', event.target.value)} />
                  <datalist id="edit-freight-addresses"><SelectAddressOptionList options={lookups.enderecos} /></datalist>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Descreva as quantidades e itens a serem transportados">
                    <textarea className={areaClass()} value={form.itemDescricao} onChange={event => onChange('itemDescricao', event.target.value)} required />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Observações do solicitante">
                    <textarea className={areaClass()} value={form.observacoes} onChange={event => onChange('observacoes', event.target.value)} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="font-semibold text-slate-950">Atendimento logístico</h3>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <Field label="Motorista">
                  <input className={fieldClass()} list="edit-freight-drivers" value={form.motorista} onChange={event => onChange('motorista', event.target.value)} />
                  <datalist id="edit-freight-drivers"><SelectOptionList options={lookups.motoristas} /></datalist>
                </Field>
                <Field label="Veículo">
                  <input className={fieldClass()} list="edit-freight-vehicles" value={form.veiculo} onChange={event => onChange('veiculo', event.target.value)} />
                  <datalist id="edit-freight-vehicles"><SelectOptionList options={lookups.veiculos} /></datalist>
                </Field>
                <Field label="Placa">
                  <input className={fieldClass()} value={form.placa} onChange={event => onChange('placa', event.target.value.toUpperCase())} />
                </Field>
                <Field label="Agendamento">
                  <input className={fieldClass()} type="datetime-local" value={form.agendamentoAt} onChange={event => onChange('agendamentoAt', event.target.value)} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Observações logística">
                    <textarea className={areaClass()} value={form.observacoesLogistica} onChange={event => onChange('observacoesLogistica', event.target.value)} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="font-semibold text-slate-950">Fotos do produto</h3>
              </div>
              <div className="p-4">
                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                  <input type="file" accept="image/*" multiple onChange={event => onFiles(Array.from(event.target.files || []))} />
                  <p className="text-sm text-slate-500">{files.length ? `${files.length} nova(s) foto(s) selecionada(s)` : 'Selecione apenas se quiser anexar novas fotos.'}</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button className={buttonClass('secondary')} type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={buttonClass('primary')} type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const isReq = label.endsWith(' *');
  const labelText = isReq ? label.slice(0, -2) : label;
  return (
    <label className="block min-w-0">
      <span className={labelClass()}>{labelText}{isReq && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  );
}

function AttendancePanel({
  requests,
  selectedIds,
  setSelectedIds,
  draft,
  setDraft,
  lookups,
  saving,
  onApply,
  onOpen,
  onCancel
}: {
  requests: FreightRequest[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  draft: any;
  setDraft: (fn: any) => void;
  lookups: any;
  saving: boolean;
  onApply: () => void;
  onOpen: (request: FreightRequest) => void;
  onCancel: (targets: FreightRequest[], reason: string) => void;
}) {
  const [sortState, setSortState] = useState<{ column: 'protocol' | 'setor' | 'projeto' | 'registro' | 'prazo' | 'sla' | 'solicitante' | 'item' | 'observacoes'; direction: 'asc' | 'desc' }>({
    column: 'prazo',
    direction: 'asc'
  });
  const [routeEstimates, setRouteEstimates] = useState<Record<string, RouteEstimate>>({});
  const [cancelPanelOpen, setCancelPanelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [previewMedia, setPreviewMedia] = useState<FreightMedia | null>(null);
  const toggle = (id: string) => {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(item => item !== id) : [...selectedIds, id]);
  };
  const selectedRequests = useMemo(() => requests.filter(request => selectedIds.includes(request.id)), [requests, selectedIds]);
  const filteredRequests = useMemo(() => {
    return [...requests]
      .sort((a, b) => {
        const direction = sortState.direction === 'asc' ? 1 : -1;
        const getValue = (request: FreightRequest) => {
          if (sortState.column === 'protocol') return request.protocol;
          if (sortState.column === 'setor') return request.setor || '';
          if (sortState.column === 'projeto') return request.projeto || request.projetoDescricao || '';
          if (sortState.column === 'registro') return freightDateTime(request.createdAt, 0);
          if (sortState.column === 'prazo') return new Date(request.prazoEntrega || request.agendamentoAt || request.createdAt).getTime() || 0;
          if (sortState.column === 'sla') return freightSlaElapsedDays(request);
          if (sortState.column === 'solicitante') return request.solicitanteNome || '';
          if (sortState.column === 'observacoes') return request.observacoes || request.observacoesFinais || '';
          return request.itemDescricao || '';
        };
        const valueA = getValue(a);
        const valueB = getValue(b);
        if (typeof valueA === 'number' && typeof valueB === 'number') return (valueA - valueB) * direction;
        return String(valueA).localeCompare(String(valueB), 'pt-BR', { sensitivity: 'base' }) * direction;
      });
  }, [requests, sortState]);

  const selectedVehicleValues = splitSelection(draft.veiculo);
  const vehicleOptions = useMemo(() => {
    const options = [...lookups.veiculos];
    selectedVehicleValues.forEach(value => {
      if (!options.some((option: FreightLookupOption) => option.value === value)) {
        options.push({ value, label: value });
      }
    });
    return options;
  }, [lookups.veiculos, selectedVehicleValues.join('|')]);

  const selectedDriverValues = splitSelection(draft.motorista);
  const driverOptions = useMemo(() => {
    const options = [...lookups.motoristas];
    selectedDriverValues.forEach(value => {
      if (!options.some((option: FreightLookupOption) => option.value === value)) {
        options.push({ value, label: value });
      }
    });
    return options;
  }, [lookups.motoristas, selectedDriverValues.join('|')]);
  const slaLimitDays = attendanceSlaDays(lookups);

  useEffect(() => {
    let cancelled = false;
    if (!selectedRequests.length) {
      setRouteEstimates({});
      return;
    }

    setRouteEstimates(current => {
      const next: Record<string, RouteEstimate> = {};
      selectedRequests.forEach(request => {
        next[request.id] = current[request.id] || {
          status: 'loading',
          origin: request.enderecoRetirada,
          destination: request.enderecoEntrega
        };
      });
      return next;
    });

    selectedRequests.forEach(request => {
      setRouteEstimates(current => ({
        ...current,
        [request.id]: {
          status: 'loading',
          origin: request.enderecoRetirada,
          destination: request.enderecoEntrega
        }
      }));
      fetchRouteEstimate(request, draft.agendamentoAt).then(result => {
        if (cancelled) return;
        setRouteEstimates(current => ({ ...current, [request.id]: result }));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [draft.agendamentoAt, selectedRequests.map(request => `${request.id}:${request.enderecoRetirada}:${request.enderecoEntrega}`).join('|')]);

  const setSort = (column: typeof sortState.column) => {
    setSortState(current => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleAllDisplayed = (checked: boolean) => {
    const displayedIds = filteredRequests.map(request => request.id);
    if (checked) {
      setSelectedIds(Array.from(new Set([...selectedIds, ...displayedIds])));
      return;
    }
    setSelectedIds(selectedIds.filter(id => !displayedIds.includes(id)));
  };

  const updateVehicles = (value: string, checked: boolean) => {
    const veiculo = setMultiSelectValue(draft.veiculo, value, checked);
    const placas = splitSelection(veiculo)
      .map(vehicle => {
        const option = lookups.veiculos.find((item: FreightLookupOption) => item.value === vehicle);
        return String(option?.metadata?.placa || '').trim();
      })
      .filter(Boolean)
      .join(', ');
    setDraft((current: any) => ({ ...current, veiculo, placa: placas }));
  };

  const headerCell = (label: string, column: typeof sortState.column) => (
    <button className="flex w-full items-center gap-1 text-left font-semibold text-slate-700 hover:text-red-700" type="button" onClick={() => setSort(column)}>
      {label}
      <span className="text-[10px] text-slate-400">{sortState.column === column ? (sortState.direction === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  );

  const openCancelPanel = (request?: FreightRequest) => {
    if (request) {
      setSelectedIds([request.id]);
    }
    setCancelReason('');
    setCancelPanelOpen(true);
  };

  const confirmCancel = () => {
    onCancel(selectedRequests, cancelReason);
    setCancelPanelOpen(false);
    setCancelReason('');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Painel de Atendimento de Fretes</h2>
            <p className="text-sm text-slate-500">Filtre, selecione em lote e programe motoristas e veículos para as entregas solicitadas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
              Entregas para programar: {filteredRequests.length}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              SLA agendamento: {slaLimitDays} dia{slaLimitDays === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" type="button" disabled={!selectedIds.length}>
            Agendar Selecionados
          </button>
          <button className={buttonClass('danger')} type="button" onClick={() => openCancelPanel()} disabled={!selectedIds.length || saving}>
            <X className="h-4 w-4" />
            Cancelar solicitação
          </button>
          {selectedIds.length ? <span className="inline-flex h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-700">{selectedIds.length} selecionado(s)</span> : null}
        </div>

        {cancelPanelOpen ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-red-700">Cancelar solicitação</h3>
                <p className="text-sm text-red-700/80">
                  Informe o motivo para registrar no histórico e comunicar a atualização por e-mail.
                </p>
              </div>
              <button className="rounded-full p-1 text-red-700 hover:bg-red-100" type="button" onClick={() => setCancelPanelOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3">
              <Field label="Motivo">
                <textarea className={areaClass()} value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Descreva o motivo do cancelamento..." />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={buttonClass('primary')} type="button" onClick={confirmCancel} disabled={saving || !selectedIds.length || !cancelReason.trim()}>
                Confirmar cancelamento
              </button>
              <button className={buttonClass('secondary')} type="button" onClick={() => setCancelPanelOpen(false)} disabled={saving}>
                Fechar
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr className="border border-slate-200">
                <th className="w-24 border border-slate-200 p-2">{headerCell('SLA', 'sla')}</th>
                <th className="w-10 border border-slate-200 p-2">
                  <input type="checkbox" checked={Boolean(filteredRequests.length && filteredRequests.every(request => selectedIds.includes(request.id)))} onChange={event => toggleAllDisplayed(event.target.checked)} />
                </th>
                <th className="w-20 border border-slate-200 p-2">{headerCell('Nº', 'protocol')}</th>
                <th className="w-36 border border-slate-200 p-2">{headerCell('Setor', 'setor')}</th>
                <th className="w-40 border border-slate-200 p-2">{headerCell('Projeto', 'projeto')}</th>
                <th className="w-36 border border-slate-200 p-2">{headerCell('Registro', 'registro')}</th>
                <th className="w-32 border border-slate-200 p-2">{headerCell('Prazo solicitado', 'prazo')}</th>
                <th className="w-36 border border-slate-200 p-2">{headerCell('Solicitante', 'solicitante')}</th>
                <th className="border border-slate-200 p-2">{headerCell('Item', 'item')}</th>
                <th className="w-28 border border-slate-200 p-2">Fotos</th>
                <th className="border border-slate-200 p-2">{headerCell('Observações', 'observacoes')}</th>
                <th className="w-16 border border-slate-200 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => {
                const slaDays = freightSlaElapsedDays(request);
                const isSlaLate = slaDays > slaLimitDays;
                const productImages = getFreightMedia(request, ['produto']).filter(file => file.isImage);
                return (
                <tr key={request.id} className="border border-slate-200 bg-white hover:bg-slate-50">
                  <td className="border border-slate-200 p-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${isSlaLate ? 'border-red-200 bg-red-100 text-red-700' : 'border-emerald-200 bg-emerald-100 text-emerald-700'}`}>
                      {slaDays} dia{slaDays === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="border border-slate-200 p-2 text-center">
                    <input type="checkbox" checked={selectedIds.includes(request.id)} onChange={() => toggle(request.id)} />
                  </td>
                  <td className="border border-slate-200 p-2 font-bold text-slate-950">{request.protocol}</td>
                  <td className="border border-slate-200 p-2">{request.setor || '-'}</td>
                  <td className="border border-slate-200 p-2">{request.projeto || request.projetoDescricao || '-'}</td>
                  <td className="border border-slate-200 p-2">{formatFreightDate(request.createdAt)}</td>
                  <td className="border border-slate-200 p-2">{formatFreightDate(request.prazoEntrega)}</td>
                  <td className="border border-slate-200 p-2">{request.solicitanteNome || '-'}</td>
                  <td className="border border-slate-200 p-2">{request.itemDescricao || '-'}</td>
                  <td className="border border-slate-200 p-2">
                    {productImages.length ? (
                      <div className="flex items-center gap-1">
                        {productImages.slice(0, 3).map((file, index) => (
                          <button
                            key={`${file.fileUrl}-${index}`}
                            className="h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-slate-50 hover:border-red-300"
                            type="button"
                            onClick={() => setPreviewMedia(file)}
                            title={file.fileName || `Foto ${index + 1}`}
                          >
                            <img src={file.fileUrl} alt={file.fileName || `Foto ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                          </button>
                        ))}
                        {productImages.length > 3 ? (
                          <span className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-bold text-slate-600">
                            +{productImages.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="border border-slate-200 p-2">{request.observacoes || request.observacoesFinais || '-'}</td>
                  <td className="border border-slate-200 p-2">
                    <div className="flex items-center justify-center gap-1">
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-red-600" type="button" onClick={() => onOpen(request)} title="Abrir detalhes">
                      <Eye className="h-4 w-4" />
                      </button>
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 hover:bg-red-100" type="button" onClick={() => openCancelPanel(request)} title="Cancelar solicitação" disabled={saving}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {!filteredRequests.length ? (
                <tr>
                  <td colSpan={12} className="border border-slate-200 bg-white p-8 text-center text-slate-500">Nenhuma solicitação pendente encontrada.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-red-600">Agendar {selectedIds.length} Solicitações em Lote</h2>
        <p className="text-sm text-slate-500">Selecione um ou mais motoristas e veículos para a mesma operação.</p>
        <div className="mt-4 space-y-4">
          <MultiSelectList
            label="Motorista(s)*"
            options={driverOptions}
            selectedValues={selectedDriverValues}
            onChange={(value, checked) => setDraft((current: any) => ({ ...current, motorista: setMultiSelectValue(current.motorista, value, checked) }))}
          />
          <MultiSelectList
            label="Veículo(s)*"
            options={vehicleOptions}
            selectedValues={selectedVehicleValues}
            onChange={updateVehicles}
          />
          <Field label="Data e horário de coleta/entrega*">
            <input className={fieldClass()} type="datetime-local" value={draft.agendamentoAt} onChange={event => setDraft((current: any) => ({ ...current, agendamentoAt: event.target.value }))} />
          </Field>

          <RouteEstimatePanel selectedRequests={selectedRequests} estimates={routeEstimates} />

          <Field label="Observações">
            <textarea className={areaClass()} value={draft.observacoesLogistica} onChange={event => setDraft((current: any) => ({ ...current, observacoesLogistica: event.target.value }))} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass('primary')} type="button" onClick={onApply} disabled={saving || !selectedIds.length}>
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Agendamento'}
            </button>
            <button className={buttonClass('secondary')} type="button" onClick={() => setSelectedIds([])}>
              Cancelar seleção
            </button>
          </div>
        </div>
      </div>
      {previewMedia ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setPreviewMedia(null)}>
          <div className="relative max-h-full max-w-5xl" onClick={event => event.stopPropagation()}>
            <button
              className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm hover:bg-red-50 hover:text-red-600"
              type="button"
              onClick={() => setPreviewMedia(null)}
              aria-label="Fechar foto"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={previewMedia.fileUrl} alt={previewMedia.fileName || 'Foto do solicitante'} className="max-h-[86vh] max-w-full rounded-lg bg-white object-contain shadow-2xl" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MultiSelectList({
  label,
  options,
  selectedValues,
  onChange
}: {
  label: string;
  options: FreightLookupOption[];
  selectedValues: string[];
  onChange: (value: string, checked: boolean) => void;
}) {
  return (
    <div>
      <span className={labelClass()}>{label}</span>
      <div className="max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
        {options.map(option => (
          <label key={option.id || option.value} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${selectedValues.includes(option.value) ? 'bg-slate-200 text-slate-950' : 'hover:bg-slate-50'}`}>
            <input type="checkbox" checked={selectedValues.includes(option.value)} onChange={event => onChange(option.value, event.target.checked)} />
            <span>{option.label || option.value}</span>
          </label>
        ))}
        {!options.length ? <p className="px-2 py-3 text-sm text-slate-500">Nenhuma opção cadastrada na Masterdata Frete.</p> : null}
      </div>
    </div>
  );
}

function RouteEstimatePanel({
  selectedRequests,
  estimates,
  showProtocol = true
}: {
  selectedRequests: FreightRequest[];
  estimates: Record<string, RouteEstimate>;
  showProtocol?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-950">Estimativa de Percurso</h3>
        <span className="rounded-full border border-dashed border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
          {selectedRequests.length ? `${selectedRequests.length} rota(s)` : '—'}
        </span>
      </div>
      {!selectedRequests.length ? (
        <p className="mt-2 text-sm text-slate-500">Selecione uma solicitação para calcular retirada e entrega.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {selectedRequests.map(request => {
            const estimate = estimates[request.id] || { status: 'loading' as const, origin: request.enderecoRetirada, destination: request.enderecoEntrega };
            return (
              <div key={request.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                <div className={`flex flex-wrap items-center gap-2 ${showProtocol ? 'justify-between' : 'justify-end'}`}>
                  {showProtocol ? <span className="font-bold text-slate-950">{formatProtocol(request)}</span> : null}
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {routeProviderLabel(estimate.provider, estimate.status)}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <InfoLine label="Distância" value={estimate.status === 'loading' ? 'calculando...' : estimate.distanceText || '—'} />
                  <InfoLine label="Tempo (trânsito)" value={estimate.status === 'loading' ? 'calculando...' : estimate.trafficText || estimate.durationText || '—'} />
                  <InfoLine label="Retirada" value={estimate.origin || request.enderecoRetirada || '—'} />
                  <InfoLine label="Entrega" value={estimate.destination || request.enderecoEntrega || '—'} />
                </div>
                {estimate.status === 'ERROR' || estimate.status === 'MISSING_FIELDS' ? (
                  <p className="mt-2 text-xs font-medium text-red-700">{estimate.message}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KanbanPanel({
  requests,
  isDriver,
  saving,
  onOpen,
  onStatus,
  onDelivery
}: {
  requests: FreightRequest[];
  isDriver: boolean;
  saving: boolean;
  onOpen: (request: FreightRequest) => void;
  onStatus: (request: FreightRequest, status: FreightStatus, comment?: string) => void;
  onDelivery: (request: FreightRequest) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<string | null>(null);
  const grouped = useMemo(() => {
    return laneOrder.reduce<Record<string, FreightRequest[]>>((acc, lane) => {
      acc[lane] = sortKanbanLane(
        requests.filter(request => freightLane(request.status) === lane),
        lane
      );
      return acc;
    }, {});
  }, [requests]);

  const driverRows = useMemo(() => {
    if (!isDriver) return requests;
    return requests
      .filter(request => isDriverVisibleStatus(request.status))
      .sort((a, b) => {
        const dateA = new Date(a.agendamentoAt || a.createdAt).getTime();
        const dateB = new Date(b.agendamentoAt || b.createdAt).getTime();
        return (Number.isNaN(dateA) ? Number.MAX_SAFE_INTEGER : dateA) - (Number.isNaN(dateB) ? Number.MAX_SAFE_INTEGER : dateB);
      });
  }, [isDriver, requests]);

  const driverGrouped = useMemo(() => {
    if (!isDriver) return {};
    return ['Agendado', 'Em Rota'].reduce<Record<string, FreightRequest[]>>((acc, status) => {
      acc[status] = driverRows.filter(request => request.status === status);
      return acc;
    }, {});
  }, [driverRows, isDriver]);

  if (isDriver) {
    return (
      <div data-freight-driver-panel="true" className="grid min-w-0 max-w-full gap-3 overflow-hidden lg:min-h-[520px] lg:grid-cols-2">
        {(['Em Rota', 'Agendado'] as FreightStatus[]).map(status => {
          const rows = driverGrouped[status] || [];
          const accentClass = status === 'Agendado' ? 'border-yellow-400 bg-yellow-50/60' : 'border-blue-500 bg-blue-50/60';
          const countClass = status === 'Agendado' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800';

          return (
            <section key={status} className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white shadow-sm lg:min-h-[420px] ${accentClass}`}>
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
                <h3 className="font-bold text-slate-950">{status}</h3>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${countClass}`}>{rows.length}</span>
              </div>
              <div className="min-w-0 flex-1 space-y-3 p-3">
                {rows.map(request => {
                  const productMedia = getFreightMedia(request, ['produto']);
                  const deliveryMedia = getFreightMedia(request, ['entrega']);
                  const requesterObservation = String(request.observacoes || request.observacoesFinais || '').trim();

                  return (
                  <div key={request.id} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-lg font-bold text-slate-950">{formatProtocol(request)}</div>
                        <div className="break-words text-sm font-semibold text-slate-700">{request.setor || '-'} · {request.projeto || '-'}</div>
                        <div className="text-sm text-slate-500">Agendamento: {formatFreightDate(request.agendamentoAt)}</div>
                      </div>
                      <div className="shrink-0">
                        {isScheduledFreightLate(request) ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            <Clock3 className="h-3 w-3" />
                            {scheduledFreightDelayLabel(request)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {productMedia.length ? (
                      <div className="mt-4 min-w-0 space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                        <FreightMediaSection title="Foto solicitante" media={productMedia} compact />
                      </div>
                    ) : null}
                    <div className="mt-4 min-w-0 space-y-2 break-words text-sm text-slate-700">
                      <div><strong>Item:</strong> {request.itemDescricao || '-'}</div>
                      {requesterObservation ? (
                        <div><strong>Observação do solicitante:</strong> {compactText(requesterObservation, 120)}</div>
                      ) : null}
                      <div><strong>Retirada:</strong> {request.enderecoRetirada || '-'}</div>
                      <div><strong>Entrega:</strong> {request.enderecoEntrega || '-'}</div>
                    </div>
                    <div className="mt-4 grid min-w-0 gap-2">
                      <a className={buttonClass('secondary')} href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(request.enderecoRetirada || '')}&destination=${encodeURIComponent(request.enderecoEntrega || '')}`} target="_blank" rel="noreferrer">
                        <MapPin className="h-4 w-4" />
                        Abrir rota
                      </a>
                      {request.status === 'Agendado' ? (
                        <button className={buttonClass('dark')} onClick={() => onStatus(request, 'Em Rota')} type="button" disabled={saving}>
                          <Route className="h-4 w-4" />
                          Iniciar rota
                        </button>
                      ) : null}
                      {request.status === 'Em Rota' ? (
                        <button className={buttonClass('primary')} onClick={() => onDelivery(request)} type="button" disabled={saving}>
                          <CheckCircle2 className="h-4 w-4" />
                          Concluir entrega
                        </button>
                      ) : null}
                      <button className={buttonClass('secondary')} onClick={() => onOpen(request)} type="button">
                        <Eye className="h-4 w-4" />
                        Detalhes
                      </button>
                      {deliveryMedia.length ? (
                        <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50 p-3">
                          <FreightMediaSection title="Foto da Entrega (Motorista)" media={deliveryMedia} compact />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
                {!rows.length ? (
                  <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white/70 text-center text-xs font-semibold text-slate-400">
                    Nenhuma entrega neste status
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  async function handleDrop(event: any, lane: string) {
    event.preventDefault();
    setDropLane(null);
    const requestId = event.dataTransfer?.getData('text/plain') || draggingId;
    const request = requests.find(item => item.id === requestId);
    if (!request) return;
    const targetStatus = laneTargetStatus[lane];
    if (!targetStatus || freightLane(request.status) === lane) return;
    await onStatus(request, targetStatus, `Status alterado no Kanban para ${targetStatus}.`);
  }

  return (
    <div className="grid min-h-[560px] gap-3 xl:grid-cols-4">
      {laneOrder.map(lane => (
        <div
          key={lane}
          className={`flex min-h-[520px] flex-col rounded-lg border bg-white shadow-sm transition ${dropLane === lane ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}
          onDragOver={event => {
            event.preventDefault();
            setDropLane(lane);
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropLane(null);
          }}
          onDrop={event => handleDrop(event, lane)}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="font-bold text-slate-950">{laneLabels[lane]}</h3>
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${laneStyles[lane].soft}`}>{grouped[lane]?.length || 0}</span>
          </div>
          <div className={`flex-1 space-y-2 p-2 ${laneStyles[lane].bg}`}>
            {(grouped[lane] || []).map(request => (
              <FreightKanbanCard
                key={request.id}
                request={request}
                lane={lane}
                saving={saving}
                dragging={draggingId === request.id}
                onOpen={onOpen}
                onDragStart={() => setDraggingId(request.id)}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropLane(null);
                }}
              />
            ))}
            {!grouped[lane]?.length ? (
              <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white/70 text-center text-xs font-semibold text-slate-400">
                Arraste um card para cá
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function FreightKanbanCard({
  request,
  lane,
  saving,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd
}: {
  request: FreightRequest;
  lane: string;
  saving: boolean;
  dragging: boolean;
  onOpen: (request: FreightRequest) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const imageMedia = getFreightMedia(request, ['produto', 'entrega']).filter(file => file.isImage);
  const firstImage = imageMedia[0];
  const route = [request.veiculo, request.placa].filter(Boolean).join(' · ');
  const project = request.projeto || request.projetoDescricao || '-';
  const isRequestedCard = lane === 'nao_iniciado' || isRequestedFreightStatus(request.status);
  const isDeliveredCard = lane === 'finalizado';
  const deadlineInfo = freightDeadlineInfo(request);
  const dateLabel = isDeliveredCard ? 'Data de entrega' : isRequestedCard ? 'Prazo' : deadlineInfo.label;
  const delayLabel = kanbanDelayLabel(request, lane);
  let dateValue = deadlineInfo.value;
  if (isRequestedCard) dateValue = request.prazoEntrega || request.prazoDesejado;
  if (isDeliveredCard) dateValue = freightDeliveryDate(request);

  return (
    <article
      draggable={!saving}
      onDragStart={event => {
        event.dataTransfer.setData('text/plain', request.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(request)}
      className={`group flex cursor-grab overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${dragging ? 'opacity-50' : ''}`}
    >
      <div className={`w-1.5 shrink-0 ${laneStyles[lane].border}`} />
      {firstImage ? (
        <div className="relative m-2 mr-0 h-28 w-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
          <img src={firstImage.fileUrl} alt={firstImage.fileName || `Foto ${formatProtocol(request)}`} className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute bottom-1 right-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 shadow-sm">
            <Camera className="mr-1 inline h-3 w-3" />
            {imageMedia.length}
          </div>
        </div>
      ) : null}
      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-950">{formatProtocol(request)}</span>
              <span className="truncate text-[11px] font-semibold uppercase text-slate-500">{request.setor || '-'}</span>
              {request.status === 'Em Rota' ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Em Rota</span> : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">Projeto: {compactText(project, 30)}</p>
            {delayLabel ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                <Clock3 className="h-3 w-3" />
                {delayLabel}
              </span>
            ) : null}
          </div>
          <button
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:text-red-600"
            onClick={event => {
              event.stopPropagation();
              onOpen(request);
            }}
            type="button"
            aria-label={`Abrir detalhes ${formatProtocol(request)}`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-1 space-y-0.5 text-[11px] leading-5 text-slate-600">
          <p>Solicitante: {compactText(request.solicitanteNome || request.createdByEmail, 36)}</p>
          {lane !== 'nao_iniciado' ? (
            <p>Motorista: {compactText(request.motorista || '-', 36)}</p>
          ) : null}
          <p>{dateLabel}: {formatFreightDate(dateValue)}</p>
          {isRequestedCard ? (
            <p>Observação: {compactText(request.observacoes || request.observacoesFinais || '-', 34)}</p>
          ) : (
            <p>Veículo: {compactText(route || '-', 34)}</p>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
            <Package className="h-3 w-3 shrink-0" />
            <span className="truncate">{compactText(firstLine(request.itemDescricao), 30)}</span>
          </span>
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
            <MapPin className="h-3 w-3 shrink-0 text-red-500" />
            <span className="truncate">{compactText(request.enderecoRetirada, 30)}</span>
          </span>
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
            <MapPin className="h-3 w-3 shrink-0 text-pink-500" />
            <span className="truncate">{compactText(request.enderecoEntrega, 30)}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

function InternationalForm({
  form,
  setForm,
  volumes,
  setVolumes,
  items,
  setItems,
  lookups,
  saving,
  volumeFiles,
  itemFiles,
  setVolumeFiles,
  setItemFiles,
  onSubmit
}: {
  form: typeof emptyInternationalForm;
  setForm: (fn: any) => void;
  volumes: FreightVolume[];
  setVolumes: (fn: any) => void;
  items: FreightItem[];
  setItems: (fn: any) => void;
  lookups: any;
  saving: boolean;
  volumeFiles: File[];
  itemFiles: File[];
  setVolumeFiles: (files: File[]) => void;
  setItemFiles: (files: File[]) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const change = (field: keyof typeof emptyInternationalForm, value: string) => setForm((current: any) => ({ ...current, [field]: value }));

  return (
    <form className="rounded-lg border border-slate-200 bg-white shadow-sm" onSubmit={onSubmit}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-950">Solicitação de Frete Internacional</h2>
        <p className="text-sm text-slate-500">Fluxo de importação/exportação com volumes, mercadorias, anexos e requisitos de transporte.</p>
      </div>
      <div className="space-y-6 p-5">
        <FormSection title="1. Tipo de solicitação">
          <div className="grid gap-3 md:grid-cols-3">
            <SegmentedButton value={form.necessidade} options={['Importação', 'Exportação']} onChange={value => change('necessidade', value)} />
            <SegmentedButton value={form.definitivaTemporaria} options={['Definitiva', 'Temporária']} onChange={value => change('definitivaTemporaria', value)} />
            <Field label="Observações">
              <input className={fieldClass()} value={form.observacoesNecessidade} onChange={event => change('observacoesNecessidade', event.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="2. Origem e destino">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900">Origem</h3>
              <Field label="Empresa remetente"><input className={fieldClass()} value={form.empresaRemetente} onChange={event => change('empresaRemetente', event.target.value)} required /></Field>
              <Field label="Endereço completo"><input className={fieldClass()} value={form.enderecoOrigem} onChange={event => change('enderecoOrigem', event.target.value)} required /></Field>
              <Field label="Endereço de coleta se diferente"><input className={fieldClass()} value={form.enderecoColetaOrigem} onChange={event => change('enderecoColetaOrigem', event.target.value)} /></Field>
              <Field label="Contato"><input className={fieldClass()} value={form.nomeContatoOrigem} onChange={event => change('nomeContatoOrigem', event.target.value)} required /></Field>
              <Field label="E-mail"><input className={fieldClass()} type="email" value={form.emailContatoOrigem} onChange={event => change('emailContatoOrigem', event.target.value)} required /></Field>
              <Field label="Telefone"><input className={fieldClass()} value={form.telefoneContatoOrigem} onChange={event => change('telefoneContatoOrigem', event.target.value)} required /></Field>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900">Destino</h3>
              <Field label="Empresa destinatário"><input className={fieldClass()} value={form.empresaDestinatario} onChange={event => change('empresaDestinatario', event.target.value)} required /></Field>
              <Field label="Endereço completo"><input className={fieldClass()} value={form.enderecoDestino} onChange={event => change('enderecoDestino', event.target.value)} required /></Field>
              <Field label="Endereço de entrega se diferente"><input className={fieldClass()} value={form.enderecoEntregaDestino} onChange={event => change('enderecoEntregaDestino', event.target.value)} /></Field>
              <Field label="Contato"><input className={fieldClass()} value={form.nomeContatoDestino} onChange={event => change('nomeContatoDestino', event.target.value)} required /></Field>
              <Field label="E-mail"><input className={fieldClass()} type="email" value={form.emailContatoDestino} onChange={event => change('emailContatoDestino', event.target.value)} required /></Field>
              <Field label="Telefone"><input className={fieldClass()} value={form.telefoneContatoDestino} onChange={event => change('telefoneContatoDestino', event.target.value)} required /></Field>
            </div>
          </div>
        </FormSection>

        <FormSection title="3. Volumes">
          <EditableVolumes volumes={volumes} setVolumes={setVolumes} lookups={lookups} />
          <button className={buttonClass('secondary')} type="button" onClick={() => setVolumes((current: FreightVolume[]) => [...current, newVolume(current.length + 1)])}>
            <Plus className="h-4 w-4" />
            Adicionar volume
          </button>
          <FileDrop label="Anexar planilha de volumes" files={volumeFiles} onFiles={setVolumeFiles} />
        </FormSection>

        <FormSection title="4. Mercadorias">
          <EditableItems items={items} setItems={setItems} />
          <button className={buttonClass('secondary')} type="button" onClick={() => setItems((current: FreightItem[]) => [...current, newItem(current.length + 1)])}>
            <Plus className="h-4 w-4" />
            Adicionar item
          </button>
          <FileDrop label="Anexar planilha de itens" files={itemFiles} onFiles={setItemFiles} />
        </FormSection>

        <FormSection title="5. Requisitos de transporte">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Prazo desejado"><input className={fieldClass()} type="date" value={form.prazoDesejado} onChange={event => change('prazoDesejado', event.target.value)} /></Field>
            <Field label="Tipo de frete">
              <select className={fieldClass()} value={form.tipoFrete} onChange={event => change('tipoFrete', event.target.value)} required>
                <SelectOptionList options={lookups.tiposFrete} />
              </select>
            </Field>
            <Field label="Modalidade">
              <select className={fieldClass()} value={form.modalidadeFrete} onChange={event => change('modalidadeFrete', event.target.value)} required>
                <option value="">Selecione...</option>
                <SelectOptionList options={lookups.modalidades} />
              </select>
            </Field>
            <Field label="Seguro">
              <select className={fieldClass()} value={form.necessitaSeguro} onChange={event => change('necessitaSeguro', event.target.value)}>
                <option>Sim</option>
                <option>Não</option>
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="6. Solicitante e observações finais">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Nome solicitante"><input className={fieldClass()} value={form.solicitanteNome} onChange={event => change('solicitanteNome', event.target.value)} /></Field>
            <Field label="Empresa solicitante"><input className={fieldClass()} value={form.empresaSolicitante} onChange={event => change('empresaSolicitante', event.target.value)} /></Field>
            <Field label="CNPJ"><input className={fieldClass()} value={form.cnpj} onChange={event => change('cnpj', event.target.value)} /></Field>
            <Field label="Telefone"><input className={fieldClass()} value={form.telefoneSolicitante} onChange={event => change('telefoneSolicitante', event.target.value)} /></Field>
            <Field label="E-mail"><input className={fieldClass()} type="email" value={form.emailSolicitante} onChange={event => change('emailSolicitante', event.target.value)} /></Field>
            <Field label="Responsável custos"><input className={fieldClass()} value={form.responsavelCustos} onChange={event => change('responsavelCustos', event.target.value)} /></Field>
            <div className="md:col-span-3">
              <Field label="Observações finais"><textarea className={areaClass()} value={form.observacoesFinais} onChange={event => change('observacoesFinais', event.target.value)} /></Field>
            </div>
          </div>
        </FormSection>
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-4">
        <button className={buttonClass('primary')} type="submit" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Cadastrar solicitação internacional'}
        </button>
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-4 text-base font-bold text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function SegmentedButton({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(option => (
        <button key={option} className={`h-10 rounded-md border text-sm font-semibold ${value === option ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`} onClick={() => onChange(option)} type="button">
          {option}
        </button>
      ))}
    </div>
  );
}

function EditableVolumes({ volumes, setVolumes, lookups }: { volumes: FreightVolume[]; setVolumes: (fn: any) => void; lookups: any }) {
  return (
    <div className="mb-3 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="p-2">Qtd.</th>
            <th className="p-2">Dimensões CxLxA</th>
            <th className="p-2">Peso bruto kg</th>
            <th className="p-2">Embalagem</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {volumes.map((volume, index) => (
            <tr key={index}>
              <td className="p-2"><input className={fieldClass()} type="number" value={volume.quantidade ?? ''} onChange={event => setVolumes((current: FreightVolume[]) => current.map((item, i) => i === index ? { ...item, quantidade: normalizeNumber(event.target.value) } : item))} /></td>
              <td className="p-2"><input className={fieldClass()} value={volume.dimensoes || ''} onChange={event => setVolumes((current: FreightVolume[]) => current.map((item, i) => i === index ? { ...item, dimensoes: event.target.value } : item))} placeholder="120x80x90" /></td>
              <td className="p-2"><input className={fieldClass()} type="number" step="0.01" value={volume.pesoBruto ?? ''} onChange={event => setVolumes((current: FreightVolume[]) => current.map((item, i) => i === index ? { ...item, pesoBruto: normalizeNumber(event.target.value) } : item))} /></td>
              <td className="p-2">
                <select className={fieldClass()} value={volume.tipoEmbalagem || 'Palete'} onChange={event => setVolumes((current: FreightVolume[]) => current.map((item, i) => i === index ? { ...item, tipoEmbalagem: event.target.value } : item))}>
                  <SelectOptionList options={lookups.embalagens} />
                </select>
              </td>
              <td className="p-2">
                <button className={buttonClass('danger')} type="button" onClick={() => setVolumes((current: FreightVolume[]) => current.filter((_, i) => i !== index).map((item, i) => ({ ...item, itemNumero: i + 1 })))}>
                  <X className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableItems({ items, setItems }: { items: FreightItem[]; setItems: (fn: any) => void }) {
  return (
    <div className="mb-3 space-y-3">
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4 xl:grid-cols-9">
          <input className={fieldClass()} type="number" placeholder="Qtd" value={item.quantidade ?? ''} onChange={event => setItems((current: FreightItem[]) => current.map((row, i) => i === index ? { ...row, quantidade: normalizeNumber(event.target.value) } : row))} />
          <input className={`${fieldClass()} md:col-span-3 xl:col-span-2`} placeholder="Descrição" value={item.descricao || ''} onChange={event => setItems((current: FreightItem[]) => current.map((row, i) => i === index ? { ...row, descricao: event.target.value } : row))} />
          <input className={fieldClass()} placeholder="Serial/Part" value={item.serialPartNumber || ''} onChange={event => setItems((current: FreightItem[]) => current.map((row, i) => i === index ? { ...row, serialPartNumber: event.target.value } : row))} />
          <input className={fieldClass()} placeholder="NCM" value={item.ncm || ''} onChange={event => setItems((current: FreightItem[]) => current.map((row, i) => i === index ? { ...row, ncm: event.target.value } : row))} />
          <input className={fieldClass()} placeholder="Fabricante" value={item.fabricante || ''} onChange={event => setItems((current: FreightItem[]) => current.map((row, i) => i === index ? { ...row, fabricante: event.target.value } : row))} />
          <input className={fieldClass()} placeholder="País origem" value={item.paisOrigem || ''} onChange={event => setItems((current: FreightItem[]) => current.map((row, i) => i === index ? { ...row, paisOrigem: event.target.value } : row))} />
          <input className={fieldClass()} type="number" step="0.01" placeholder="Valor" value={item.valorItem ?? ''} onChange={event => setItems((current: FreightItem[]) => current.map((row, i) => i === index ? { ...row, valorItem: normalizeNumber(event.target.value) } : row))} />
          <div className="flex gap-2">
            <input className={fieldClass()} type="number" step="0.01" placeholder="Peso kg" value={item.pesoUnitario ?? ''} onChange={event => setItems((current: FreightItem[]) => current.map((row, i) => i === index ? { ...row, pesoUnitario: normalizeNumber(event.target.value) } : row))} />
            <button className={buttonClass('danger')} type="button" onClick={() => setItems((current: FreightItem[]) => current.filter((_, i) => i !== index).map((row, i) => ({ ...row, itemNumero: i + 1 })))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FileDrop({ label, files, onFiles }: { label: string; files: File[]; onFiles: (files: File[]) => void }) {
  return (
    <label className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm">
      <span className="flex items-center gap-2 font-semibold text-slate-700"><Upload className="h-4 w-4" /> {label}</span>
      <input type="file" accept=".xls,.xlsx,.csv,.pdf,image/*" multiple onChange={event => onFiles(Array.from(event.target.files || []))} />
      <span className="text-xs text-slate-500">{files.length ? `${files.length} arquivo(s) selecionado(s)` : 'Nenhum arquivo selecionado.'}</span>
    </label>
  );
}

function ReportsPanel({ requests, isInternational, onExport }: { requests: FreightRequest[]; isInternational: boolean; onExport: () => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach(request => {
      const key = isInternational ? request.status : request.motorista || 'Sem motorista';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [requests, isInternational]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Relatório operacional</h2>
            <p className="text-sm text-slate-500">Baseado nos filtros atuais.</p>
          </div>
          <button className={buttonClass('primary')} onClick={onExport} type="button">
            <Download className="h-4 w-4" />
            Exportar XLSX
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {grouped.map(([label, total]) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="font-semibold text-slate-800">{label}</span>
              <span className="text-xl font-bold text-slate-950">{total}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-950">Resumo</h3>
        <div className="mt-4 space-y-3 text-sm">
          <InfoLine label="Total" value={String(requests.length)} />
          <InfoLine label="Primeiro registro" value={requests.length ? formatFreightDate(requests[requests.length - 1].createdAt) : '-'} />
          <InfoLine label="Último registro" value={requests.length ? formatFreightDate(requests[0].createdAt) : '-'} />
        </div>
      </div>
    </div>
  );
}

export function FreightNational() {
  return <FreightPage mode="nacional" />;
}

export function FreightDriver() {
  return <FreightPage mode="motorista" />;
}

export function FreightInternational() {
  return <FreightPage mode="internacional" />;
}

export default FreightNational;
