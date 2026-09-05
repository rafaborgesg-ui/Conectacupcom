/**
 * Sistema de Estrutura de Menu Dinâmica
 * 
 * Este arquivo define a estrutura do menu de forma centralizada.
 * Qualquer alteração aqui será refletida automaticamente em:
 * - Sidebar (navegação)
 * - Perfis de Acesso (páginas disponíveis)
 * - Sistema de Permissões (controle de acesso)
 * 
 * ÚLTIMA ATUALIZAÇÃO: Adicionado submenu Jamyli (v2.6.0 - 04/12/2024)
 */

import { 
  LayoutDashboard, 
  Package, 
  CircleDot, 
  Box, 
  BarChart3, 
  ArrowRightLeft, 
  Trash2, 
  FileText, 
  UserCircle, 
  Settings, 
  Database, 
  Shield,
  Truck,
  Globe,
  MapPin,
  Code,
  ClipboardList,
  Wrench,
  User,
  Warehouse,
  Fuel,
  Wind,
  ShoppingCart,
  Shirt,
  Calendar,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  Bell,
  RadioTower,
  Handshake
} from 'lucide-react';

// 🔥 LOG DE DEBUG PARA FORÇAR REBUILD
console.log('🔥 menuStructure.ts CARREGADO - Versão com Notificações (v2.9.0 - 10/02/2026)');

export interface MenuItem {
  id: string;
  label: string;
  icon?: any;
  isMain?: boolean;
  adminOnly?: boolean;
  externalUrl?: string;
  subItems?: MenuItem[];
  description?: string; // Para usar no AccessProfileManagement
}

/**
 * ESTRUTURA CENTRAL DO MENU
 * 
 * Esta é a fonte única de verdade para toda a estrutura de navegação.
 * Qualquer mudança aqui será refletida automaticamente em todo o sistema.
 */
