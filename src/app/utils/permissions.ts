// ============================================
// SISTEMA DE PERMISSÕES (RBAC)
// Role-Based Access Control para Porsche Cup
// ============================================

import { projectId, publicAnonKey } from './supabase/info';
import { getAccessToken, createClient } from './supabase/client';
import { MENU_STRUCTURE, MENU_TO_PAGE_MAP, getPagesByCategory, extractNavigablePages, extractAllPages } from './menuStructure';

// 🆕 CACHE EM MEMÓRIA - Evita múltiplas chamadas ao Supabase
let PROFILES_CACHE: AccessProfile[] | null = null;
let PROFILES_CACHE_TIMESTAMP: number = 0;
const CACHE_TTL = 60 * 1000; // 60 segundos

/**
 * Páginas do Sistema
 */
export const PAGES = {
  DASHBOARD: 'dashboard',
  STOCK_ENTRY: 'stock_entry',
  TIRE_MODEL: 'tire_model',
  CONTAINER: 'container',
  REPORTS: 'reports',
  DISCARD_REPORTS: 'discard_reports',
  USER_MANAGEMENT: 'user_management',
  ACCESS_PROFILES: 'access_profiles', // Key separada para Perfis de Acesso
  MASTER_DATA: 'master_data',
  STATUS_REGISTRATION: 'status_registration',
  STOCK_ADJUSTMENT: 'stock_adjustment',
  TIRE_MOVEMENT: 'tire_movement',
  TIRE_STATUS_CHANGE: 'tire_status_change',
  TIRE_DISCARD: 'tire_discard',
  TIRE_CONSUMPTION: 'tire_consumption',
  DATA_IMPORT: 'data_import',
  ARCS_UPDATE: 'arcs_update',
  EM_DESENVOLVIMENTO: 'em_desenvolvimento',
  RAFAEL: 'rafael',
  CAIO: 'caio',
  CADASTROS_CAIO: 'cadastros_caio',
  SEASON_CONFIGURATION: 'season_configuration',
  CONFERENCIA_BAIAS: 'conferencia_baias',
  CONFERIR_PNEUS: 'conferir_pneus',
  HISTORICO_CONFERENCIA: 'historico_conferencia',
  DIVERGENCIAS_CONFERENCIA: 'divergencias_conferencia',
  CONFERENCIA_SERIAL: 'conferencia_serial',
  SHAKEDOWN: 'shakedown',
  DEMANDA: 'demanda',
  PEDIDOS_PNEUS: 'pedidos_pneus',
  RFID_PITLANE: 'rfid_pitlane',
  SOURCING: 'sourcing',
  RODAS: 'rodas',
  RODAS_DASHBOARD: 'rodas_dashboard',
  RODAS_PENDENCIAS: 'rodas_pendencias',
  RODAS_AVARIAS: 'rodas_avarias',
  CONFIGURACOES_NOTIFICACOES: 'configuracoes_notificacoes',
  
  // Categorias de menu (agrupadores)
  JAMYLI: 'jamyli',
  SOLICITACAO_FRETE: 'solicitacao_frete',
  PNEUS: 'pneus',
  CADASTRO: 'cadastro',
  ADMINISTRACAO: 'administracao',
  
  // Links externos
  GESTAO_CARGA: 'gestao_carga',
  MANUTENCAO_PREDIAL: 'manutencao_predial',
  FRETE_SMARTPHONE: 'frete_smartphone',
  FRETE_WEB: 'frete_web',
  FRETE_INTERNACIONAL: 'frete_internacional',
  FRETE_NACIONAL: 'frete_nacional',
  
  // Almoxarifado
  ALMOXARIFADO: 'almoxarifado',
  GASES: 'gases',
  GASES_CADASTRO: 'gases_cadastro',
  GASES_PROGRAMACAO: 'gases_programacao',
  COMBUSTIVEL: 'combustivel',
  SOLICITACAO_COMPRAS: 'solicitacao_compras',
  SOLICITACAO_UNIFORME: 'solicitacao_uniforme',
} as const;

export type PageKey = typeof PAGES[keyof typeof PAGES];

/**
 * Funcionalidades do Sistema
 */
