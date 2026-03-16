import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-3">Gestor de Turnos</h1>
        <p className="text-gray-500 mb-8 text-lg leading-relaxed">
          Reservá tu turno en nuestras 3 canchas.<br />
          Horarios de lunes a domingo, 08:00 a 23:00.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/reservar"
            className="bg-green-700 hover:bg-green-800 text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-green-100"
          >
            Reservar Turno
          </Link>
          <Link
            href="/mis-reservas"
            className="bg-white hover:bg-gray-50 text-gray-800 px-8 py-3 rounded-xl font-semibold text-sm border border-gray-200 transition-colors"
          >
            Ver Mis Reservas
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          {[
            { title: '3 Canchas', desc: 'Siempre disponibles' },
            { title: 'Bloques 30 min', desc: '60, 90 o 120 min' },
            { title: '7 días', desc: 'Reservas anticipadas' },
          ].map(({ title, desc }) => (
            <div key={title} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <p className="font-bold text-gray-900 text-sm">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
