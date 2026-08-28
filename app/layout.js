export const metadata = {
  title: 'VidFund — Small money adds up',
  description: 'Start a fundraiser where everyone gives a little — and together, it\'s a lot.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: '#FFFBF2' }}>{children}</body>
    </html>
  );
}