export const MENU_STRUCTURE: MenuItem[] = [
  {
    id: 'gestao-carga',
    label: 'Gestão de Carga',
    icon: ClipboardList,
    isMain: true,
    externalUrl: 'https://script.google.com/a/porschegt3cup.com.br/macros/s/AKfycbzs06M_vQcA34boc3ciyd9LzUzsYN3aNIXGZd-SfCsygtWAv07sc8K3ngt2UE0-cr9C/exec',
    description: 'Sistema de gestão de carga externa'
  },
  {
    id: 'manutencao-predial',
    label: 'Manutenção predial',
    icon: Wrench,
    isMain: true,
    externalUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSeex768DJud924I02ZGm70r3SdY9sCRd_83bgjBNKAwZpgFnA/viewform?usp=dialog',
    description: 'Formulário de solicitação de manutenção predial'
  },
  {
    id: 'solicitacao-frete',
    label: 'Solicitação de frete',
    icon: Truck,
    isMain: true,
    description: 'Sistema de solicitação de frete',
    subItems: [
      {
        id: 'frete-nacional',
        label: 'Nacional',
        icon: MapPin,
        description: 'Solicitação, atendimento e motorista em página única responsiva'
      },
      { 
        id: 'frete-internacional', 
        label: 'Internacional', 
        icon: Globe, 
        description: 'Fluxo interno de frete internacional'
      },
      {
        id: 'frete-masterdata',
        label: 'Masterdata Frete',
        icon: Database,
        adminOnly: true,
        description: 'Cadastros dinâmicos do módulo de frete'
      },
    ]
  },
  {
    id: 'pneus',
    label: 'Pneus',
    icon: Package,
    isMain: true,
    description: 'Gestão de pneus',
    subItems: [
      {
        id: 'demanda',
        label: 'Demanda',
        icon: ClipboardList,
        description: 'Sistema de gestão de demandas'
      },
      {
        id: 'pedidos-pneus',
        label: 'Pedidos de Pneus',
        icon: ShoppingCart,
        description: 'Sistema de pedidos de pneus'
      },
      {
        id: 'rfid-pitlane',
        label: 'Controle Pitlane RFID',
        icon: RadioTower,
        description: 'Leitura automática de pneus RFID na entrada do pitlane'
      },
      {
        id: 'tire-stock',
        label: 'Entrada de Estoque',
        icon: Package,
        description: 'Registro de entrada de pneus no estoque'
      },
      {
        id: 'conferencia-baias',
        label: 'Conferência de Baias',
        icon: ClipboardCheck,
        description: 'Sistema de conferência de baias',
        subItems: [
          {
            id: 'conferir-pneus',
            label: 'Conferir Pneus',
            icon: ClipboardCheck,
            description: 'Conferência de pneus nas baias'
          },
          {
            id: 'historico-conferencia',
            label: 'Histórico',
            icon: FileText,
            description: 'Histórico de conferências'
          },
          {
            id: 'divergencias-conferencia',
            label: 'Divergências',
            icon: AlertTriangle,
            description: 'Divergências encontradas'
          },
          {
            id: 'conferencia-serial',
            label: 'Conferência de Serial',
            icon: ClipboardCheck,
            description: 'Conferência de serial de pneus'
          }
        ]
      },
      {
        id: 'arcs-data-update',
        label: 'Atualizar Base ARCS',
        icon: Database,
        adminOnly: true,
        description: 'Atualização de dados do sistema ARCS'
      },
      {
        id: 'tire-movement',
        label: 'Movimentação de Pneus',
        icon: ArrowRightLeft,
        description: 'Movimentação de pneus entre contêineres'
      },
      {
        id: 'tire-discard-entry',
        label: 'Descarte DSI',
        icon: Trash2,
        description: 'Registro de descarte de pneus'
      },
      {
        id: 'reports',
        label: 'Relatórios & Histórico',
        icon: BarChart3,
        description: 'Relatórios e histórico de pneus'
      },
      {
        id: 'configurar-temporada',
        label: 'Configurar Temporada',
        icon: Calendar,
        description: 'Configuração de temporada'
      }
    ]
  },
  {
    id: 'rodas',
    label: 'Rodas',
    icon: CircleDot,
    isMain: true,
    description: 'Sistema de gestão de rodas',
    subItems: [
      {
        id: 'rodas-dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        description: 'Dashboard de rodas'
      },
      {
        id: 'rodas-pendencias',
        label: 'Pendências',
        icon: Clock,
        description: 'Pendências de rodas'
      },
      {
        id: 'rodas-avarias',
        label: 'Avarias',
        icon: AlertTriangle,
        description: 'Avarias de rodas'
      }
    ]
  },
  {
    id: 'cadastro',
    label: 'Cadastro',
    icon: Settings,
    isMain: true,
    adminOnly: true,
    description: 'Cadastros gerais do sistema',
    subItems: [
      { 
        id: 'tire-models', 
        label: 'Cadastro de Modelos', 
        icon: CircleDot,
        description: 'Cadastro de modelos de pneus'
      },
      { 
        id: 'tire-status', 
        label: 'Cadastro de Status', 
        icon: CircleDot,
        description: 'Cadastro de status de pneus'
      },
      { 
        id: 'containers', 
        label: 'Cadastro de Contêineres', 
        icon: Box,
        description: 'Cadastro de contêineres'
      },
      { 
        id: 'master-data', 
        label: 'Master Data', 
        icon: Database,
        description: 'Dados mestres do sistema'
      },
    ]
  },
  {
    id: 'administracao',
    label: 'Administração',
    icon: Shield,
    isMain: true,
    adminOnly: true,
    description: 'Área administrativa',
    subItems: [
      { 
        id: 'users', 
        label: 'Gerenciar Usuários', 
        icon: Shield,
        description: 'Gerenciamento de usuários do sistema'
      },
      { 
        id: 'access-profiles', 
        label: 'Perfis de Acesso', 
        icon: UserCircle,
        description: 'Configuração de perfis de acesso'
      },
      { 
        id: 'stock-adjustment', 
        label: 'Ajuste de Estoque', 
        icon: Settings,
        description: 'Ajustes manuais de estoque'
      },
      { 
        id: 'configuracoes-notificacoes', 
        label: 'Notificações de Avarias', 
        icon: Bell,
        description: 'Configurar gestor para receber e-mails de avarias'
      },
      // 🔥 ÁREA EM DESENVOLVIMENTO
      { 
        id: 'em-desenvolvimento',
        label: 'Em Desenvolvimento',
        icon: Code,
        description: 'Funcionalidades em desenvolvimento',
        subItems: [
          // 🔥🔥🔥 ÁREA CAIO - ADICIONADO EM 2024 🔥🔥🔥
          {
            id: 'caio',
            label: 'Caio',
            icon: User,
            description: 'Área de desenvolvimento Caio',
            subItems: [
              {
                id: 'cadastros-caio',
                label: 'Cadastros',
                icon: Settings,
                description: 'Página de cadastros do Caio'
              }
            ]
          },
          {
            id: 'rafael',
            label: 'Rafael',
            icon: User,
            description: 'Área de desenvolvimento Rafael',
            subItems: [
              { 
                id: 'dashboard', 
                label: 'Dashboard', 
                icon: LayoutDashboard,
                description: 'Dashboard com métricas e gráficos'
              },
              { 
                id: 'tire-consumption', 
                label: 'Transferir para Piloto', 
                icon: UserCircle,
                description: 'Transferência de pneus para pilotos'
              },
              { 
                id: 'tire-status-change', 
                label: 'Mudar Status', 
                icon: CircleDot,
                description: 'Alteração de status de pneus'
              },
              { 
                id: 'data-import', 
                label: 'Importação de Dados', 
                icon: Database,
                description: 'Importação de dados via planilha'
              },
              { 
                id: 'tire-discard-reports', 
                label: 'Relatórios & Histórico de Descarte', 
                icon: FileText,
                description: 'Relatórios de descarte de pneus'
              },
              {
                id: 'sourcing',
                label: 'Sourcing',
                icon: Handshake,
                description: 'Sourcing Logística e Compras'
              },
              {
                id: 'almoxarifado',
                label: 'Almoxarifado',
                icon: Warehouse,
                description: 'Área de almoxarifado',
                subItems: [
                  { 
                    id: 'almoxarifado-gases', 
                    label: 'Gases', 
                    icon: Wind,
                    description: 'Controle de gases',
                    subItems: [
                      {
                        id: 'almoxarifado-gases-cadastro',
                        label: 'Cadastro',
                        icon: Settings,
                        description: 'Cadastro de gases'
                      },
                      {
                        id: 'almoxarifado-gases-programacao',
                        label: 'Programação',
                        icon: Calendar,
                        description: 'Programação de gases'
                      }
                    ]
                  },
                  { 
                    id: 'almoxarifado-combustivel', 
                    label: 'Combustível', 
                    icon: Fuel,
                    description: 'Controle de combustível'
                  },
                  { 
                    id: 'almoxarifado-solicitacao-compras', 
                    label: 'Solicitação de Compras', 
                    icon: ShoppingCart,
                    description: 'Solicitação de compras'
                  },
                  { 
                    id: 'almoxarifado-solicitacao-uniforme', 
                    label: 'Solicitação de Uniforme', 
                    icon: Shirt,
                    description: 'Solicitação de uniforme'
                  },
                ]
              }
            ]
          },
          // 🔥 ÁREA JAMYLI - ADICIONADO EM 2025 🔥
          {
            id: 'jamyli',
            label: 'Jamyli',
            icon: User,
            description: 'Área de desenvolvimento Jamyli',
            subItems: [
              {
                id: 'shakedown',
                label: 'Shakedown',
                icon: ClipboardCheck,
                description: 'Sistema de Shakedown'
              },
            ]
          },
        ]
      },
    ]
  },
];

