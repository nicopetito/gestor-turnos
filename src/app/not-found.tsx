import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-8xl font-black text-gray-100 select-none">404</p>
        <h1 className="text-xl font-semibold text-gray-800 -mt-2">Página no encontrada</h1>
        <p className="text-sm text-gray-500 mt-2 mb-7">
          La página que buscás no existe o fue movida.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Volver al inicio
          </Link>
          <Link
            href="/reservar"
            className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Reservar turno
          </Link>
        </div>
      </div>
    </main>
  );
}
