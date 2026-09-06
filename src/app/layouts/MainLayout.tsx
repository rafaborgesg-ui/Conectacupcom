import { Suspense, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { MobileNav } from '../components/MobileNav';
import { Toaster } from '../components/ui/sonner';
import { CacheBuster } from '../components/CacheBuster';
import { ZoomPrevention } from '../components/ZoomPrevention';
import { DatabaseMigrationAlert } from '../components/DatabaseMigrationAlert';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';
import { QuickTips } from '../components/QuickTips';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { TireStatusProvider } from '../utils/TireStatusContext';
import { createClient } from '../utils/supabase/client';
import { clearPermissionsCache } from '../utils/usePermissions';
import { initToastClickHandler } from '../utils/toastClickHandler';

// 🎯 Loading Fallback Component
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-gray-600 text-sm">Carregando página...</p>
    </div>
  </div>
);

/**
 * MainLayout - Layout principal da aplicação
 * 
 * Envolve todas as páginas autenticadas com:
 * - Sidebar (desktop)
 * - MobileNav (mobile)
 * - TireStatusProvider (contexto global)
 * - ErrorBoundary (proteção)
 * - Toaster (notificações)
 */
export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dbError, setDbError] = useState<{ code?: string; message?: string } | null>(null);
  const [userRole, setUserRole] = useState<string>('operator');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDesktopSidebarExpanded, setIsDesktopSidebarExpanded] = useState(false);
  const isFreightNationalRoute = location.pathname.startsWith('/frete/nacional');
  const desktopSidebarWidth = isDesktopSidebarExpanded ? '18rem' : '5rem';
  const desktopMainOffsetClass = isDesktopSidebarExpanded ? 'lg:ml-72' : 'lg:ml-20';
  const layoutStyle = {
    '--desktop-sidebar-width': desktopSidebarWidth,
  } as CSSProperties;

  // 🎯 Inicializa handler de clique nos toasts (apenas uma vez)
  useEffect(() => {
    initToastClickHandler();
  }, []);

  // Verifica autenticação
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/login');
          return;
        }
        
        // Obtém dados do usuário do localStorage
        const userStr = localStorage.getItem('porsche-cup-user');
        if (userStr) {
          const user = JSON.parse(userStr);
          setUserRole(user.role || 'operator');
        }
        
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      localStorage.removeItem('porsche-cup-user');
      clearPermissionsCache();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      navigate('/login');
    }
  };

  if (isLoading) {
    return <PageLoadingFallback />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <TireStatusProvider onError={setDbError}>
      {/* ✅ WCAG 2.1 AA - Skip Links para Navegação por Teclado */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 
                   focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#D50000] 
                   focus:text-white focus:rounded-lg focus:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
      >
        Pular para conteúdo principal
      </a>

      {/* Cache Buster - Detecta código desatualizado */}
      <CacheBuster />
      
      <div
        className={`${isFreightNationalRoute ? 'min-h-0 lg:min-h-screen' : 'min-h-screen'} bg-gray-50 flex tap-highlight-none`}
        style={layoutStyle}
      >
        {/* Componente de Prevenção de Zoom */}
        <ZoomPrevention />
        
        {/* Alerta de Migração de Banco de Dados */}
        <DatabaseMigrationAlert 
          errorCode={dbError?.code} 
          errorMessage={dbError?.message} 
        />
      
        {/* Desktop Sidebar */}
        <Sidebar
          onLogout={handleLogout}
          userRole={userRole}
          isDesktopExpanded={isDesktopSidebarExpanded}
          onDesktopExpandedChange={setIsDesktopSidebarExpanded}
        />
        
        {/* Mobile Navigation */}
        <MobileNav onLogout={handleLogout} userRole={userRole} />
        
        {/* ✅ WCAG 2.1 AA - Main landmark com id para skip link */}
        <main 
          id="main-content" 
          tabIndex={-1}
          className={`flex-1 ${desktopMainOffsetClass} ${isFreightNationalRoute ? 'min-h-0 pb-0 lg:min-h-screen' : 'min-h-screen pb-16 lg:pb-0'} no-overscroll focus:outline-none collector-adapt-main`}
        >
          {/* 🚀 SUSPENSE - Envolve todos os componentes lazy loaded */}
          <Suspense fallback={<PageLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
        
        <PWAInstallPrompt />
        <QuickTips />
        
        <Toaster />
      </div>
    </TireStatusProvider>
  );
}