/**
 * Extrai todas as páginas da estrutura do menu de forma recursiva
 * Mantém a hierarquia e estrutura original
 */
export function extractAllPages(items: MenuItem[] = MENU_STRUCTURE, parentPath: string = ''): MenuItem[] {
  const pages: MenuItem[] = [];

  for (const item of items) {
    const currentPath = parentPath ? `${parentPath} > ${item.label}` : item.label;
    
    // Adiciona o item atual (com path hierárquico)
    pages.push({
      ...item,
      description: item.description || currentPath,
    });

    // Se tem subitens, processa recursivamente
    if (item.subItems && item.subItems.length > 0) {
      const subPages = extractAllPages(item.subItems, currentPath);
      pages.push(...subPages);
    }
  }

  return pages;
}

/**
 * Extrai apenas as páginas navegáveis (que não são apenas categorias)
 */
export function extractNavigablePages(items: MenuItem[] = MENU_STRUCTURE): MenuItem[] {
  const pages: MenuItem[] = [];

  function traverse(items: MenuItem[], parentPath: string = '') {
    for (const item of items) {
      const currentPath = parentPath ? `${parentPath} > ${item.label}` : item.label;
      
      // Se tem subitens, não é navegável diretamente (é uma categoria)
      if (item.subItems && item.subItems.length > 0) {
        traverse(item.subItems, currentPath);
      } else {
        // Página navegável
        pages.push({
          ...item,
          description: item.description || currentPath,
        });
      }
    }
  }

  traverse(items);
  return pages;
}

