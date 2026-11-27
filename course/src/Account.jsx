import React, { useEffect, useRef, useState } from 'react';

export default function Account({ user, available, onChange, command, onError, socket, t, language }) {
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState(null);
  const [name, setName] = useState('');
  const ledgerRequest = useRef(0);
  const [loadingLedger, setLoadingLedger] = useState(false);
  async function loadLedger(before = null) {
    if (user?.role === 'viewer') return;
    const request = ++ledgerRequest.current;
    setLoadingLedger(true);
    try {
      const page = await command('ledger', before);
      if (request !== ledgerRequest.current) return;
      setLedger((previous) => ({ ...page, transactions: before && previous ? [...previous.transactions, ...page.transactions] : page.transactions }));
    } catch (error) { onError(error); }
    finally { if (request === ledgerRequest.current) setLoadingLedger(false); }
  }
  async function deleteDonation(id) {
    if (!window.confirm(t('確定刪除這筆應援紀錄並退回送出者點數嗎？'))) return;
    try { await command('ledger:delete', id); await loadLedger(); }
    catch (error) { onError(error); }
  }
  useEffect(() => {
    if (!ledger) return;
    const refresh = () => loadLedger();
    socket.on('ledger:changed', refresh);
    return () => socket.off('ledger:changed', refresh);
  }, [Boolean(ledger), socket]);
  async function submit(event, action = 'login') {
    event.preventDefault(); setBusy(true);
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      if (action === 'register' && payload.password !== payload.confirm) throw new Error(t('兩次輸入的密碼不一樣。'));
      delete payload.confirm;
      const response = await fetch(`${import.meta.env.BASE_URL}api/account/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
  const loginForm = <details><summary>{t('主播／管理員登入')}</summary><form className="account-form" onSubmit={submit}><label>{t('帳號')}<input name="username" autoComplete="username" required/></label><label>{t('密碼')}<input name="password" type="password" autoComplete="current-password" required/></label><button disabled={busy || !available}>{t('登入')}</button></form></details>;
  const registerForm = <details><summary>{t('建立帳號')}</summary><form className="account-form" onSubmit={(event) => submit(event, 'register')}><label>{t('帳號')}<input name="username" autoComplete="username" pattern="[A-Za-z0-9_]{3,24}" title={t('3–24 個英文字母、數字或底線')} required/></label><label>{t('暱稱')}<input name="nickname" maxLength="24" required/></label><label>{t('密碼（至少 12 個字）')}<input name="password" type="password" autoComplete="new-password" minLength="12" maxLength="128" required/></label><label>{t('再輸入一次密碼')}<input name="confirm" type="password" autoComplete="new-password" minLength="12" maxLength="128" required/></label><button disabled={busy || !available}>{t('建立並登入')}</button></form><p className="muted">{t('新帳號一開始是觀眾；需要主播或管理員權限時，請由伺服器管理者升級。')}</p></details>;
  return <section className="account-panel" aria-label={t('點數與應援帳本')}><h2>{t('點數與應援帳本')}</h2>
    {user ? <><p>{t('以')} <strong>{user.nickname}</strong> {user.isGuest ? t('（免登入訪客）') : `（@${user.username}）`} · {t(user.role === 'viewer' ? '觀眾' : '主播／管理員')} · {t('餘額')} {user.points} {t('點')}</p><div className="duo-controls">{!user.isGuest && <button onClick={logout}>{t('登出')}</button>}<button disabled={loadingLedger} onClick={() => loadLedger()}>{t('查看／更新應援帳本')}</button></div><form className="inline-form" onSubmit={(event) => { event.preventDefault(); command('nickname', name).then(() => setName('')).catch(onError); }}><label>{t('新暱稱')} <input maxLength="24" value={name} onChange={(e) => setName(e.target.value)} required/></label><button>{t('更新暱稱')}</button></form><p className="muted">{t('上鏡配對代碼：')}{user.username}</p>{Boolean(user.isGuest) && <>{loginForm}{registerForm}</>}</> : <>
      {!available && <p role="status">{t('此網址尚未啟用安全登入。請使用 HTTPS 或本機 localhost。')}</p>}
      {loginForm}{registerForm}
    </>}
    <p className="muted">{t('測試版每位使用者自動獲得 1000 示範點數；同一瀏覽器重新整理不補發。無現金價值，不可購買、提領或兌換。')}</p>
    {ledger && user && <div className="ledger"><p>{t('累計送出')} {ledger.sent} {t('點')} · {t('主播累計收到')} {ledger.received} {t('點')} · {t('目前餘額')} {ledger.points} {t('點')}</p><p>{t('每頁 100 筆')}{t(ledger.scope === 'all' ? '全站' : '個人')}{t('交易；同一請求重試不會重複扣點。主播收到的點數另列收入，不可提領或轉成可用餘額。')}</p>{ledger.reconciliation && <p role="status">{t('全站核帳：已發')} {ledger.reconciliation.granted} {t('點')} = {t('錢包')} {ledger.reconciliation.wallets} + {t('主播收入')} {ledger.reconciliation.income} · {t(ledger.reconciliation.balanced ? '帳目平衡' : '帳目異常，請檢查')}</p>}<div className="table-scroll"><table><thead><tr><th>{t('時間')}</th><th>{t('送出帳號')}</th><th>{t('收取帳號')}</th><th>{t('點數')}</th><th>{t('語音留言')}</th><th>{t('交易 ID')}</th>{ledger.scope === 'all' && <th>{t('管理')}</th>}</tr></thead><tbody>{ledger.transactions.map((row) => <tr key={row.id}><td>{new Date(row.at).toLocaleString(language === 'en' ? 'en-US' : 'zh-TW')}</td><td>{row.sender}</td><td>{row.recipient}</td><td>{row.amount}</td><td>{row.message || '—'}</td><td>{row.id}</td>{ledger.scope === 'all' && <td><button onClick={() => deleteDonation(row.id)}>{t('刪除紀錄')}</button></td>}</tr>)}</tbody></table></div>{ledger.transactions.length === 0 && <p>{t('尚無應援交易。')}</p>}{ledger.nextCursor && <button disabled={loadingLedger} onClick={() => loadLedger(ledger.nextCursor)}>{t(loadingLedger ? '載入中…' : '載入更早交易')}</button>}</div>}
  </section>;
}
