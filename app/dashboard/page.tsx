'use client';

import React, { useEffect, useState } from 'react';
import { AccountPanel } from '../../components/AccountPanel';
import { consumeAccessLink } from '../../lib/accessLink';

// Dashboard do cliente em wayia.com.br/dashboard: o login e unico, no site principal (/app); aqui abre direto.
// Sem sessao, manda para o login. Ve so os proprios produtos, faturas e chamados (o servidor filtra pelo e-mail da sessao).
export default function DashboardPage() {
  const [ready, setReady] = useState(false);
  const [pay, setPay] = useState<string | undefined>();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('pay');   // intencao de compra vinda de um projeto
    if (p && /^[a-z0-9-]{1,32}$/.test(p)) setPay(p);
    consumeAccessLink().finally(() => setReady(true));
  }, []);
  return (
    <div className="min-h-screen bg-[#0f0620] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">{ready && <AccountPanel initialProduct={pay} />}</div>
    </div>
  );
}
