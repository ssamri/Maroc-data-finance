"use client";

import { type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { messages, type AdminLocale } from "./messages";
import styles from "./admin-console.module.css";
import { createAdminAuthClient, signOutAdministrator } from "./auth";

type Validation = "draft" | "pending" | "approved" | "rejected";
type Role = "reader" | "editor" | "reviewer" | "admin";
type RegistryEntity = "institutions" | "data_sources" | "indicators" | "indicator_definitions";
type Entry = { id: string; name: string; validation_status: Validation };
type Indicator = Entry & { code: string };
type Definition = { id: string; approved_at: string | null; indicator_id: string; version: number; definition: string; unit: string; scale: number; economic_scope: string; frequency: string; accounting_basis: string; comparability_notes: string | null; valid_from: string; valid_until: string | null; validation_status: Validation };
type Source = Entry & { institution_id: string };
type DocumentRecord = { id: string; title: string; institution_id: string; data_source_id: string; source_url: string; published_at: string; validation_status: Validation; document_type: string; storage_path: string | null };
type Observation = { id: string; indicator_id: string; value_exact: string; unit: string; scale: number; economic_scope: string; period_start: string; period_end: string; published_at: string; validation_status: Validation; observation_status: "observed" | "provisional" | "estimated"; version: number; source_url: string; document_locator: string; review_note: string | null };
type Workspace = { profile: { role: Role }; observations: Observation[]; indicators: Indicator[]; definitions: Definition[]; institutions: Entry[]; sources: Source[]; documents: DocumentRecord[] };
type Review = { id: string; title: string; path: string };
type Tab = "observations" | "documents" | "registry";

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`${styles.field} ${wide ? styles.wide : ""}`}><span>{label}</span>{children}</label>;
}

function makeBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) return null;
    return createAdminAuthClient(url, key);
  } catch { return null; }
}

