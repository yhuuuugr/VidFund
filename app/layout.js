export const metadata = {
  title: 'Small Money — Fundraisers built on small amounts',
  description: 'Raise money in Ghana, one small donation at a time.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#fff' }}>{children}</body>
    </html>
  );
}