export const FEATURES = {
  // Entrada de Estoque
  STOCK_CREATE: 'stock_create',
  STOCK_EDIT: 'stock_edit',
  STOCK_DELETE: 'stock_delete',
  STOCK_EXPORT: 'stock_export',
  
  // Modelos de Pneu
  MODEL_CREATE: 'model_create',
  MODEL_EDIT: 'model_edit',
  MODEL_DELETE: 'model_delete',
  
  // Contêineres
  CONTAINER_CREATE: 'container_create',
  CONTAINER_EDIT: 'container_edit',
  CONTAINER_DELETE: 'container_delete',
  
  // Relatórios
  REPORTS_VIEW: 'reports_view',
  REPORTS_EXPORT: 'reports_export',
  
  // Usuários
  USER_CREATE: 'user_create',
  USER_EDIT: 'user_edit',
  USER_DELETE: 'user_delete',
  USER_VIEW: 'user_view',
  
  // Master Data
  MASTER_DATA_EDIT: 'master_data_edit',
  
  // Status
  STATUS_CREATE: 'status_create',
  STATUS_EDIT: 'status_edit',
  STATUS_DELETE: 'status_delete',
  
  // Movimentação
  MOVEMENT_CREATE: 'movement_create',
  MOVEMENT_APPROVE: 'movement_approve',
  
  // Descarte
  DISCARD_CREATE: 'discard_create',
  DISCARD_VIEW: 'discard_view',
  
  // Importação
  IMPORT_DATA: 'import_data',
  
  // ARCS
  ARCS_UPDATE: 'arcs_update',
  ARCS_VIEW: 'arcs_view',

  // Controle Pitlane RFID
  RFID_PITLANE_VIEW: 'rfid_pitlane.view',
  RFID_PITLANE_MANAGE: 'rfid_pitlane.manage',
  RFID_PITLANE_VALIDATE: 'rfid_pitlane.validate',
  RFID_PITLANE_CONFIGURE: 'rfid_pitlane.configure',

  // Sourcing Logística e Compras
  SOURCING_VIEW: 'sourcing.view',
  SOURCING_CREATE: 'sourcing.create',
  SOURCING_EDIT: 'sourcing.edit',
  SOURCING_DELETE: 'sourcing.delete',
  SOURCING_INVITE_SUPPLIERS: 'sourcing.invite_suppliers',
  SOURCING_MANAGE_PROPOSALS: 'sourcing.manage_proposals',
  SOURCING_COMPARE: 'sourcing.compare',
  SOURCING_APPROVE: 'sourcing.approve',
  SOURCING_CONFIGURE: 'sourcing.configure',
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

/**
 * Interface do Perfil de Acesso
 */
export interface AccessProfile {
  id: string;
  name: string;
  description: string;
  pages: PageKey[];
  features: FeatureKey[];
  isDefault: boolean;
  isSystem: boolean; // Perfis do sistema não podem ser deletados
  createdAt: string;
  updatedAt: string;
}

/**
 * Perfis Padrão do Sistema
 */
export const DEFAULT_PROFILES: Omit<AccessProfile, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Acesso total ao sistema, incluindo gerenciamento de usuários e configurações',
    isDefault: true,
    isSystem: true,
    pages: Object.values(PAGES),
    features: Object.values(FEATURES),
  },
  {
    id: 'operator',
    name: 'Operador',
    description: 'Acesso às funcionalidades operacionais básicas (entrada, movimentação, consultas)',
    isDefault: true,
    isSystem: true,
    pages: [
      PAGES.DASHBOARD,
      PAGES.STOCK_ENTRY,
      PAGES.TIRE_MODEL,
      PAGES.CONTAINER,
      PAGES.REPORTS,
      PAGES.TIRE_MOVEMENT,
      PAGES.TIRE_STATUS_CHANGE,
      PAGES.RFID_PITLANE,
      PAGES.SOURCING,
      // Links externos
      PAGES.GESTAO_CARGA,
      PAGES.MANUTENCAO_PREDIAL,
      PAGES.FRETE_SMARTPHONE,
      PAGES.FRETE_WEB,
      PAGES.FRETE_NACIONAL,
      PAGES.FRETE_INTERNACIONAL,
    ],
    features: [
      FEATURES.STOCK_CREATE,
      FEATURES.STOCK_EXPORT,
      FEATURES.MODEL_CREATE,
      FEATURES.CONTAINER_CREATE,
      FEATURES.REPORTS_VIEW,
      FEATURES.REPORTS_EXPORT,
      FEATURES.MOVEMENT_CREATE,
      FEATURES.RFID_PITLANE_VIEW,
      FEATURES.RFID_PITLANE_VALIDATE,
      FEATURES.SOURCING_VIEW,
      FEATURES.SOURCING_CREATE,
      FEATURES.SOURCING_MANAGE_PROPOSALS,
      FEATURES.SOURCING_COMPARE,
    ],
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Acesso operacional completo + aprovações e descartes',
    isDefault: false,
    isSystem: true,
    pages: [
      PAGES.DASHBOARD,
      PAGES.STOCK_ENTRY,
      PAGES.TIRE_MODEL,
      PAGES.CONTAINER,
      PAGES.REPORTS,
      PAGES.DISCARD_REPORTS,
      PAGES.STOCK_ADJUSTMENT,
      PAGES.TIRE_MOVEMENT,
      PAGES.TIRE_STATUS_CHANGE,
      PAGES.TIRE_DISCARD,
      PAGES.TIRE_CONSUMPTION,
      PAGES.RFID_PITLANE,
      PAGES.SOURCING,
      // Links externos
      PAGES.GESTAO_CARGA,
      PAGES.MANUTENCAO_PREDIAL,
      PAGES.FRETE_SMARTPHONE,
      PAGES.FRETE_WEB,
      PAGES.FRETE_NACIONAL,
      PAGES.FRETE_INTERNACIONAL,
    ],
    features: [
      FEATURES.STOCK_CREATE,
      FEATURES.STOCK_EDIT,
      FEATURES.STOCK_EXPORT,
      FEATURES.MODEL_CREATE,
      FEATURES.MODEL_EDIT,
      FEATURES.CONTAINER_CREATE,
      FEATURES.CONTAINER_EDIT,
      FEATURES.REPORTS_VIEW,
      FEATURES.REPORTS_EXPORT,
      FEATURES.MOVEMENT_CREATE,
      FEATURES.MOVEMENT_APPROVE,
      FEATURES.DISCARD_CREATE,
      FEATURES.DISCARD_VIEW,
      FEATURES.RFID_PITLANE_VIEW,
      FEATURES.RFID_PITLANE_MANAGE,
      FEATURES.RFID_PITLANE_VALIDATE,
      FEATURES.RFID_PITLANE_CONFIGURE,
      FEATURES.SOURCING_VIEW,
      FEATURES.SOURCING_CREATE,
      FEATURES.SOURCING_EDIT,
      FEATURES.SOURCING_DELETE,
      FEATURES.SOURCING_INVITE_SUPPLIERS,
      FEATURES.SOURCING_MANAGE_PROPOSALS,
      FEATURES.SOURCING_COMPARE,
      FEATURES.SOURCING_APPROVE,
      FEATURES.SOURCING_CONFIGURE,
    ],
  },
  {
    id: 'viewer',
    name: 'Visualizador',
    description: 'Acesso somente leitura (consultas e relatórios)',
    isDefault: false,
    isSystem: true,
    pages: [
      PAGES.DASHBOARD,
      PAGES.REPORTS,
      PAGES.DISCARD_REPORTS,
    ],
    features: [
      FEATURES.REPORTS_VIEW,
      FEATURES.REPORTS_EXPORT,
      FEATURES.DISCARD_VIEW,
    ],
  },
];