export default function AdminConsole({ locale = "fr" }: { locale?: AdminLocale }) {
  const t = messages[locale];
  const [client] = useState(makeBrowserClient);
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(() => !client);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("observations");
  const [review, setReview] = useState<Review | null>(null);
  const [indicatorId, setIndicatorId] = useState("");
  const [definitionId, setDefinitionId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [uploadInstitution, setUploadInstitution] = useState("");
  const [privateLink, setPrivateLink] = useState<{ id: string; url: string } | null>(null);
  const [editingDefinition, setEditingDefinition] = useState<Definition | null>(null);
  const token = session?.access_token;

  const showFailure = useCallback((code: string) => {
    const errorMessage = code === "VALIDATION_FAILED" ? t.validationFailed
      : ["ADMIN_FORBIDDEN", "ADMIN_INACTIVE", "FORBIDDEN", "UNAUTHORIZED", "ADMIN_PROFILE_REQUIRED", "ADMIN_ROLE_REQUIRED"].includes(code) ? t.denied
      : ["SUPABASE_NOT_CONFIGURED", "AUTH_UNAVAILABLE", "SUPABASE_UNAVAILABLE"].includes(code) ? t.unavailable
      : code === "DUPLICATE_OBSERVATION" ? t.duplicate
      : ["FILE_TOO_LARGE", "INVALID_FILE_FORMAT"].includes(code) ? t.fileFailed : t.failed;
    setNotice({ text: errorMessage, error: true });
  }, [t]);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!token) throw new Error("UNAUTHORIZED");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (typeof init.body === "string") headers.set("Content-Type", "application/json");
    const response = await fetch(`/api/admin/${path}`, { ...init, headers, cache: "no-store" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error || "OPERATION_FAILED");
    return payload;
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    const payload = await api("observations");
    setWorkspace(payload as unknown as Workspace);
  }, [api, token]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setWorkspace(null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api("observations").then((payload) => { if (active) setWorkspace(payload as unknown as Workspace); }).catch((error: unknown) => { if (active) showFailure(error instanceof Error ? error.message : "OPERATION_FAILED"); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [api, token, showFailure]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    const loginForm = event.currentTarget;
    const form = new FormData(loginForm);
    setBusy(true); setNotice(null);
    try {
      const { error } = await client.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
      if (error) setNotice({ text: t.loginFailed, error: true });
      else loginForm.reset();
    } catch { setNotice({ text: t.loginFailed, error: true }); } finally { setBusy(false); }
  }

  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null);
    try { await action(); await load(); setNotice({ text: success }); }
    catch (error) { showFailure(error instanceof Error ? error.message : "OPERATION_FAILED"); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!client) return;
    setBusy(true); setNotice(null);
    try {
      await signOutAdministrator(client);
      setSession(null); setWorkspace(null); setReview(null); setEditingDefinition(null); setPrivateLink(null);
    } catch { showFailure("OPERATION_FAILED"); }
    finally { setBusy(false); }
  }

  async function submitObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const payload = { ...fields, scale: Number(fields.scale) };
    await perform(async () => { await api("observations", { method: "POST", body: JSON.stringify(payload) }); form.reset(); setIndicatorId(""); setDefinitionId(""); setDocumentId(""); }, t.saved);
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    await perform(async () => { await api("documents", { method: "POST", body: payload }); form.reset(); setUploadInstitution(""); }, t.saved);
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review) return;
    const fields = new FormData(event.currentTarget);
    await perform(async () => { await api(review.path, { method: "PATCH", body: JSON.stringify({ decision: fields.get("decision"), reason: fields.get("reason") }) }); setReview(null); }, t.changed);
  }

  async function saveDefinition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDefinition) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { ...fields, scale: Number(fields.scale), comparability_notes: fields.comparability_notes || null, valid_until: fields.valid_until || null };
    await perform(async () => { await api(`definitions/${editingDefinition.id}`, { method: "PATCH", body: JSON.stringify(payload) }); setEditingDefinition(null); }, t.saved);
  }

  function beginReview(item: Review) { setReview(item); setEditingDefinition(null); setNotice(null); }

  const canEdit = workspace && ["editor", "admin"].includes(workspace.profile.role);
  const canReview = workspace && ["reviewer", "admin"].includes(workspace.profile.role);
  const canEditDefinition = workspace && ["editor", "reviewer", "admin"].includes(workspace.profile.role);
  const selectedDefinition = workspace?.definitions.find((item) => item.id === definitionId);
  const selectedDocument = workspace?.documents.find((item) => item.id === documentId);
  const approvedDefinitions = workspace?.definitions.filter((item) => item.validation_status === "approved") ?? [];
  const approvedDocuments = workspace?.documents.filter((item) => item.validation_status === "approved") ?? [];
  const approvedInstitutions = workspace?.institutions.filter((item) => item.validation_status === "approved") ?? [];
  const approvedSources = workspace?.sources.filter((item) => item.validation_status === "approved") ?? [];
  const indicatorName = (id: string) => workspace?.indicators.find((item) => item.id === id)?.name || id;
  const scaleName = (scale: number) => scale === 1000000000 ? t.billion : scale === 1000000 ? t.million : t.base;
  const badge = (status: Validation) => <span className={styles.badge}>{t[status]}</span>;
  const reviewButton = (item: Review, status: Validation) => canReview && status !== "approved" ? <button className={styles.button} type="button" disabled={busy} onClick={() => beginReview(item)} aria-controls="review-panel">{t.review}</button> : null;

  return <div className={styles.shell} dir={locale === "ar" ? "rtl" : "ltr"}>
    <div><h2 className={styles.heading}>{t.title}</h2><p className={styles.copy}>{t.introduction}</p></div>
    {!client ? <section className={styles.panel}><h3 className={styles.heading}>{t.setupTitle}</h3><p className={styles.copy}>{t.setup}</p><p className={styles.copy}>{t.adminUnconnected}</p></section> : !ready ? <p role="status">{t.loading}</p> : null}
    {notice && <div className={`${styles.notice} ${notice.error ? styles.error : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</div>}
    {client && ready && !session && <section className={`${styles.panel} ${styles.login}`}><p className={styles.copy}>{t.signInNotice}</p><form className={styles.review} onSubmit={login}><Field label={t.email}><input name="email" type="email" autoComplete="username" required maxLength={254} /></Field><Field label={t.password}><input name="password" type="password" autoComplete="current-password" required /></Field><button className={`${styles.button} ${styles.primary}`} disabled={busy}>{busy ? t.loading : t.login}</button></form></section>}
    {client && session && <div className={styles.toolbar}><div>{workspace && <span className={styles.badge}>{t[workspace.profile.role]}</span>}<p className={styles.meta}>{t.rights}</p></div><div className={styles.actions}><button className={styles.button} type="button" disabled={busy} onClick={() => void perform(async () => undefined, t.updated)}>{t.refresh}</button><button className={styles.button} type="button" disabled={busy} onClick={() => void logout()}>{t.logout}</button></div></div>}
    {workspace && <>
      <div className={styles.tabBar} role="tablist" aria-label={t.title}>{(["observations", "documents", "registry"] as const).map((item) => <button key={item} id={`tab-${item}`} className={`${styles.button} ${tab === item ? styles.active : ""}`} role="tab" aria-selected={tab === item} aria-controls={`panel-${item}`} tabIndex={tab === item ? 0 : -1} type="button" onClick={() => setTab(item)} onKeyDown={(event) => {
        const tabs: Tab[] = ["observations", "documents", "registry"];
        let index = tabs.indexOf(item);
        if (event.key === "Home") index = 0;
        else if (event.key === "End") index = tabs.length - 1;
        else if (event.key === "ArrowRight") index += locale === "ar" ? -1 : 1;
        else if (event.key === "ArrowLeft") index += locale === "ar" ? 1 : -1;
        else return;
        event.preventDefault();
        const next = tabs[(index + tabs.length) % tabs.length];
        if (next) { setTab(next); document.getElementById(`tab-${next}`)?.focus(); }
      }}>{t[item]}</button>)}</div>
      {editingDefinition && canEditDefinition && <section className={styles.panel} id="definition-editor" aria-labelledby="definition-edit-title"><h3 className={styles.heading} id="definition-edit-title">{t.editDefinition} · {indicatorName(editingDefinition.indicator_id)}</h3><p className={styles.copy}>{t.metadataHint}</p><form key={editingDefinition.id} className={styles.grid} onSubmit={saveDefinition}>
        <Field label={t.definitionText} wide><textarea name="definition" required minLength={20} maxLength={5000} defaultValue={editingDefinition.definition} /></Field>
        <Field label={t.accountingBasis} wide><input name="accounting_basis" required minLength={3} maxLength={500} defaultValue={editingDefinition.accounting_basis} /></Field>
        <Field label={t.unit}><input name="unit" required maxLength={40} defaultValue={editingDefinition.unit} /></Field><Field label={t.scale}><select name="scale" required defaultValue={editingDefinition.scale}><option value="1">{t.base}</option><option value="1000000">{t.million}</option><option value="1000000000">{t.billion}</option></select></Field>
        <Field label={t.scope}><input name="economic_scope" required maxLength={180} defaultValue={editingDefinition.economic_scope} /></Field><Field label={t.frequency}><select name="frequency" defaultValue={editingDefinition.frequency} required><option value="annual">{t.annual}</option><option value="quarterly">{t.quarterly}</option><option value="monthly">{t.monthly}</option><option value="point_in_time">{t.pointInTime}</option></select></Field>
        <Field label={t.validFrom}><input name="valid_from" type="date" required defaultValue={editingDefinition.valid_from} /></Field><Field label={t.validUntil}><input name="valid_until" type="date" defaultValue={editingDefinition.valid_until || ""} /></Field><Field label={t.comparabilityNotes} wide><textarea name="comparability_notes" maxLength={5000} defaultValue={editingDefinition.comparability_notes || ""} /></Field>
        <div className={`${styles.wide} ${styles.actions}`}><button className={`${styles.button} ${styles.primary}`} disabled={busy}>{busy ? t.loading : t.saveDefinition}</button><button className={styles.button} type="button" onClick={() => setEditingDefinition(null)}>{t.cancel}</button></div>
      </form></section>}
      {review && canReview && <section id="review-panel" className={styles.panel} aria-labelledby="review-title"><h3 id="review-title" className={styles.heading}>{t.reviewTitle}</h3><p><strong>{review.title}</strong></p><p className={styles.copy}>{t.reviewHint}</p><form className={styles.review} onSubmit={submitReview}><Field label={t.reason}><textarea name="reason" required minLength={10} maxLength={2000} /></Field><Field label={t.status}><select name="decision" required><option value="approved">{t.approve}</option><option value="rejected">{t.reject}</option></select></Field><div className={styles.actions}><button disabled={busy} className={`${styles.button} ${styles.primary}`}>{busy ? t.loading : t.submit}</button><button className={styles.button} type="button" onClick={() => setReview(null)}>{t.cancel}</button></div></form></section>}
      {tab === "observations" && <section id="panel-observations" role="tabpanel" aria-labelledby="tab-observations" className={styles.panel}><h3 className={styles.heading}>{t.observations}</h3><p className={styles.meta}>{t.entriesLimit} {t.revisionNote}</p>{workspace.observations.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{t.indicator}</th><th>{t.value}</th><th>{t.periodEnd}</th><th>{t.status}</th><th>{t.review}</th></tr></thead><tbody>{workspace.observations.map((item) => <tr key={item.id}><td>{indicatorName(item.indicator_id)}<small>{item.economic_scope}</small><small>{t.version} {item.version}</small></td><td><bdi>{item.value_exact} {item.unit}</bdi><small>{scaleName(item.scale)} · {t[item.observation_status]}</small></td><td><time dateTime={item.period_end}>{item.period_end}</time><small><a href={item.source_url} target="_blank" rel="noopener noreferrer">{item.document_locator}</a></small></td><td>{badge(item.validation_status)}{item.review_note && <small>{item.review_note}</small>}</td><td>{reviewButton({ id: item.id, title: indicatorName(item.indicator_id), path: `observations/${item.id}` }, item.validation_status)}</td></tr>)}</tbody></table></div> : <p className={styles.copy}>{t.noObservations}</p>}
        {canEdit && <div className={styles.sectionGap}><h3 className={styles.heading}>{t.draftTitle}</h3><p className={styles.copy}>{t.draftHint}</p>{!approvedDefinitions.length || !approvedDocuments.length ? <p className={styles.notice}>{t.approvedDocsRequired}</p> : <form className={styles.grid} onSubmit={submitObservation}>
          <Field label={t.indicator}><select name="indicator_id" required value={indicatorId} onChange={(event) => { setIndicatorId(event.target.value); setDefinitionId(""); }}><option value="">{t.select}</option>{workspace.indicators.filter((item) => item.validation_status === "approved").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label={t.definition}><select name="indicator_definition_id" required value={definitionId} onChange={(event) => setDefinitionId(event.target.value)}><option value="">{t.select}</option>{approvedDefinitions.filter((item) => item.indicator_id === indicatorId).map((item) => <option key={item.id} value={item.id}>{item.economic_scope} · v{item.version}</option>)}</select></Field>
          <Field label={t.value}><input name="value" type="text" inputMode="decimal" required maxLength={40} pattern="-?(0|[1-9][0-9]{0,17})(\.[0-9]{1,12})?" dir="ltr" /></Field><Field label={t.officialStatus}><select name="observation_status" required><option value="observed">{t.observed}</option><option value="provisional">{t.provisional}</option><option value="estimated">{t.estimated}</option></select></Field>
          <Field label={t.unit}><input name="unit" value={selectedDefinition?.unit || ""} readOnly required /></Field><Field label={t.scale}><input value={selectedDefinition ? scaleName(selectedDefinition.scale) : ""} readOnly /><input name="scale" type="hidden" value={selectedDefinition?.scale || ""} /></Field><Field label={t.scope} wide><input name="economic_scope" value={selectedDefinition?.economic_scope || ""} readOnly required /></Field>
          <Field label={t.periodStart}><input name="period_start" type="date" required /></Field><Field label={t.periodEnd}><input name="period_end" type="date" required /></Field>
          <Field label={t.sourceDocument} wide><select name="source_document_id" required value={documentId} onChange={(event) => setDocumentId(event.target.value)}><option value="">{t.select}</option>{approvedDocuments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
          <Field label={t.institution}><input value={workspace.institutions.find((item) => item.id === selectedDocument?.institution_id)?.name || ""} readOnly /><input name="institution_id" type="hidden" value={selectedDocument?.institution_id || ""} /></Field><Field label={t.publicationDate}><input name="published_at" type="date" required value={selectedDocument?.published_at || ""} readOnly /></Field>
          <Field label={t.sourceUrl} wide><input name="source_url" type="url" required readOnly value={selectedDocument?.source_url || ""} dir="ltr" /></Field><Field label={t.locator} wide><input name="document_locator" required maxLength={500} /></Field><div className={styles.wide}><button className={`${styles.button} ${styles.primary}`} disabled={busy || !selectedDefinition || !selectedDocument}>{busy ? t.loading : t.submit}</button></div>
        </form>}</div>}
      </section>}
      {tab === "documents" && <section id="panel-documents" role="tabpanel" aria-labelledby="tab-documents" className={styles.panel}><h3 className={styles.heading}>{t.documents}</h3><p className={styles.meta}>{t.entriesLimit}</p>{workspace.documents.length ? <ul className={styles.itemList}>{workspace.documents.map((item) => <li className={styles.item} key={item.id}><div><div className={styles.itemTitle}>{item.title}</div><div className={styles.meta}><time dateTime={item.published_at}>{item.published_at}</time> · {item.document_type.toUpperCase()}</div><div className={styles.actions}>{badge(item.validation_status)}<a href={item.source_url} target="_blank" rel="noopener noreferrer" className={styles.meta}>{t.original}</a>{item.storage_path && <button type="button" className={styles.button} disabled={busy} onClick={() => void perform(async () => { const payload = await api(`documents/${item.id}`) as { url: string }; setPrivateLink({ id: item.id, url: payload.url }); }, t.updated)}>{t.privateCopy}</button>}{privateLink?.id === item.id && <a href={privateLink.url} target="_blank" rel="noopener noreferrer" className={styles.button}>{t.privateCopy}</a>}</div></div>{reviewButton({ id: item.id, title: item.title, path: `documents/${item.id}` }, item.validation_status)}</li>)}</ul> : <p className={styles.copy}>{t.noDocuments}</p>}
        {canEdit && <div className={styles.sectionGap}><h3 className={styles.heading}>{t.uploadTitle}</h3><p className={styles.copy}>{t.uploadHint}</p><form className={styles.grid} onSubmit={uploadDocument}><Field label={t.documentTitle} wide><input name="title" minLength={3} maxLength={300} required /></Field><Field label={t.institution}><select name="institution_id" required value={uploadInstitution} onChange={(event) => setUploadInstitution(event.target.value)}><option value="">{t.select}</option>{approvedInstitutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label={t.dataSource}><select key={uploadInstitution} name="data_source_id" required defaultValue=""><option value="">{t.select}</option>{approvedSources.filter((item) => item.institution_id === uploadInstitution).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label={t.sourceUrl} wide><input name="source_url" type="url" required maxLength={2048} dir="ltr" /></Field><Field label={t.publicationDate}><input name="published_at" type="date" required /></Field><Field label={t.language}><select name="language" defaultValue={locale} required><option value="fr">Français</option><option value="ar">العربية</option><option value="en">English</option></select></Field><Field label={t.file} wide><input name="file" type="file" accept=".pdf,.csv,.xlsx" required /></Field><div className={styles.wide}><button disabled={busy || !approvedInstitutions.length || !approvedSources.length} className={`${styles.button} ${styles.primary}`}>{busy ? t.loading : t.upload}</button></div></form></div>}
      </section>}
      {tab === "registry" && <section id="panel-registry" role="tabpanel" aria-labelledby="tab-registry" className={styles.panel}><h3 className={styles.heading}>{t.registry}</h3><p className={styles.copy}>{t.registryHint}</p><p className={styles.notice}>{t.registryOrder}</p>{([
        { entity: "institutions", title: t.institutions, items: workspace.institutions.map((item) => ({ ...item, label: item.name })) },
        { entity: "data_sources", title: t.sources, items: workspace.sources.map((item) => ({ ...item, label: item.name })) },
        { entity: "indicators", title: t.indicators, items: workspace.indicators.map((item) => ({ ...item, label: item.name })) },
        { entity: "indicator_definitions", title: t.definitions, items: workspace.definitions.map((item) => ({ ...item, label: `${indicatorName(item.indicator_id)} · ${item.economic_scope} · v${item.version}` })) },
      ] satisfies { entity: RegistryEntity; title: string; items: { id: string; label: string; validation_status: Validation }[] }[]).map((group) => <div className={styles.sectionGap} key={group.entity}><h4 className={styles.heading}>{group.title}</h4>{group.items.length ? <ul className={styles.itemList}>{group.items.map((item) => <li className={styles.item} key={item.id}><div><div className={styles.itemTitle}>{item.label}</div>{badge(item.validation_status)}</div>{group.entity === "indicator_definitions" && canEditDefinition && item.validation_status !== "approved" && !workspace.definitions.find((definition) => definition.id === item.id)?.approved_at && <button type="button" className={styles.button} aria-controls="definition-editor" onClick={() => { setEditingDefinition(workspace.definitions.find((definition) => definition.id === item.id) || null); setReview(null); }} disabled={busy}>{t.editDefinition}</button>}{reviewButton({ id: item.id, title: item.label, path: `registry/${group.entity}/${item.id}` }, item.validation_status)}</li>)}</ul> : <p>{t.noRegistry}</p>}</div>)}</section>}
      {!canReview && <p className={styles.meta}>{t.reviewRequired}</p>}
    </>}
  </div>;
}