/**
 * Organiza páginas por categoria (baseado na hierarquia do menu)
 * EXTRAI TODOS OS ITENS, independente de terem ou não subitens
 */
export function getPagesByCategory(): Record<string, MenuItem[]> {
  console.log('🔥🔥🔥 getPagesByCategory CHAMADA - Checando MENU_STRUCTURE...');
  console.log('🔥 Total de itens principais:', MENU_STRUCTURE.length);
  console.log('🔥 Administração subItems length:', MENU_STRUCTURE.find(m => m.id === 'administracao')?.subItems?.length);
  console.log('🔥 Administração subItems IDs:', MENU_STRUCTURE.find(m => m.id === 'administracao')?.subItems?.map(s => s.id));
  
  const categories: Record<string, MenuItem[]> = {};

  for (const mainItem of MENU_STRUCTURE) {
    if (mainItem.isMain) {
      categories[mainItem.label] = [];
      
      if (mainItem.subItems) {
        function addPages(items: MenuItem[], categoryLabel: string, depth: number = 0) {
          for (const item of items) {
            const indent = '  '.repeat(depth);
            console.log(`${indent}🔍 getPagesByCategory: Processing "${item.id}" (${item.label}) - has subitems: ${!!item.subItems}`);
            
            // SEMPRE adiciona o item, independente de ter subitens ou não
            categories[categoryLabel].push(item);
            console.log(`${indent}   ✅ Added "${item.id}" to category "${categoryLabel}"`);
            
            // Se tem subitens, continua recursão para adicionar os filhos também
            if (item.subItems && item.subItems.length > 0) {
              console.log(`${indent}  ↳ Recursing into ${item.subItems.length} subitems...`);
              addPages(item.subItems, categoryLabel, depth + 1);
            }
          }
        }
        
        addPages(mainItem.subItems, mainItem.label);
      } else {
        // Se não tem subitens, adiciona a própria página
        categories[mainItem.label].push(mainItem);
      }
    }
  }

  console.log('🔍 getPagesByCategory FINAL:');
  for (const [cat, items] of Object.entries(categories)) {
    console.log(`   ${cat}: ${items.length} items`);
    items.forEach(item => {
      console.log(`      - ${item.id} (${item.label})`);
    });
  }

  return categories;
}

/**
 * Busca um item do menu por ID
 */