/**
 * Labels amigáveis para páginas
 */
export const PAGE_LABELS: Record<PageKey, string> = {
  [PAGES.DASHBOARD]: 'Dashboard',
  [PAGES.STOCK_ENTRY]: 'Entrada de Estoque',
  [PAGES.TIRE_MODEL]: 'Modelos de Pneu',
  [PAGES.CONTAINER]: 'Contêineres',
  [PAGES.REPORTS]: 'Relatórios & Histórico',
  [PAGES.DISCARD_REPORTS]: 'Relatórios de Descarte',
  [PAGES.USER_MANAGEMENT]: 'Gerenciar Usuários',
  [PAGES.ACCESS_PROFILES]: 'Perfis de Acesso', // Label para Perfis de Acesso
  [PAGES.MASTER_DATA]: 'Master Data',
  [PAGES.STATUS_REGISTRATION]: 'Cadastro de Status',
  [PAGES.STOCK_ADJUSTMENT]: 'Ajuste de Estoque',
  [PAGES.TIRE_MOVEMENT]: 'Movimentação de Pneus',
  [PAGES.TIRE_STATUS_CHANGE]: 'Alteração de Status',
  [PAGES.TIRE_DISCARD]: 'Descarte de Pneus',
  [PAGES.TIRE_CONSUMPTION]: 'Consumo de Pneus',
  [PAGES.DATA_IMPORT]: 'Importação de Dados',
  [PAGES.ARCS_UPDATE]: 'Atualização ARCS',
  [PAGES.EM_DESENVOLVIMENTO]: 'Em Desenvolvimento',
  [PAGES.RAFAEL]: 'Rafael',
  [PAGES.CAIO]: 'Caio',
  [PAGES.CADASTROS_CAIO]: 'Cadastros',
  [PAGES.SEASON_CONFIGURATION]: 'Configurar Temporada',
  [PAGES.CONFERENCIA_BAIAS]: 'Conferência de Baias',
  [PAGES.CONFERIR_PNEUS]: 'Conferir Pneus',
  [PAGES.HISTORICO_CONFERENCIA]: 'Histórico de Conferência',
  [PAGES.DIVERGENCIAS_CONFERENCIA]: 'Divergências de Conferência',
  [PAGES.CONFERENCIA_SERIAL]: 'Conferência de Serial',
  [PAGES.SHAKEDOWN]: 'Shakedown',
  [PAGES.DEMANDA]: 'Demanda',
  [PAGES.PEDIDOS_PNEUS]: 'Pedidos de Pneus',
  [PAGES.RFID_PITLANE]: 'Controle Pitlane RFID',
  [PAGES.SOURCING]: 'Sourcing Logística e Compras',
  [PAGES.RODAS]: 'Rodas',
  [PAGES.RODAS_DASHBOARD]: 'Dashboard',
  [PAGES.RODAS_PENDENCIAS]: 'Pendências',
  [PAGES.RODAS_AVARIAS]: 'Avarias',
  [PAGES.CONFIGURACOES_NOTIFICACOES]: 'Configurações de Notificações',
  
  // Categorias de menu (agrupadores)
  [PAGES.JAMYLI]: 'Jamyli',
  [PAGES.SOLICITACAO_FRETE]: 'Solicitação de Frete',
  [PAGES.PNEUS]: 'Pneus',
  [PAGES.CADASTRO]: 'Cadastro',
  [PAGES.ADMINISTRACAO]: 'Administração',
  
  // Links externos
  [PAGES.GESTAO_CARGA]: 'Gestão de Carga',
  [PAGES.MANUTENCAO_PREDIAL]: 'Manutenção Predial',
  [PAGES.FRETE_SMARTPHONE]: 'Frete Smartphone',
  [PAGES.FRETE_WEB]: 'Frete Web',
  [PAGES.FRETE_INTERNACIONAL]: 'Frete Internacional',
  [PAGES.FRETE_NACIONAL]: 'Frete Nacional',
  
  // Almoxarifado
  [PAGES.ALMOXARIFADO]: 'Almoxarifado',
  [PAGES.GASES]: 'Gases',
  [PAGES.GASES_CADASTRO]: 'Gases - Cadastro',
  [PAGES.GASES_PROGRAMACAO]: 'Gases - Programação',
  [PAGES.COMBUSTIVEL]: 'Combustível',
  [PAGES.SOLICITACAO_COMPRAS]: 'Solicitação de Compras',
  [PAGES.SOLICITACAO_UNIFORME]: 'Solicitação de Uniforme',
};

