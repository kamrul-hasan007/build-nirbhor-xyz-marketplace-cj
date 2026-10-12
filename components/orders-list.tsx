'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, Clock3, MapPin, Printer, ShieldCheck, ShoppingBag } from 'lucide-react'

export type CustomerOrder = {
  id: string
  status: string
  scheduledAt: string
  createdAt: string | null
  paymentMethod: string
  totalBdt: number
  addressLabel: string
  addressLine: string
  areaName: string
  cityName: string
  items: { name: string; packageName: string; quantity: number; lineTotalBdt: number }[]
  timeline: { status: string; createdAt: string | null }[]
}

const statuses = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'STARTED', 'COMPLETED', 'PAID', 'REJECTED', 'NOT_RESPONDED', 'CANCELLED', 'REFUNDED']
const labels: Record<string, string> = {
  REQUESTED: 'Requested', ASSIGNED: 'Assigned', ACCEPTED: 'Accepted', ON_THE_WAY: 'On the way', STARTED: 'Started',
  COMPLETED: 'Completed', PAID: 'Paid', REJECTED: 'Rejected', NOT_RESPONDED: 'Not responded', CANCELLED: 'Cancelled', REFUNDED: 'Refunded',
}
const formatMoney = (amount: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(amount)
const formatDate = (value: string) => new Intl.DateTimeFormat('en-BD', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' }).format(new Date(value))

export function OrdersList({ orders, customerName }: { orders: CustomerOrder[]; customerName: string }) {
  const [filter, setFilter] = useState('ALL')
  const visibleOrders = useMemo(() => orders.filter((order) => filter === 'ALL' || order.status === filter), [filter, orders])

  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-white"><div className="mx-auto flex h-[72px] max-w-[1040px] items-center justify-between px-5 sm:px-8"><Link href="/" className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><HomeMark /></span><span className="text-xl font-extrabold tracking-[-.055em]">nirbhor<span className="text-primary">.</span></span></Link><span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">Hello, {customerName}</span><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft aria-hidden="true" className="size-4" />Back to services</Link></div></header>
    <div className="mx-auto max-w-[1040px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.15em] text-primary">Your Nirbhor account</p><h1 className="text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Service orders</h1><p className="mt-2 text-sm text-muted-foreground">Follow your bookings from request through completion.</p></div><span className="rounded-full bg-secondary px-3.5 py-2 text-xs font-semibold">{orders.length} {orders.length === 1 ? 'booking' : 'bookings'}</span></div>
      {orders.length > 0 ? <>
        <div className="mt-8 flex gap-2 overflow-x-auto pb-2" aria-label="Filter orders by status"><button type="button" onClick={() => setFilter('ALL')} aria-pressed={filter === 'ALL'} className={`h-9 shrink-0 rounded-full border px-4 text-xs font-semibold ${filter === 'ALL' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white'}`}>All orders</button>{statuses.map((status) => <button type="button" key={status} onClick={() => setFilter(status)} aria-pressed={filter === status} className={`h-9 shrink-0 rounded-full border px-4 text-xs font-semibold ${filter === status ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white'}`}>{labels[status]}</button>)}</div>
        <div className="mt-4 flex flex-col gap-4">{visibleOrders.map((order) => <article key={order.id} className="overflow-hidden rounded-[22px] border border-border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/35 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Booking reference</p><p className="mt-1 font-mono text-xs font-semibold">{order.id}</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#eaf0e6] px-3 py-1.5 text-xs font-bold text-primary"><span className="size-1.5 rounded-full bg-primary" />{labels[order.status] ?? order.status}</span></div>
          <div className="grid gap-6 p-5 sm:grid-cols-[1fr_230px] sm:p-6"><div><div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-4 text-primary" />{formatDate(order.scheduledAt)}</span><span className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4 text-primary" />{order.areaName}, {order.cityName}</span></div><div className="mt-5 flex flex-col gap-3">{order.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><ShoppingBag aria-hidden="true" className="size-4" /></span><span><span className="block text-sm font-semibold">{item.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.packageName} · Qty {item.quantity}</span></span></div><span className="text-sm font-semibold">{formatMoney(item.lineTotalBdt)}</span></div>)}</div><p className="mt-5 text-xs text-muted-foreground"><strong className="text-foreground">{order.addressLabel}:</strong> {order.addressLine}</p></div><div className="flex flex-col justify-between rounded-2xl bg-secondary/55 p-4"><div><p className="text-xs text-muted-foreground">Booking total</p><p className="mt-1 text-2xl font-semibold tracking-tight">{formatMoney(order.totalBdt)}</p><p className="mt-1 text-[11px] text-muted-foreground">{order.paymentMethod === 'COD' ? 'Pay after your service' : order.paymentMethod}</p></div><button type="button" onClick={() => window.print()} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white text-xs font-semibold transition hover:bg-background print:hidden"><Printer aria-hidden="true" className="size-4" />Print details</button></div></div>
          {order.timeline.length > 0 && <div className="border-t border-border px-5 py-4 sm:px-6"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Status history</p><ol className="flex flex-wrap gap-x-4 gap-y-2">{order.timeline.map((entry, index) => <li key={`${entry.status}-${index}`} className="inline-flex items-center gap-1.5 text-xs"><span className="grid size-5 place-items-center rounded-full bg-[#eaf0e6] text-primary"><Check aria-hidden="true" className="size-3" /></span><span className="font-medium">{labels[entry.status] ?? entry.status}</span>{entry.createdAt && <time className="text-muted-foreground">{new Intl.DateTimeFormat('en-BD', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' }).format(new Date(entry.createdAt))}</time>}{index < order.timeline.length - 1 && <ChevronRight aria-hidden="true" className="size-3 text-muted-foreground" />}</li>)}</ol></div>}
        </article>)}</div>
        {visibleOrders.length === 0 && <p className="mt-8 rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">There are no bookings with this status.</p>}
      </> : <div className="mt-10 rounded-[24px] border border-dashed border-border bg-white px-6 py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-secondary text-primary"><Clock3 aria-hidden="true" className="size-6" /></span><h2 className="mt-4 text-lg font-semibold">No service orders yet</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Your confirmed service requests will show up here, along with their status updates.</p><Link href="/#services" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">Browse services <ArrowRight aria-hidden="true" className="size-4" /></Link></div>}
      <p className="mt-7 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />Only you can see the orders associated with your account.</p>
    </div>
  </main>
}

function HomeMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>
}