export function findMenuItemById(id: string, items: MenuItem[] = MENU_STRUCTURE): MenuItem | null {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
    
    if (item.subItems) {
      const found = findMenuItemById(id, item.subItems);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * Retorna o caminho completo de uma página (breadcrumb)
 */
export function getPagePath(pageId: string, items: MenuItem[] = MENU_STRUCTURE, currentPath: string[] = []): string[] | null {
  for (const item of items) {
    const newPath = [...currentPath, item.label];
    
    if (item.id === pageId) {
      return newPath;
    }
    
    if (item.subItems) {
      const found = getPagePath(pageId, item.subItems, newPath);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * Mapeamento de IDs de menu para constantes de permissões
 * Mantido para compatibilidade com sistema de permissões existente
 */
export const MENU_TO_PAGE_MAP: Record<string, string> = {
  'dashboard': 'DASHBOARD',
  'tire-stock': 'STOCK_ENTRY',
  'tire-movement': 'TIRE_MOVEMENT',
  'tire-consumption': 'TIRE_CONSUMPTION',
  'tire-status-change': 'TIRE_STATUS_CHANGE',
  'arcs-data-update': 'ARCS_UPDATE',
  'tire-discard-entry': 'TIRE_DISCARD',
  'tire-discard-reports': 'DISCARD_REPORTS',
  'tire-models': 'TIRE_MODEL',
  'tire-status': 'STATUS_REGISTRATION',
  'containers': 'CONTAINER',
  'reports': 'REPORTS',
  'data-import': 'DATA_IMPORT',
  'sourcing': 'SOURCING',
  'stock-adjustment': 'STOCK_ADJUSTMENT',
  'users': 'USER_MANAGEMENT',
  'access-profiles': 'ACCESS_PROFILES', // Key separada para evitar duplicação
  'master-data': 'MASTER_DATA',
  'em-desenvolvimento': 'EM_DESENVOLVIMENTO',
  'rafael': 'RAFAEL',
  'caio': 'CAIO',
  'cadastros-caio': 'CADASTROS_CAIO',
  'jamyli': 'JAMYLI',
  'configurar-temporada': 'SEASON_CONFIGURATION',
  'conferencia-baias': 'CONFERENCIA_BAIAS',
  'conferir-pneus': 'CONFERIR_PNEUS',
  'historico-conferencia': 'HISTORICO_CONFERENCIA',
  'divergencias-conferencia': 'DIVERGENCIAS_CONFERENCIA',
  'conferencia-serial': 'CONFERENCIA_SERIAL',
  'shakedown': 'SHAKEDOWN',
  'demanda': 'DEMANDA',
  'pedidos-pneus': 'PEDIDOS_PNEUS',
  'rfid-pitlane': 'RFID_PITLANE',
  'rodas': 'RODAS',
  'rodas-dashboard': 'RODAS_DASHBOARD',
  'rodas-pendencias': 'RODAS_PENDENCIAS',
  'rodas-avarias': 'RODAS_AVARIAS',
  'configuracoes-notificacoes': 'CONFIGURACOES_NOTIFICACOES',
  
  // Categorias de menu (agrupadores)
  'solicitacao-frete': 'SOLICITACAO_FRETE',
  'pneus': 'PNEUS',
  'cadastro': 'CADASTRO',
  'administracao': 'ADMINISTRACAO',
  
  // Links externos
  'gestao-carga': 'GESTAO_CARGA',
  'manutencao-predial': 'MANUTENCAO_PREDIAL',
  'frete-smartphone': 'FRETE_SMARTPHONE',
  'frete-web': 'FRETE_WEB',
  'frete-internacional': 'FRETE_INTERNACIONAL',
  'frete-nacional': 'FRETE_NACIONAL',
  'frete-masterdata': 'MASTER_DATA',
  
  // Almoxarifado
  'almoxarifado': 'ALMOXARIFADO',
  'almoxarifado-gases': 'GASES',
  'almoxarifado-gases-cadastro': 'GASES_CADASTRO',
  'almoxarifado-gases-programacao': 'GASES_PROGRAMACAO',
  'almoxarifado-combustivel': 'COMBUSTIVEL',
  'almoxarifado-solicitacao-compras': 'SOLICITACAO_COMPRAS',
  'almoxarifado-solicitacao-uniforme': 'SOLICITACAO_UNIFORME',
};