/**
 * Labels amigáveis para funcionalidades
 */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  [FEATURES.STOCK_CREATE]: 'Criar Entrada',
  [FEATURES.STOCK_EDIT]: 'Editar Entrada',
  [FEATURES.STOCK_DELETE]: 'Excluir Entrada',
  [FEATURES.STOCK_EXPORT]: 'Exportar Dados',
  
  [FEATURES.MODEL_CREATE]: 'Criar Modelo',
  [FEATURES.MODEL_EDIT]: 'Editar Modelo',
  [FEATURES.MODEL_DELETE]: 'Excluir Modelo',
  
  [FEATURES.CONTAINER_CREATE]: 'Criar Contêiner',
  [FEATURES.CONTAINER_EDIT]: 'Editar Contêiner',
  [FEATURES.CONTAINER_DELETE]: 'Excluir Contêiner',
  
  [FEATURES.REPORTS_VIEW]: 'Visualizar Relatórios',
  [FEATURES.REPORTS_EXPORT]: 'Exportar Relatórios',
  
  [FEATURES.USER_CREATE]: 'Criar Usuário',
  [FEATURES.USER_EDIT]: 'Editar Usuário',
  [FEATURES.USER_DELETE]: 'Excluir Usuário',
  [FEATURES.USER_VIEW]: 'Visualizar Usuários',
  
  [FEATURES.MASTER_DATA_EDIT]: 'Editar Master Data',
  
  [FEATURES.STATUS_CREATE]: 'Criar Status',
  [FEATURES.STATUS_EDIT]: 'Editar Status',
  [FEATURES.STATUS_DELETE]: 'Excluir Status',
  
  [FEATURES.MOVEMENT_CREATE]: 'Criar Movimentação',
  [FEATURES.MOVEMENT_APPROVE]: 'Aprovar Movimentação',
  
  [FEATURES.DISCARD_CREATE]: 'Criar Descarte',
  [FEATURES.DISCARD_VIEW]: 'Visualizar Descartes',
  
  [FEATURES.IMPORT_DATA]: 'Importar Dados',
  
  [FEATURES.ARCS_UPDATE]: 'Atualizar ARCS',
  [FEATURES.ARCS_VIEW]: 'Visualizar ARCS',

  [FEATURES.RFID_PITLANE_VIEW]: 'Pitlane RFID - Visualizar',
  [FEATURES.RFID_PITLANE_MANAGE]: 'Pitlane RFID - Gerenciar',
  [FEATURES.RFID_PITLANE_VALIDATE]: 'Pitlane RFID - Validar',
  [FEATURES.RFID_PITLANE_CONFIGURE]: 'Pitlane RFID - Configurar',

  [FEATURES.SOURCING_VIEW]: 'Sourcing - Visualizar',
  [FEATURES.SOURCING_CREATE]: 'Sourcing - Criar evento',
  [FEATURES.SOURCING_EDIT]: 'Sourcing - Editar',
  [FEATURES.SOURCING_DELETE]: 'Sourcing - Excluir/cancelar',
  [FEATURES.SOURCING_INVITE_SUPPLIERS]: 'Sourcing - Convidar fornecedores',
  [FEATURES.SOURCING_MANAGE_PROPOSALS]: 'Sourcing - Gerenciar propostas',
  [FEATURES.SOURCING_COMPARE]: 'Sourcing - Comparar propostas',
  [FEATURES.SOURCING_APPROVE]: 'Sourcing - Aprovar',
  [FEATURES.SOURCING_CONFIGURE]: 'Sourcing - Configurar',
};

/**
 * Agrupa páginas por categoria
 * 
 * IMPORTANTE: Este mapeamento é gerado dinamicamente em runtime
 * a partir da estrutura do menu (utils/menuStructure.ts).
 * 
 * Para adicionar novas páginas:
 * 1. Adicione no menuStructure.ts
 * 2. Adicione a constante em PAGES acima
 * 3. Adicione no MENU_TO_PAGE_MAP em menuStructure.ts
 * 4. As categorias serão geradas automaticamente
 */
