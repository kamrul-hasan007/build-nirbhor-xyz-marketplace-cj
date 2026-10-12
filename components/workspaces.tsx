'use client'

import { useState, useTransition, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, Clock3, FileText, LoaderCircle, MapPin, ShieldCheck, Upload, Wallet } from 'lucide-react'
import { applyProviderApplication, assignBookingToProvider, recordCODPaymentReceived, recordProviderDuesSettlement, reviewProviderApplication, setProviderAvailability, transitionProviderBooking } from '@/app/actions/workspaces'

type ServiceOption = { id: string; name: string; categoryName: string }
type ProviderProposal = { serviceName: string; proposedChargeBdt: number }
type ProviderReview = { id: string; name: string; email: string; createdAt: string | null; nidPath: string | null; documentPaths: string[]; proposals: ProviderProposal[] }
type AdminBooking = { id: string; status: string; scheduledAt: string; totalBdt: number; cityName: string; areaName: string; services: string[] }
type ProviderJob = { id: string; status: string; scheduledAt: string; totalBdt: number; addressLine: string; areaName: string; cityName: string; items: { name: string; quantity: number }[] }
type ProviderStats = { earnedBdt: number; duesBdt: number; payoutHistory: { id: string; amountBdt: number; status: string; requestedAt: string | null }[]; payoutSummary: string | null }
const money = (value: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(value)
const shortDate = (value: string) => new Intl.DateTimeFormat('en-BD', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' }).format(new Date(value))

export function ProviderApplication({ services }: { services: ServiceOption[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [charges, setCharges] = useState<Record<string, string>>({})
  const [nidPath, setNidPath] = useState('')
  const [documentPaths, setDocumentPaths] = useState<string[]>([])
  const [uploadMessage, setUploadMessage] = useState('')
  const [applicationMessage, setApplicationMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>, isNid: boolean) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    setUploadMessage('')
    setUploading(true)
    const completed: string[] = []
    for (const file of files) {
      const data = new FormData()
      data.set('file', file)
      try {
        const response = await fetch('/api/provider-documents', { method: 'POST', body: data })
        const result = await response.json() as { pathname?: string; error?: string }
        if (!response.ok || !result.pathname) {
          setUploadMessage(result.error ?? 'Document upload failed.')
          break
        }
        completed.push(result.pathname)
      } catch {
        setUploadMessage('Document upload failed. Check your connection and try again.')
        break
      }
    }
    if (isNid && completed[0]) setNidPath(completed[0])
    if (!isNid && completed.length) setDocumentPaths((current) => [...current, ...completed].slice(0, 5))
    if (completed.length) setUploadMessage(`${completed.length} private document${completed.length === 1 ? '' : 's'} uploaded.`)
    setUploading(false)
    event.target.value = ''
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setApplicationMessage('')
    const data = new FormData(event.currentTarget)
    const payout = { method: String(data.get('method') ?? ''), accountName: String(data.get('accountName') ?? ''), accountNumber: String(data.get('accountNumber') ?? '') }
    const providerServices = selected.map((serviceId) => ({ serviceId, proposedChargeBdt: Number(charges[serviceId]) }))
    startTransition(async () => {
      const result = await applyProviderApplication({ services: providerServices, nidDocumentPath: nidPath, documentPaths, payout })
      setApplicationMessage(result.message)
    })
  }

  return <section className="mt-8 grid gap-8 rounded-[24px] border border-border bg-white p-5 sm:p-8 lg:grid-cols-[1fr_300px]">
    <form onSubmit={submit} className="flex flex-col gap-6">
      <fieldset><legend className="text-lg font-semibold">Choose your services and proposed charges</legend><p className="mt-1 text-sm text-muted-foreground">Only admin-approved services and prices can be offered to customers.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{services.map((service) => <div key={service.id} className="flex items-center gap-3 rounded-xl border border-border p-3"><label htmlFor={`service-${service.id}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"><input id={`service-${service.id}`} type="checkbox" checked={selected.includes(service.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id))} className="size-4 accent-primary" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{service.name}</span><span className="text-xs text-muted-foreground">{service.categoryName}</span></span></label>{selected.includes(service.id) && <label className="sr-only" htmlFor={`charge-${service.id}`}>Proposed charge for {service.name}, BDT</label>}{selected.includes(service.id) && <input id={`charge-${service.id}`} type="number" min="100" max="1000000" step="1" required value={charges[service.id] ?? ''} onChange={(event) => setCharges((current) => ({ ...current, [service.id]: event.target.value }))} placeholder="BDT" className="h-9 w-24 rounded-lg border border-border px-2 text-sm outline-none focus:border-primary" />}</div>)}</div></fieldset>
      <fieldset><legend className="text-lg font-semibold">Identity and supporting documents</legend><p className="mt-1 text-sm text-muted-foreground">PDF, JPEG, PNG or WebP, up to 5 MB each. Documents are stored privately.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-border p-4 text-sm font-semibold"><span className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 text-primary" />National ID <span className="text-destructive">*</span></span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={!nidPath} onChange={(event) => uploadFiles(event, true)} className="text-xs file:mr-2 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold" />{nidPath && <span className="text-xs font-medium text-primary">NID uploaded privately</span>}</label><label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-border p-4 text-sm font-semibold"><span className="flex items-center gap-2"><Upload aria-hidden="true" className="size-4 text-primary" />Certificates (optional)</span><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => uploadFiles(event, false)} className="text-xs file:mr-2 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold" />{documentPaths.length > 0 && <span className="text-xs font-medium text-primary">{documentPaths.length} private file(s) uploaded</span>}</label></div></fieldset>
      <fieldset><legend className="text-lg font-semibold">Payout details</legend><p className="mt-1 text-sm text-muted-foreground">These details are encrypted before they are saved.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1.5 text-xs font-semibold">Payment method<select name="method" required className="h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="">Choose method</option><option value="BANK">Bank account</option><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="ROCKET">Rocket</option></select></label><label className="flex flex-col gap-1.5 text-xs font-semibold">Account holder name<input name="accountName" required minLength={2} maxLength={100} className="h-11 rounded-xl border border-border px-3 text-sm outline-none focus:border-primary" /></label><label className="flex flex-col gap-1.5 text-xs font-semibold sm:col-span-2">Account number<input name="accountNumber" required minLength={6} maxLength={40} autoComplete="off" className="h-11 rounded-xl border border-border px-3 text-sm outline-none focus:border-primary" /></label></div></fieldset>
      {(uploadMessage || applicationMessage) && <p role="status" className="rounded-xl bg-secondary px-4 py-3 text-sm">{applicationMessage || uploadMessage}</p>}
      <button type="submit" disabled={pending || uploading || !nidPath || selected.length === 0} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{pending || uploading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ArrowRight aria-hidden="true" className="size-4" />}{uploading ? 'Uploading documents…' : pending ? 'Submitting…' : 'Submit application'}</button>
    </form>
    <aside className="h-fit rounded-2xl bg-secondary/65 p-5"><span className="grid size-11 place-items-center rounded-xl bg-white text-primary"><ShieldCheck aria-hidden="true" className="size-5" /></span><h2 className="mt-4 font-semibold">Your profile is reviewed first</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">You will not receive jobs until the Nirbhor team approves your documents, selected services and proposed charges.</p><p className="mt-4 text-xs font-medium leading-5 text-muted-foreground">Your National ID and payout details remain private. Account numbers are encrypted before they reach the database.</p></aside>
  </section>
}

export function ProviderDashboard({ availability, jobs, stats }: { availability: string; jobs: ProviderJob[]; stats: ProviderStats }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  function updateAvailability() {
    startTransition(async () => { const result = await setProviderAvailability(availability !== 'available'); setMessage(result.message) })
  }
  function updateBooking(id: string, nextStatus: 'ACCEPTED' | 'REJECTED' | 'ON_THE_WAY' | 'STARTED' | 'COMPLETED') {
    setMessage('')
    startTransition(async () => { const result = await transitionProviderBooking(id, nextStatus); setMessage(result.message) })
  }
  return <>
    <section className="mt-8 grid gap-4 sm:grid-cols-3"><StatCard icon={<Wallet aria-hidden="true" className="size-5" />} label="Platform commission" value={money(stats.earnedBdt)} /><StatCard icon={<BriefcaseBusiness aria-hidden="true" className="size-5" />} label="COD commission due" value={money(stats.duesBdt)} /><button type="button" disabled={pending} onClick={updateAvailability} className="flex min-h-[112px] items-center justify-between rounded-2xl border border-border bg-white p-5 text-left transition hover:border-primary/30"><span><span className="block text-xs text-muted-foreground">Your availability</span><span className="mt-2 block text-lg font-semibold">{availability === 'available' ? 'Available for jobs' : 'Not available'}</span></span><span className={`size-3 rounded-full ${availability === 'available' ? 'bg-[#70945c]' : 'bg-muted-foreground/35'}`} /></button></section>
    {message && <p role="status" className="mt-4 rounded-xl bg-secondary px-4 py-3 text-sm">{message}</p>}
    <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Assigned to you</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Your jobs</h2></div><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{jobs.length} active</span></div>
      {jobs.length ? <div className="mt-5 flex flex-col gap-4">{jobs.map((job) => <article key={job.id} className="rounded-2xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">{job.id}</p><h3 className="mt-1 text-lg font-semibold">{job.items.map((item) => item.name).join(', ')}</h3></div><StatusPill status={job.status} /></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" className="size-4 text-primary" />{shortDate(job.scheduledAt)}</span><span className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4 text-primary" />{job.areaName}, {job.cityName}</span></div>{job.status !== 'ASSIGNED' && <p className="mt-3 text-sm text-muted-foreground">{job.addressLine}</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="text-sm font-semibold">Booking value <span className="ml-1 text-base">{money(job.totalBdt)}</span></p><div className="flex flex-wrap gap-2">{job.status === 'ASSIGNED' && <><ActionButton onClick={() => updateBooking(job.id, 'ACCEPTED')} disabled={pending}>Accept job</ActionButton><ActionButton onClick={() => updateBooking(job.id, 'REJECTED')} disabled={pending} secondary>Decline</ActionButton></>}{job.status === 'ACCEPTED' && <ActionButton onClick={() => updateBooking(job.id, 'ON_THE_WAY')} disabled={pending}>On the way</ActionButton>}{job.status === 'ON_THE_WAY' && <ActionButton onClick={() => updateBooking(job.id, 'STARTED')} disabled={pending}>Start service</ActionButton>}{job.status === 'STARTED' && <ActionButton onClick={() => updateBooking(job.id, 'COMPLETED')} disabled={pending}>Mark complete</ActionButton>}</div></div></article>)}</div> : <EmptyPanel title="No active jobs" body="New assignments will appear here once they match your approved services." />}
    </section>
    <section className="mt-10 grid gap-6 lg:grid-cols-2"><div><h2 className="text-xl font-semibold">Payout details</h2><div className="mt-3 rounded-2xl border border-border bg-white p-5"><p className="text-sm font-semibold">{stats.payoutSummary ?? 'No payout method on file'}</p><p className="mt-1 text-xs text-muted-foreground">Payout information is encrypted at rest.</p></div></div><div><h2 className="text-xl font-semibold">Payout history</h2>{stats.payoutHistory.length ? <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-white px-5">{stats.payoutHistory.map((payout) => <div key={payout.id} className="flex items-center justify-between gap-3 py-4"><span><span className="block text-sm font-semibold">{money(payout.amountBdt)}</span><span className="mt-1 block text-xs text-muted-foreground">{payout.requestedAt ? shortDate(payout.requestedAt) : 'Date pending'}</span></span><StatusPill status={payout.status} /></div>)}</div> : <EmptyPanel title="No payouts yet" body="Approved payout activity will appear here." />}</div></section>
  </>
}

export function AdminWorkspace({ role, metrics, providers, bookings, availableProviders, cashBookings, providerDues }: { role: string; metrics: { requested: number; notResponded: number; pendingProviders: number; totalBookings: number }; providers: ProviderReview[]; bookings: AdminBooking[]; availableProviders: { id: string; name: string }[]; cashBookings: AdminBooking[]; providerDues: { id: string; name: string; balanceBdt: number }[] }) {
  const [pending, startTransition] = useTransition()
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [settlementInputs, setSettlementInputs] = useState<Record<string, { amount: string; memo: string }>>({})
  function review(id: string, decision: 'APPROVED' | 'REJECTED') {
    startTransition(async () => { const result = await reviewProviderApplication(id, decision); setMessages((current) => ({ ...current, [id]: result.message })) })
  }
  function assign(bookingId: string, providerId: string) {
    if (!providerId) return
    startTransition(async () => { const result = await assignBookingToProvider(bookingId, providerId); setMessages((current) => ({ ...current, [bookingId]: result.message })) })
  }
  function recordCashCollection(bookingId: string) {
    startTransition(async () => { const result = await recordCODPaymentReceived(bookingId); setMessages((current) => ({ ...current, [bookingId]: result.message })) })
  }
  function settleDues(providerId: string) {
    const entry = settlementInputs[providerId]
    if (!entry) return
    startTransition(async () => {
      const result = await recordProviderDuesSettlement({ providerId, amountBdt: Number(entry.amount), memo: entry.memo })
      setMessages((current) => ({ ...current, [providerId]: result.message }))
    })
  }
  return <>
    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={<Clock3 aria-hidden="true" className="size-5" />} label="Requested" value={String(metrics.requested)} /><StatCard icon={<ShieldCheck aria-hidden="true" className="size-5" />} label="Not responded" value={String(metrics.notResponded)} /><StatCard icon={<BriefcaseBusiness aria-hidden="true" className="size-5" />} label="Provider applications" value={String(metrics.pendingProviders)} /><StatCard icon={<Check aria-hidden="true" className="size-5" />} label="Bookings to date" value={String(metrics.totalBookings)} /></div>
    {['super_admin', 'operations'].includes(role) && <section className="mt-10"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Partner operations</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Provider applications</h2><p className="mt-1 text-sm text-muted-foreground">Review private documents and proposed service charges before approving a provider.</p></div>
      {providers.length ? <div className="mt-5 grid gap-4 xl:grid-cols-2">{providers.map((provider) => <article key={provider.id} className="rounded-2xl border border-border bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{provider.name}</h3><p className="mt-1 text-xs text-muted-foreground">{provider.email}</p></div><StatusPill status="PENDING" /></div><div className="mt-4 flex flex-wrap gap-2">{provider.nidPath && <DocumentLink path={provider.nidPath} label="National ID" />}{provider.documentPaths.map((path, index) => <DocumentLink key={path} path={path} label={`Supporting document ${index + 1}`} />)}</div><div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">{provider.proposals.map((proposal) => <div key={proposal.serviceName} className="flex justify-between gap-3 text-sm"><span>{proposal.serviceName}</span><span className="font-semibold">Proposed {money(proposal.proposedChargeBdt)}</span></div>)}</div>{messages[provider.id] && <p role="status" className="mt-3 text-xs text-muted-foreground">{messages[provider.id]}</p>}<div className="mt-5 flex gap-2"><ActionButton onClick={() => review(provider.id, 'APPROVED')} disabled={pending}>Approve provider</ActionButton><ActionButton onClick={() => review(provider.id, 'REJECTED')} disabled={pending} secondary>Reject</ActionButton></div></article>)}</div> : <EmptyPanel title="No pending applications" body="New provider applications will be listed here." />}
    </section>}
    {['super_admin', 'operations'].includes(role) && <section className="mt-10"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Booking desk</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Needs assignment</h2><p className="mt-1 text-sm text-muted-foreground">Only available, approved providers who cover every requested service can be assigned.</p></div>
      {bookings.length ? <div className="mt-5 flex flex-col gap-3">{bookings.map((booking) => <article key={booking.id} className="grid gap-4 rounded-2xl border border-border bg-white p-5 lg:grid-cols-[1fr_290px] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{booking.id}</span><StatusPill status={booking.status} /></div><p className="mt-2 text-sm font-semibold">{booking.services.join(', ')}</p><p className="mt-1 text-xs text-muted-foreground">{shortDate(booking.scheduledAt)} · {booking.areaName}, {booking.cityName} · {money(booking.totalBdt)}</p></div><div><label className="sr-only" htmlFor={`assign-${booking.id}`}>Select provider for booking {booking.id}</label><select id={`assign-${booking.id}`} defaultValue="" onChange={(event) => assign(booking.id, event.target.value)} disabled={pending || availableProviders.length === 0} className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary"><option value="">{availableProviders.length ? 'Assign an available provider' : 'No providers available'}</option>{availableProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select>{messages[booking.id] && <p role="status" className="mt-2 text-xs text-muted-foreground">{messages[booking.id]}</p>}</div></article>)}</div> : <EmptyPanel title="Everything is assigned" body="New and declined requests will appear here." />}
    </section>}
    {['super_admin', 'finance'].includes(role) && <>
      <section className="mt-10"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Cash-on-delivery reconciliation</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Completed bookings awaiting collection</h2><p className="mt-1 text-sm text-muted-foreground">Record payment only after the provider confirms cash collection.</p></div>{cashBookings.length ? <div className="mt-5 flex flex-col gap-3">{cashBookings.map((booking) => <article key={booking.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5"><div><p className="font-mono text-xs text-muted-foreground">{booking.id}</p><p className="mt-1 text-sm font-semibold">{booking.services.join(', ')}</p><p className="mt-1 text-xs text-muted-foreground">{booking.areaName}, {booking.cityName} · {shortDate(booking.scheduledAt)}</p><p className="mt-2 text-sm font-semibold">{money(booking.totalBdt)}</p></div><div><ActionButton onClick={() => recordCashCollection(booking.id)} disabled={pending}>Record cash received</ActionButton>{messages[booking.id] && <p role="status" className="mt-2 text-xs text-muted-foreground">{messages[booking.id]}</p>}</div></article>)}</div> : <EmptyPanel title="No COD collection pending" body="Completed cash bookings will appear here until the provider confirms receipt." />}</section>
      <section className="mt-10"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Provider dues ledger</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Record commission settlement</h2><p className="mt-1 text-sm text-muted-foreground">Record completed settlements against provider-reported COD commission. Every entry is audited.</p></div>{providerDues.length ? <div className="mt-5 grid gap-3 xl:grid-cols-2">{providerDues.map((provider) => { const values = settlementInputs[provider.id] ?? { amount: '', memo: '' }; return <article key={provider.id} className="rounded-2xl border border-border bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{provider.name}</h3><p className="mt-1 text-xs text-muted-foreground">Outstanding commission</p></div><p className="text-lg font-semibold">{money(provider.balanceBdt)}</p></div><div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr]"><label className="flex flex-col gap-1 text-xs font-semibold">Amount (BDT)<input type="number" min="1" max={provider.balanceBdt} step="1" value={values.amount} onChange={(event) => setSettlementInputs((current) => ({ ...current, [provider.id]: { ...values, amount: event.target.value } }))} className="h-10 rounded-lg border border-border px-3 text-sm outline-none focus:border-primary" /></label><label className="flex flex-col gap-1 text-xs font-semibold">Settlement reference<input value={values.memo} onChange={(event) => setSettlementInputs((current) => ({ ...current, [provider.id]: { ...values, memo: event.target.value } }))} placeholder="Reference or note" maxLength={250} className="h-10 rounded-lg border border-border px-3 text-sm outline-none focus:border-primary" /></label></div><div className="mt-3 flex items-center justify-between gap-3"><p role="status" className="text-xs text-muted-foreground">{messages[provider.id] ?? ''}</p><ActionButton onClick={() => settleDues(provider.id)} disabled={pending || !values.amount || !values.memo}>Record settlement</ActionButton></div></article>})}</div> : <EmptyPanel title="No COD commission outstanding" body="Provider ledger balances are up to date." />}</section>
    </>}
    <p className="mt-9 rounded-2xl bg-secondary/60 p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mr-2 inline size-4 text-primary" />Signed in as {role.replaceAll('_', ' ')}. Provider decisions and booking assignments are written to the audit log.</p>
  </>
}

export function WorkspaceHeader({ title, eyebrow, name }: { title: string; eyebrow: string; name: string }) {
  return <header className="border-b border-border bg-white"><div className="mx-auto flex min-h-[72px] max-w-[1100px] items-center justify-between gap-4 px-5 sm:px-8"><Link href="/" className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><HomeMark /></span><span className="text-xl font-extrabold tracking-[-.055em]">nirbhor<span className="text-primary">.</span></span></Link><p className="hidden text-sm text-muted-foreground sm:block">{name}</p><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft aria-hidden="true" className="size-4" />Customer site</Link></div></header>
}

export function DocumentLink({ path, label }: { path: string; label: string }) {
  return <a href={`/api/private-provider-document?path=${encodeURIComponent(path)}`} className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 text-xs font-semibold hover:bg-secondary" target="_blank" rel="noreferrer"><FileText aria-hidden="true" className="size-4 text-primary" />{label}</a>
}

function StatusPill({ status }: { status: string }) {
  const label = status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
  return <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold"><span className="size-1.5 rounded-full bg-primary" />{label}</span>
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="min-h-[112px] rounded-2xl border border-border bg-white p-5"><span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary">{icon}</span><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tracking-tight">{value}</p></article>
}

function ActionButton({ children, onClick, disabled, secondary = false }: { children: React.ReactNode; onClick: () => void; disabled: boolean; secondary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition disabled:opacity-50 ${secondary ? 'border border-border bg-white text-foreground hover:bg-secondary' : 'bg-primary text-primary-foreground hover:brightness-110'}`}>{disabled && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}{children}</button>
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <div className="mt-5 rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{body}</p></div>
}

function HomeMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>
}
