'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Ya está instalada como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
      return;
    }

    // Detectar iOS
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(navigator as { standalone?: boolean }).standalone;
    setIsIOS(ios);

    // Escuchar evento de instalación (Chrome / Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Si antes fue descartado, no mostrar
    if (sessionStorage.getItem('pwa-dismissed')) {
      setDismissed(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    } else {
      dismiss();
    }
  };

  const dismiss = () => {
    setDismissed(true);
    setShowIOSHint(false);
    sessionStorage.setItem('pwa-dismissed', '1');
  };

  // Ya instalada o descartada → no mostrar nada
  if (isStandalone || dismissed) return null;

  // Android/Chrome: banner inferior con botón directo
  if (installPrompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
        <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl flex items-center gap-3 px-4 py-3">
          {/* Ícono */}
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
            </svg>
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">Instalá la app</p>
            <p className="text-xs text-gray-500 truncate">Accedé más rápido desde tu pantalla de inicio</p>
          </div>

          {/* Botones */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={dismiss}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
            >
              Ahora no
            </button>
            <button
              onClick={handleInstall}
              className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Instalar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS: botón que muestra instrucciones
  if (isIOS) {
    return (
      <>
        {/* Botón flotante */}
        {!showIOSHint && (
          <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
            <button
              onClick={() => setShowIOSHint(true)}
              className="bg-white border border-gray-200 shadow-lg rounded-2xl px-4 py-3 flex items-center gap-3 max-w-sm w-full"
            >
              <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Instalá la app</p>
                <p className="text-xs text-gray-500">Ver cómo hacerlo en iPhone</p>
              </div>
              <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Modal de instrucciones iOS */}
        {showIOSHint && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40" onClick={dismiss}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-base">Cómo instalar la app</h3>
                <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  <p className="text-sm text-gray-700">
                    Tocá el botón{' '}
                    <span className="inline-flex items-center gap-1 font-medium">
                      Compartir
                      <svg className="w-4 h-4 text-blue-500 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                      </svg>
                    </span>{' '}
                    en la barra de Safari (abajo del todo).
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  <p className="text-sm text-gray-700">
                    Deslizá hacia abajo y tocá{' '}
                    <span className="font-semibold">&quot;Agregar a pantalla de inicio&quot;</span>.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                  <p className="text-sm text-gray-700">
                    Confirmá tocando <span className="font-semibold">&quot;Agregar&quot;</span>. ¡Listo!
                  </p>
                </li>
              </ol>

              <button
                onClick={dismiss}
                className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
