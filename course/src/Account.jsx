import React, { useEffect, useRef, useState } from 'react';

export default function Account({ user, available, onChange, command, onError, socket }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState(null);
  const [name, setName] = useState('');
  const ledgerRequest = useRef(0);
  const [loadingLedger, setLoadingLedger] = useState(false);
  async function loadLedger(before = null) {
    const request = ++ledgerRequest.current;
    setLoadingLedger(true);
    try {
      const page = await command('ledger', before);
      if (request !== ledgerRequest.current) return;
      setLedger((previous) => ({ ...page, transactions: before && previous ? [...previous.transactions, ...page.transactions] : page.transactions }));
    } catch (error) { onError(error); }
    finally { if (request === ledgerRequest.current) setLoadingLedger(false); }
  }
  useEffect(() => {
    if (!ledger) return;
    const refresh = () => loadLedger();
    socket.on('ledger:changed', refresh);
    return () => socket.off('ledger:changed', refresh);
  }, [Boolean(ledger), socket]);
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch(`${import.meta.env.BASE_URL}api/account/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      event.target.reset(); await onChange();
    } catch (error) { onError(error); }
    finally { setBusy(false); }
  }
  async function logout() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/account/logout`, { method: 'POST' });
      if (!response.ok) throw new Error((await response.json()).error);
      setLedger(null); await onChange();
    } catch (error) { onError(error); }
  }
  return <section className="account-panel" aria-label="帳號與應援帳本"><h2>帳號與應援帳本</h2>
    {user ? <><p>以 <strong>{user.nickname}</strong>（@{user.username}）登入 · {user.role === 'viewer' ? '觀眾' : '主播／管理員'} · 餘額 {user.points} 點</p><div className="duo-controls"><button onClick={logout}>登出</button><button disabled={loadingLedger} onClick={() => loadLedger()}>查看／更新應援帳本</button></div><form className="inline-form" onSubmit={(event) => { event.preventDefault(); command('nickname', name).then(() => setName('')).catch(onError); }}><label>新暱稱 <input maxLength="24" value={name} onChange={(e) => setName(e.target.value)} required/></label><button>更新暱稱</button></form></> : <>
      {!available && <p role="status">此網址尚未啟用安全登入。請使用 HTTPS 或本機 localhost。</p>}
      <form className="account-form" onSubmit={submit}><label>帳號<input name="username" autoComplete="username" minLength="3" maxLength="24" pattern="[a-zA-Z0-9_]{3,24}" required/></label>{register && <label>暱稱<input name="nickname" autoComplete="nickname" maxLength="24" required/></label>}<label>密碼<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength="12" maxLength="128" required/></label><button className="primary" disabled={busy || !available}>{busy ? '處理中…' : register ? '建立帳號' : '登入'}</button><button type="button" onClick={() => setRegister(!register)}>{register ? '已有帳號，改為登入' : '註冊新帳號'}</button></form>
    </>}
    <p className="muted">每個新帳號首次獲得 100 示範點數。無現金價值，不可購買、提領或兌換。</p>
    {ledger && user && <div className="ledger"><p>累計送出 {ledger.sent} 點 · 主播累計收到 {ledger.received} 點 · 目前餘額 {ledger.points} 點</p><p>每頁 100 筆{ledger.scope === 'all' ? '全站' : '個人'}交易；同一請求重試不會重複扣點。主播收到的點數另列收入，不可提領或轉成可用餘額。</p>{ledger.reconciliation && <p role="status">全站核帳：已發 {ledger.reconciliation.granted} 點 = 錢包 {ledger.reconciliation.wallets} + 主播收入 {ledger.reconciliation.income} · {ledger.reconciliation.balanced ? '帳目平衡' : '帳目異常，請檢查'}</p>}<div className="table-scroll"><table><thead><tr><th>時間</th><th>送出帳號</th><th>收取帳號</th><th>點數</th><th>交易 ID</th></tr></thead><tbody>{ledger.transactions.map((row) => <tr key={row.id}><td>{new Date(row.at).toLocaleString('zh-TW')}</td><td>{row.sender}</td><td>{row.recipient}</td><td>{row.amount}</td><td>{row.id}</td></tr>)}</tbody></table></div>{ledger.transactions.length === 0 && <p>尚無應援交易。</p>}{ledger.nextCursor && <button disabled={loadingLedger} onClick={() => loadLedger(ledger.nextCursor)}>{loadingLedger ? '載入中…' : '載入更早交易'}</button>}</div>}
  </section>;
}