export const PAGE_CATEGORIES = {
  'Operacional': [
    PAGES.DASHBOARD,
    PAGES.STOCK_ENTRY,
    PAGES.TIRE_MODEL,
    PAGES.CONTAINER,
  ],
  'Movimentação': [
    PAGES.STOCK_ADJUSTMENT,
    PAGES.TIRE_MOVEMENT,
    PAGES.TIRE_STATUS_CHANGE,
    PAGES.TIRE_DISCARD,
    PAGES.TIRE_CONSUMPTION,
  ],
  'Pneus - Demanda': [
    PAGES.DEMANDA,
    PAGES.PEDIDOS_PNEUS,
    PAGES.RFID_PITLANE,
    PAGES.SOURCING,
  ],
  'Relatórios': [
    PAGES.REPORTS,
    PAGES.DISCARD_REPORTS,
  ],
  'Administração': [
    PAGES.USER_MANAGEMENT,
    PAGES.ACCESS_PROFILES, // Adicionado para Perfis de Acesso
    PAGES.MASTER_DATA,
    PAGES.STATUS_REGISTRATION,
  ],
  'Integração': [
    PAGES.DATA_IMPORT,
    PAGES.ARCS_UPDATE,
  ],
};

/**
 * Agrupa funcionalidades por categoria
 */
export const FEATURE_CATEGORIES = {
  'Entrada de Estoque': [
    FEATURES.STOCK_CREATE,
    FEATURES.STOCK_EDIT,
    FEATURES.STOCK_DELETE,
    FEATURES.STOCK_EXPORT,
  ],
  'Modelos de Pneu': [
    FEATURES.MODEL_CREATE,
    FEATURES.MODEL_EDIT,
    FEATURES.MODEL_DELETE,
  ],
  'Contêineres': [
    FEATURES.CONTAINER_CREATE,
    FEATURES.CONTAINER_EDIT,
    FEATURES.CONTAINER_DELETE,
  ],
  'Relatórios': [
    FEATURES.REPORTS_VIEW,
    FEATURES.REPORTS_EXPORT,
  ],
  'Usuários': [
    FEATURES.USER_CREATE,
    FEATURES.USER_EDIT,
    FEATURES.USER_DELETE,
    FEATURES.USER_VIEW,
  ],
  'Configurações': [
    FEATURES.MASTER_DATA_EDIT,
    FEATURES.STATUS_CREATE,
    FEATURES.STATUS_EDIT,
    FEATURES.STATUS_DELETE,
  ],
  'Movimentação': [
    FEATURES.MOVEMENT_CREATE,
    FEATURES.MOVEMENT_APPROVE,
  ],
  'Descarte': [
    FEATURES.DISCARD_CREATE,
    FEATURES.DISCARD_VIEW,
  ],
  'Integração': [
    FEATURES.IMPORT_DATA,
    FEATURES.ARCS_UPDATE,
    FEATURES.ARCS_VIEW,
    FEATURES.RFID_PITLANE_VIEW,
    FEATURES.RFID_PITLANE_MANAGE,
    FEATURES.RFID_PITLANE_VALIDATE,
    FEATURES.RFID_PITLANE_CONFIGURE,
  ],
  'Sourcing': [
    FEATURES.SOURCING_VIEW,
    FEATURES.SOURCING_CREATE,
    FEATURES.SOURCING_EDIT,
    FEATURES.SOURCING_DELETE,
    FEATURES.SOURCING_INVITE_SUPPLIERS,
    FEATURES.SOURCING_MANAGE_PROPOSALS,
    FEATURES.SOURCING_COMPARE,
    FEATURES.SOURCING_APPROVE,
    FEATURES.SOURCING_CONFIGURE,
  ],
};

/**
 * Gera PAGE_CATEGORIES dinamicamente a partir da estrutura do menu
 * 
 * Esta função extrai automaticamente as páginas organizadas por
 * categoria baseando-se na hierarquia do menu.
 */
export function generatePageCategoriesFromMenu(): Record<string, PageKey[]> {
  const categories: Record<string, PageKey[]> = {};
  
  // Extrai páginas agrupadas por categoria do menu
  const pagesByCategory = getPagesByCategory();
  
  console.log('🔍 DEBUG: Pages by category from menu:', pagesByCategory);
  
  for (const [categoryLabel, menuItems] of Object.entries(pagesByCategory)) {
    const pageKeys: PageKey[] = [];
    
    for (const item of menuItems) {
      // Mapeia ID do menu para PageKey
      const pageKey = MENU_TO_PAGE_MAP[item.id];
      
      console.log(`🔍 DEBUG: Checking menu item "${item.id}" (${item.label})`);
      console.log(`   - Mapped to: ${pageKey}`);
      console.log(`   - Exists in PAGES: ${pageKey && PAGES[pageKey as keyof typeof PAGES]}`);
      
      if (pageKey && PAGES[pageKey as keyof typeof PAGES]) {
        pageKeys.push(PAGES[pageKey as keyof typeof PAGES] as PageKey);
        console.log(`   ✅ ADDED to category "${categoryLabel}"`);
      } else {
        console.warn(`   ❌ SKIPPED - Not found in PAGES!`);
      }
    }
    
    // Só adiciona categoria se tiver páginas
    if (pageKeys.length > 0) {
      categories[categoryLabel] = pageKeys;
    }
  }
  
  console.log('🔍 DEBUG: Final categories:', categories);
  
  return categories;
}

/**
 * Gera labels de páginas dinamicamente a partir da estrutura do menu
 */
