import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dolce Vino | Catálogo de vinos',
  description: 'Catálogo online de Dolce Vino, almacén de vinos, espumantes y delicatessen.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
