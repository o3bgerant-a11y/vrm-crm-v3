import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Vroom Market CRM V3', description: 'CRM agents commerciaux Vroom Market' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