export function generatePageLabelsFromMenu(): Record<PageKey, string> {
  const labels: Record<string, string> = { ...PAGE_LABELS };
  
  const navigablePages = extractNavigablePages();
  
  for (const page of navigablePages) {
    const pageKey = MENU_TO_PAGE_MAP[page.id];
    if (pageKey && PAGES[pageKey as keyof typeof PAGES]) {
      labels[PAGES[pageKey as keyof typeof PAGES]] = page.label;
    }
  }
  
  return labels as Record<PageKey, string>;
}

/**
 * 🔧 AUTO-HEALING: Detecta páginas faltantes e sugere correções
 * Esta função diagnostica problemas de sincronização entre:
 * - menuStructure.ts (estrutura do menu)
 * - permissions.ts (constantes PAGES e PAGE_LABELS)
 * - MENU_TO_PAGE_MAP (mapeamento menu -> permissões)
 */
export function diagnoseMissingPages(): {
  success: boolean;
  missing: string[];
  suggestions: string[];
} {
  console.log('\n🔍 ===== DIAGNÓSTICO DE PÁGINAS =====\n');
  
  const missing: string[] = [];
  const suggestions: string[] = [];
  
  // 1. Extrai TODAS as páginas do menu (incluindo categorias com subItems)
  const allPages = extractAllPages();
  console.log(`📋 Total de itens no menu: ${allPages.length}`);
  
  // 2. Verifica cada página do menu
  for (const menuItem of allPages) {
    const pageKey = MENU_TO_PAGE_MAP[menuItem.id];
    
    // Verifica se tem mapeamento
    if (!pageKey) {
      missing.push(menuItem.id);
      suggestions.push(
        `❌ Menu "${menuItem.label}" (id: ${menuItem.id}) não tem mapeamento em MENU_TO_PAGE_MAP`
      );
      console.warn(`⚠️  "${menuItem.label}" (${menuItem.id}) - SEM MAPEAMENTO`);
      continue;
    }
    
    // Verifica se a constante existe em PAGES
    const pageConstant = PAGES[pageKey as keyof typeof PAGES];
    if (!pageConstant) {
      missing.push(menuItem.id);
      suggestions.push(
        `❌ Mapeamento "${pageKey}" (do menu "${menuItem.label}") não existe em PAGES`
      );
      console.warn(`⚠️  "${menuItem.label}" (${menuItem.id}) - PAGES.${pageKey} NÃO EXISTE`);
      continue;
    }
    
    // Verifica se tem label
    const label = PAGE_LABELS[pageConstant as PageKey];
    if (!label) {
      missing.push(menuItem.id);
      suggestions.push(
        `❌ Página "${pageConstant}" (menu "${menuItem.label}") não tem label em PAGE_LABELS`
      );
      console.warn(`⚠️  "${menuItem.label}" (${menuItem.id}) - SEM LABEL`);
      continue;
    }
    
    console.log(`✅ ${menuItem.label}: mapeado → ${pageKey} → ${pageConstant} → "${label}"`);
  }
  
  // 3. Resultado
  console.log(`\n📊 Resultado: ${allPages.length - missing.length}/${allPages.length} páginas OK`);
  
  if (missing.length > 0) {
    console.error(`\n⚠️  ${missing.length} problema(s) encontrado(s):\n`);
    suggestions.forEach(s => console.error(s));
    console.error('\n💡 SOLUÇÃO: Adicione os mapeamentos faltantes em menuStructure.ts e permissions.ts\n');
  } else {
    console.log('\n✅ Todas as páginas estão corretamente mapeadas!\n');
  }
  
  console.log('🔍 ===== FIM DO DIAGNÓSTICO =====\n');
  
  return {
    success: missing.length === 0,
    missing,
    suggestions
  };
}

/**
 * Retorna categorias de páginas dinmicas (usadas no AccessProfileManagement)
 * 
 * Prioriza categorias geradas do menu, mas mantém fallback
 * para o mapeamento manual se necessário.
 */
export function getDynamicPageCategories(): Record<string, PageKey[]> {
  try {
    const dynamic = generatePageCategoriesFromMenu();
    
    // Se gerou categorias válidas, usa elas
    if (Object.keys(dynamic).length > 0) {
      console.log('✅ Usando categorias dinâmicas do menu:', Object.keys(dynamic));
      return dynamic;
    }
  } catch (error) {
    console.warn('⚠️  Erro ao gerar categorias dinâmicas, usando fallback:', error);
  }
  
  // Fallback para categorias manuais
  return PAGE_CATEGORIES;
}

/**
 * Verifica se um perfil tem acesso a uma página
 */
export function hasPageAccess(profile: AccessProfile, page: PageKey): boolean {
  if (isAdministratorProfile(profile)) return true;
  if (profile.pages.includes(page)) return true;

  const legacyPageAliases: Partial<Record<PageKey, PageKey[]>> = {
    [PAGES.FRETE_NACIONAL]: [PAGES.FRETE_WEB, PAGES.FRETE_SMARTPHONE],
    [PAGES.FRETE_WEB]: [PAGES.FRETE_NACIONAL, PAGES.FRETE_SMARTPHONE],
    [PAGES.FRETE_SMARTPHONE]: [PAGES.FRETE_NACIONAL, PAGES.FRETE_WEB],
  };

  return (legacyPageAliases[page] || []).some(alias => profile.pages.includes(alias));
}

