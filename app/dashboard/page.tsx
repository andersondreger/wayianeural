'use client';

import React, { useEffect, useState } from 'react';
import { AccountPanel } from '../../components/AccountPanel';
import { consumeAccessLink } from '../../lib/accessLink';

// Dashboard do cliente em wayia.com.br/dashboard: o cliente entra com o codigo enviado ao e-mail dele
// e ve so os proprios produtos, faturas e chamados (o servidor filtra pelo e-mail da sessao).
export default function DashboardPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => { consumeAccessLink().finally(() => setReady(true)); }, []);
  return (
    <div className="min-h-screen bg-[#0f0620] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">{ready && <AccountPanel />}</div>
    </div>
  );
}
