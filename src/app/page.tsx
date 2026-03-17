'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Elegí el día y horario',
    description: 'Visualizá la disponibilidad en tiempo real para los próximos 7 días.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Completá tus datos',
    description: 'Solo necesitás tu nombre y teléfono. Sin registros ni contraseñas.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Listo, ¡a jugar!',
    description: 'Tu turno queda confirmado al instante. Podés cancelarlo desde Mis Reservas.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.45, ease: 'easeOut' as const },
  }),
};

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
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex justify-center mb-5"
          >
            <Image
              src="/imagenes/escudo.png"
              alt="Escudo Club Atlético Olimpia Unidos"
              width={90}
              height={90}
              className="drop-shadow-2xl"
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-4xl sm:text-5xl font-bold text-white mb-2 drop-shadow-lg leading-tight"
          >
            Club Atlético<br />Once Unidos
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-white/75 text-base sm:text-lg mb-8 leading-relaxed"
          >
            Reservá tu turno en nuestras canchas de tenis.<br className="hidden sm:block" />
            Lunes a domingo, 08:00 a 23:00.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
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
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="mt-10 grid grid-cols-3 gap-2 sm:gap-4"
          >
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
          </motion.div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-14"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-green-600">
              Simple y rápido
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
              ¿Cómo reservar?
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={fadeUp}
                custom={i + 1}
                className="flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600 mb-4 shadow-sm">
                  {step.icon}
                </div>
                <span className="text-xs font-bold text-green-500 uppercase tracking-widest mb-1">
                  {step.number}
                </span>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={fadeUp}
            custom={4}
            className="text-center mt-12"
          >
            <Link
              href="/reservar"
              className="inline-block bg-green-600 hover:bg-green-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors shadow-sm text-sm"
            >
              Reservar ahora
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
