import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-[calc(100vh-56px)] flex items-center justify-center overflow-hidden">
        <Image
          src="/imagenes/canchas-panoramica.jpg"
          alt="Canchas de tenis Once Unidos"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative z-10 text-center px-4 max-w-2xl mx-auto py-12">
          {/* Escudo */}
          <div className="flex justify-center mb-5">
            <Image
              src="/imagenes/escudo.png"
              alt="Escudo Club Atlético Olimpia Unidos"
              width={90}
              height={90}
              className="drop-shadow-2xl"
            />
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2 drop-shadow-lg leading-tight">
            Club Atlético<br />Once Unidos
          </h1>
          <p className="text-white/75 text-base sm:text-lg mb-8 leading-relaxed">
            Reservá tu turno en nuestras canchas de tenis.<br className="hidden sm:block" />
            Lunes a domingo, 08:00 a 23:00.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/reservar"
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors shadow-lg text-sm sm:text-base"
            >
              Reservar Turno
            </Link>
            <Link
              href="/mis-reservas"
              className="bg-white/15 hover:bg-white/25 text-white px-8 py-3.5 rounded-xl font-semibold border border-white/40 backdrop-blur-sm transition-colors text-sm sm:text-base"
            >
              Ver Mis Reservas
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { title: '3 Canchas', desc: 'de tenis' },
              { title: '60–120 min', desc: 'por turno' },
              { title: '7 días', desc: 'por adelantado' },
            ].map(({ title, desc }) => (
              <div
                key={title}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 sm:p-4 text-white"
              >
                <p className="font-bold text-sm sm:text-base">{title}</p>
                <p className="text-xs text-white/65 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
