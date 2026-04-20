import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PolyFlow 3D',
  description: 'Intuitive 3D model creator and editor for artists.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-50 h-screen w-screen overflow-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