/**
 * Verifica se um perfil tem acesso a uma funcionalidade
 */
export function hasFeatureAccess(profile: AccessProfile, feature: FeatureKey): boolean {
  if (isAdministratorProfile(profile)) return true;
  return profile.features.includes(feature);
}

/**
 * Perfis administrativos devem ter acesso total mesmo quando a lista de páginas
 * persistida no Supabase/localStorage ainda não recebeu uma página recém-criada.
 */
export function isAdministratorProfile(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;

  const normalizedId = String(profile.id || '').trim().toLowerCase();
  const normalizedName = String(profile.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  return normalizedId === 'admin' || normalizedName === 'administrador' || normalizedName === 'admin';
}

/**
 * Inicializa perfis padrão no localStorage se não existirem
 * NOTA: Esta é apenas uma inicialização local de fallback.
 * Os perfis oficiais devem estar no Supabase (tabela access_profiles).
 */
function initializeDefaultProfiles(): void {
  try {
    const profilesStr = localStorage.getItem('porsche-cup-profiles');
    if (!profilesStr) {
      const defaultProfiles: AccessProfile[] = DEFAULT_PROFILES.map(p => ({
        ...p,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      localStorage.setItem('porsche-cup-profiles', JSON.stringify(defaultProfiles));
      console.log('ℹ️ Perfis padrão inicializados no localStorage (cache)');
      console.log('💡 Execute MIGRATION_ACCESS_PROFILES_TABLE.sql para salvar no Supabase');
    }
  } catch (error) {
    console.error('Erro ao inicializar perfis padrão:', error);
  }
}

/**
 * Carrega perfis do Supabase (SEM CACHE)
 */
export async function loadProfilesFromSupabase(): Promise<AccessProfile[]> {
  try {
    console.log('🔐 Carregando perfis do Supabase via singleton client...');
    
    // Usa o singleton do Supabase client
    const supabase = createClient();
    
    // Verifica se há sessão ativa antes de fazer a requisição
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('⚠️ Nenhuma sessão ativa - pulando busca de perfis');
      return [];
    }
    
    // Busca diretamente da tabela access_profiles
    const { data, error } = await supabase
      .from('access_profiles')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      // Se o erro for de autenticação, retorna vazio ao invés de falhar
      if (error.message.includes('JWT') || error.message.includes('auth')) {
        console.warn('⚠️ Erro de autenticação ao buscar perfis - usuário não autenticado');
        return [];
      }
      console.error('❌ Erro ao buscar perfis do Supabase:', error);
      throw new Error(error.message);
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Nenhum perfil encontrado no Supabase');
      return [];
    }
    
    // Mapeia para o formato AccessProfile
    const profiles: AccessProfile[] = data.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      pages: Array.isArray(row.pages) ? row.pages : [],
      features: Array.isArray(row.features) ? row.features : [],
      isDefault: row.is_default || false,
      isSystem: row.is_system || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    console.log(`✅ ${profiles.length} perfis carregados do Supabase`);
    return profiles;
    
  } catch (error) {
    // Se o erro for de rede (Failed to fetch), trata graciosamente
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('⚠️ Erro de conexão - pulando busca de perfis');
      return [];
    }
    console.error('❌ Erro ao carregar perfis do Supabase:', error);
    throw error;
  }
}

/**
 * Recarrega o perfil do usuário atual do Supabase (força atualização do cache)
 */
export async function reloadCurrentUserProfile(): Promise<AccessProfile | null> {
  try {
    const userStr = localStorage.getItem('porsche-cup-user');
    if (!userStr) {
      console.warn('⚠️ Nenhum usuário logado para recarregar');
      return null;
    }
    
    const user = JSON.parse(userStr);
    console.log('🔄 Recarregando perfil do Supabase...');
    
    // Força recarregar do Supabase (não usa cache)
    const profiles = await loadProfilesFromSupabase();
    
    let profileId = user.profileId || user.role;
    let profile = profiles.find(p => p.id === profileId);
    
    if (!profile) {
      console.warn(`⚠️ Perfil "${profileId}" não encontrado, usando fallback`);
      profile = profiles.find(p => p.id === 'operator');
    }
    
    if (profile) {
      console.log('✅ Perfil recarregado:', profile.name);
      console.log('📋 Páginas permitidas:', profile.pages);
      
      // Atualiza localStorage com o perfil correto
      const updatedUser = { ...user, profileId: profile.id };
      localStorage.setItem('porsche-cup-user', JSON.stringify(updatedUser));
      
      return profile;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao recarregar perfil:', error);
    return null;
  }
}

/**
 * Obtém perfil do usuário atual (ASYNC - busca do Supabase)
 */
export async function getCurrentUserProfileAsync(): Promise<AccessProfile | null> {
  try {
    const userStr = localStorage.getItem('porsche-cup-user');
    if (!userStr) {
      console.warn('⚠️ Nenhum usuário logado');
      return null;
    }
    
    const user = JSON.parse(userStr);
    let profileId = user.profileId || user.role; // Compatibilidade com role antiga
    
    if (!profileId) {
      console.warn('⚠️ Usuário sem profileId ou role definido');
      return null;
    }
    
    console.log(`🔍 Buscando perfil: ${profileId}`);
    
    // Carrega perfis do Supabase (ou cache)
    const profiles = await loadProfilesFromSupabase();
    
    // Se não conseguiu carregar perfis (offline ou erro), usa fallback local
    if (!profiles || profiles.length === 0) {
      console.warn('⚠️ Nenhum perfil carregado do Supabase - usando perfil padrão local');
      
      // Busca perfil padrão localmente
      const defaultProfile = DEFAULT_PROFILES.find(p => p.id === profileId);
      if (defaultProfile) {
        return {
          ...defaultProfile,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      
      // Fallback final para 'operator'
      const operatorProfile = DEFAULT_PROFILES.find(p => p.id === 'operator');
      if (operatorProfile) {
        return {
          ...operatorProfile,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      
      return null;
    }
    
    // Busca perfil específico
    let profile = profiles.find(p => p.id === profileId);
    
    if (profile) {
      console.log(`✅ Perfil encontrado: ${profile.name} (${profile.id})`);
      console.log(`📋 Páginas permitidas:`, profile.pages);
      console.log(`⚙️ Funcionalidades permitidas:`, profile.features);
      return profile;
    }
    
    // FALLBACK: Se perfil não existe, tenta usar perfil padrão baseado na role
    console.warn(`⚠️ Perfil "${profileId}" não encontrado`);
    console.warn(`📋 Perfis disponíveis:`, profiles.map(p => ({ id: p.id, name: p.name })));
    
    // Se profileId parece ser um ID customizado (profile-xxxxx), tenta usar 'admin' ou 'operator'
    if (profileId.startsWith('profile-')) {
      console.warn(`💡 Perfil customizado "${profileId}" não existe no Supabase`);
      console.warn(`🔄 Tentando fallback para perfil "operator"...`);
      
      profile = profiles.find(p => p.id === 'operator');
      if (profile) {
        console.log(`✅ Usando perfil "operator" como fallback`);
        
        // Atualiza usuário para usar operator
        try {
          const updatedUser = { ...user, profileId: 'operator' };
          localStorage.setItem('porsche-cup-user', JSON.stringify(updatedUser));
          console.log(`💾 ProfileId atualizado para "operator" localmente`);
          console.warn(`⚠️ IMPORTANTE: Atualize o usuário no Supabase para usar um perfil válido!`);
        } catch (err) {
          console.error('Erro ao atualizar usuário localmente:', err);
        }
        
        return profile;
      }
    }
    
    console.warn(`⚠️ Nenhum perfil encontrado e fallback falhou`);
    console.warn(`💡 DICA: Configure um perfil válido no Supabase para o usuário ${user.email}`);
    
    return null;
  } catch (error) {
    // Trata erros de forma silenciosa
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('⚠️ Erro de conexão ao buscar perfil - usando perfil padrão local');
    } else {
      console.warn('⚠️ Erro ao obter perfil do usuário:', error);
    }
    return null;
  }
}

/**
 * Obtém perfil do usuário atual do localStorage (SYNC - apenas cache)
 * DEPRECATED: Use getCurrentUserProfileAsync() para buscar do Supabase
 */
export function getCurrentUserProfile(): AccessProfile | null {
  try {
    // Garante que perfis padrão estejam inicializados
    initializeDefaultProfiles();
    
    const userStr = localStorage.getItem('porsche-cup-user');
    if (!userStr) return null;
    
    const user = JSON.parse(userStr);
    const profileId = user.profileId || user.role; // Compatibilidade com role antiga
    
    if (!profileId) {
      console.warn('⚠️ Usuário sem profileId ou role definido');
      return null;
    }
    
    // Busca perfil salvo no localStorage (CACHE)
    const profilesStr = localStorage.getItem('porsche-cup-profiles');
    if (profilesStr) {
      const profiles: AccessProfile[] = JSON.parse(profilesStr);
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        console.log(`✅ Perfil encontrado (cache): ${profile.name} (${profile.id})`);
        return profile;
      }
    }
    
    // Fallback para perfis padrão (caso o localStorage esteja vazio)
    const defaultProfile = DEFAULT_PROFILES.find(p => p.id === profileId);
    if (defaultProfile) {
      console.log(`ℹ️ Usando perfil padrão: ${defaultProfile.name} (${defaultProfile.id})`);
      return {
        ...defaultProfile,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    
    console.warn(`⚠️ Perfil não encontrado para profileId/role: ${profileId}`);
    return null;
  } catch (error) {
    console.error('Erro ao obter perfil do usuário:', error);
    return null;
  }
}

/**
 * Verifica se usuário atual tem acesso a uma página
 */
export function canAccessPage(page: PageKey): boolean {
  const profile = getCurrentUserProfile();
  if (!profile) return false;
  return hasPageAccess(profile, page);
}

/**
 * Verifica se usuário atual tem acesso a uma funcionalidade
 */
export function canAccessFeature(feature: FeatureKey): boolean {
  const profile = getCurrentUserProfile();
  if (!profile) return false;
  return hasFeatureAccess(profile, feature);
}

/**
 * Verifica se usuário atual é admin
 */
export function isAdmin(): boolean {
  const profile = getCurrentUserProfile();
  return isAdministratorProfile(profile);
}
