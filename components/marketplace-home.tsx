'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, ChevronDown, Clock3, Home, LoaderCircle, MapPin, Minus, Paintbrush, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Wrench, X, Zap } from 'lucide-react'
import { createBooking } from '@/app/actions/bookings'
import { authClient } from '@/lib/auth-client'
import type { MarketplaceCatalog, MarketplaceCategory, MarketplaceService } from '@/lib/marketplace/catalog'

const categoryIcons: Record<string, typeof Sparkles> = {
  cleaning: Sparkles,
  plumbing: Wrench,
  electrical: Zap,
  'appliance-repair': Clock3,
  painting: Paintbrush,
}
const timeSlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']
const formatMoney = (amount: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(amount)

type CartLine = { packageId: string; name: string; packageName: string; priceBdt: number; quantity: number }

function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = categoryIcons[slug] ?? Home
  return <Icon aria-hidden="true" className={className} />
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" className="size-[18px]"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12.3 12.3 0 0 1 0-7.2v-5.3H5.8a20.3 20.3 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9A19.8 19.8 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"/></svg>
}

export function MarketplaceHome({ catalog }: { catalog: MarketplaceCatalog }) {
  const [cityId, setCityId] = useState(catalog.cities.find((city) => city.name.toLowerCase() === 'dhaka')?.id ?? catalog.cities[0]?.id ?? '')
  const [areaId, setAreaId] = useState('')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [authStep, setAuthStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [bookingMessage, setBookingMessage] = useState('')
  const [confirmedBooking, setConfirmedBooking] = useState('')
  const [isPending, startTransition] = useTransition()
  const [authPending, startAuth] = useTransition()
  const { data: session } = authClient.useSession()
  const router = useRouter()

  const areas = useMemo(() => catalog.areas.filter((area) => area.cityId === cityId), [catalog.areas, cityId])
  const filteredServices = useMemo(() => catalog.services.filter((service) => {
    const matchesCity = service.cityIds.includes(cityId)
    const matchesCategory = category === 'all' || service.categoryId === category
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${service.name} ${service.description ?? ''} ${service.categoryName}`.toLowerCase().includes(query)
    return matchesCity && matchesCategory && matchesSearch
  }), [catalog.services, category, cityId, search])
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + item.priceBdt * item.quantity, 0)
  const activeArea = areas.find((area) => area.id === areaId)

  function changeCity(nextCity: string) {
    setCityId(nextCity)
    setAreaId('')
  }

  function addPackage(service: MarketplaceService, packageId: string, packageName: string, priceBdt: number) {
    setBookingMessage('')
    setConfirmedBooking('')
    setCart((current) => {
      const existing = current.find((item) => item.packageId === packageId)
      if (existing) return current.map((item) => item.packageId === packageId ? { ...item, quantity: Math.min(item.quantity + 1, 10) } : item)
      return [...current, { packageId, name: service.name, packageName, priceBdt, quantity: 1 }]
    })
  }

  function changeQuantity(packageId: string, difference: number) {
    setCart((current) => current.map((item) => item.packageId === packageId ? { ...item, quantity: item.quantity + difference } : item).filter((item) => item.quantity > 0))
  }

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMessage('')
    const digits = phone.replace(/\D/g, '')
    const normalizedPhone = digits.startsWith('880') ? `+${digits}` : digits.startsWith('0') ? `+880${digits.slice(1)}` : `+880${digits}`
    startAuth(async () => {
      const result = await authClient.phoneNumber.sendOtp({ phoneNumber: normalizedPhone })
      if (result.error) {
        setAuthMessage('We could not send a code. Check your number and try again.')
        return
      }
      setPhone(normalizedPhone)
      setAuthStep('otp')
      setAuthMessage('A verification code has been sent to your phone.')
    })
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMessage('')
    startAuth(async () => {
      const result = await authClient.phoneNumber.verify({ phoneNumber: phone, code: otp })
      if (result.error) {
        setAuthMessage('That code could not be verified. Request a new one or try again.')
        return
      }
      setAuthMessage('Phone verified. You can now confirm your booking.')
      router.refresh()
    })
  }

  async function continueWithGoogle() {
    setAuthMessage('')
    startAuth(async () => {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/' })
      if (result.error) setAuthMessage('Google sign-in is unavailable right now. Please use phone verification.')
    })
  }

  function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBookingMessage('')
    const form = new FormData(event.currentTarget)
    const details = {
      items: cart.map(({ packageId, quantity }) => ({ packageId, quantity })),
      cityId,
      areaId,
      addressLine: String(form.get('addressLine') ?? ''),
      label: String(form.get('label') ?? 'Home'),
      scheduledDate: String(form.get('scheduledDate') ?? ''),
      scheduledTime: String(form.get('scheduledTime') ?? ''),
    }
    startTransition(async () => {
      const result = await createBooking(details)
      setBookingMessage(result.message)
      if (result.success) {
        setConfirmedBooking(result.bookingId)
        setCart([])
        router.refresh()
      }
    })
  }

  const today = new Date()
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const defaultDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  return (
    <main id="top" className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="Nirbhor home"><span className="grid size-10 place-items-center rounded-[14px] bg-primary text-primary-foreground"><Home aria-hidden="true" className="size-5" /></span><span className="text-[21px] font-extrabold tracking-[-0.055em]">nirbhor<span className="text-primary">.</span></span></a>
          <label className="hidden min-w-0 items-center gap-2 border-l border-border pl-5 lg:flex"><MapPin aria-hidden="true" className="size-[18px] shrink-0 text-primary" /><span className="sr-only">Select your city</span><select value={cityId} onChange={(event) => changeCity(event.target.value)} className="max-w-[134px] cursor-pointer appearance-none bg-transparent text-sm font-semibold outline-none">{catalog.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select><ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" /></label>
          <label className="hidden h-10 max-w-[360px] flex-1 items-center gap-2.5 rounded-full bg-secondary px-4 text-muted-foreground xl:flex"><Search aria-hidden="true" className="size-4 shrink-0" /><span className="sr-only">Search services</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="What do you need help with?" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" /></label>
          <div className="flex items-center gap-2 sm:gap-3">{session?.user ? <a href="/orders" className="max-w-24 truncate rounded-full px-2 py-2 text-[11px] font-medium transition hover:bg-secondary sm:max-w-32 sm:px-3 sm:text-xs">Orders</a> : <a href="#services" className="hidden rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-secondary lg:inline-flex">Book now</a>}<button type="button" onClick={() => { setBookingMessage(''); setCheckoutOpen(true) }} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110" aria-label={`Open basket, ${count} items`}><ShoppingBag aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Basket</span><span className="grid size-5 place-items-center rounded-full bg-white/20 text-xs">{count}</span></button></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <section className="relative mt-6 min-h-[390px] overflow-hidden rounded-[30px] bg-[#e9e2d0] md:min-h-[440px]" aria-labelledby="hero-title">
          <div className="absolute inset-0 bg-cover bg-[position:58%_52%] md:bg-[position:center_48%]" style={{ backgroundImage: "url('/images/nirbhor-hero.png')" }} aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f3ebd9]/95 via-[#f3ebd9]/85 to-transparent md:from-[#f3ebd9]/95 md:via-[#f3ebd9]/72 md:to-transparent" aria-hidden="true" />
          <div className="relative flex min-h-[390px] max-w-[610px] flex-col justify-center px-6 py-10 sm:px-10 md:min-h-[440px] md:px-14">
            <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-primary backdrop-blur"><span className="size-1.5 rounded-full bg-[#77915d]" />Your home, in good hands</span>
            <h1 id="hero-title" className="max-w-[520px] text-[42px] font-semibold leading-[1.03] tracking-[-0.055em] text-[#253c30] sm:text-[58px]">A little help.<br />A <span className="font-serif italic font-normal">lot</span> more home.</h1>
            <p className="mt-5 max-w-[390px] text-[15px] leading-7 text-[#405347] sm:text-base">Trusted people for all the things that make a house feel like yours.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3"><a href="#services" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-110">Explore services <ArrowRight aria-hidden="true" className="size-4" /></a><span className="text-xs font-medium text-[#405347]">Thoughtfully vetted, locally trusted</span></div>
          </div>
          <div className="absolute bottom-5 right-5 hidden items-center gap-2 rounded-full bg-background/90 px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm backdrop-blur sm:flex md:bottom-7 md:right-7"><ShieldCheck aria-hidden="true" className="size-4 text-primary" />Verified professionals</div>
        </section>

        <section className="relative z-10 mx-auto -mt-7 flex max-w-[1040px] flex-col gap-4 rounded-[22px] border border-border/75 bg-white p-4 shadow-[0_18px_48px_-32px_rgba(32,53,40,.3)] sm:flex-row sm:items-center sm:px-5 sm:py-4" aria-label="Choose your service area">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-secondary/80 px-3.5 py-3 sm:bg-transparent sm:px-2"><MapPin aria-hidden="true" className="size-5 shrink-0 text-primary" /><label className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Your city</span><select value={cityId} onChange={(event) => changeCity(event.target.value)} className="mt-0.5 w-full cursor-pointer appearance-none bg-transparent text-sm font-semibold outline-none">{catalog.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /></div>
          <div className="hidden h-9 w-px bg-border sm:block" />
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-secondary/80 px-3.5 py-3 sm:bg-transparent sm:px-2"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/70 text-primary"><Home aria-hidden="true" className="size-[18px]" /></span><label className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Your area</span><select value={areaId} onChange={(event) => setAreaId(event.target.value)} className="mt-0.5 w-full cursor-pointer appearance-none bg-transparent text-sm font-semibold outline-none"><option value="">Choose a neighbourhood</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /></div>
          <a href="#services" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f0ca61] px-5 text-sm font-bold text-[#303c2d] transition hover:bg-[#e8bd4c]">Find a service <ArrowRight aria-hidden="true" className="size-4" /></a>
        </section>

        <section className="pb-16 pt-14" id="services" aria-labelledby="services-heading">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-primary">Make room for life</p><h2 id="services-heading" className="text-[30px] font-semibold tracking-[-.045em] sm:text-[36px]">What can we help with?</h2><p className="mt-2 text-sm text-muted-foreground">Thoughtful help, right around the corner.</p></div><label className="flex h-10 w-full items-center gap-2 rounded-full border border-border bg-white px-3.5 text-muted-foreground sm:hidden"><Search aria-hidden="true" className="size-4 shrink-0" /><span className="sr-only">Search services</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" /></label></div>
          <div className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Filter by service category"><button type="button" onClick={() => setCategory('all')} aria-pressed={category === 'all'} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${category === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-foreground hover:border-primary/40'}`}>All services</button>{catalog.categories.map((item: MarketplaceCategory) => <button type="button" key={item.id} onClick={() => setCategory(item.id)} aria-pressed={category === item.id} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${category === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-foreground hover:border-primary/40'}`}><CategoryIcon slug={item.slug} className="size-4" />{item.name}</button>)}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filteredServices.map((service) => <ServiceCard key={service.id} service={service} onAdd={addPackage} />)}{filteredServices.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center"><p className="font-semibold">No services found</p><p className="mt-1 text-sm text-muted-foreground">Try another search or choose a different city.</p></div>}</div>
        </section>

        <section className="mb-14 grid gap-4 rounded-[26px] bg-[#e8eee6] p-6 sm:grid-cols-3 sm:gap-8 sm:p-8" aria-label="Why book with Nirbhor">
          <TrustItem icon={<ShieldCheck aria-hidden="true" className="size-5" />} title="People you can trust" description="Every professional is reviewed before they reach your door." />
          <TrustItem icon={<Check aria-hidden="true" className="size-5" />} title="Clear, upfront prices" description="Know what you are booking, and what it costs, before you confirm." />
          <TrustItem icon={<Clock3 aria-hidden="true" className="size-5" />} title="Here when you need us" description="A little less to worry about, from the first tap to the finishing touch." />
        </section>
      </div>

      <footer className="border-t border-border bg-white"><div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><span className="font-bold tracking-tight text-foreground">nirbhor<span className="text-primary">.</span></span><p>Here for home in Dhaka and Chattogram.</p><a href="/provider" className="font-medium hover:text-primary">Become a provider</a><a href="mailto:hello@nirbhor.xyz" className="font-medium hover:text-primary">Need a hand? Get in touch</a></div></footer>

      {checkoutOpen && <div className="fixed inset-0 z-50 flex justify-end bg-[#15251d]/45 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false) }}>
        <section className="flex h-full w-full max-w-[510px] flex-col overflow-y-auto bg-background shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="basket-title">
          <div className="flex items-center justify-between border-b border-border px-5 py-5 sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Your booking</p><h2 id="basket-title" className="mt-1 text-2xl font-semibold tracking-tight">Your basket <span className="text-muted-foreground">({count})</span></h2></div><button type="button" onClick={() => setCheckoutOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-secondary" aria-label="Close basket"><X aria-hidden="true" className="size-5" /></button></div>
          {confirmedBooking ? <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center"><span className="grid size-16 place-items-center rounded-full bg-[#e7f0e5] text-primary"><Check aria-hidden="true" className="size-8" /></span><h3 className="mt-5 text-2xl font-semibold">Request received</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Your booking is now <strong className="text-foreground">Requested</strong>. We will match you with an approved professional.</p><p className="mt-4 rounded-lg bg-secondary px-3 py-2 font-mono text-xs text-muted-foreground">{confirmedBooking}</p><button type="button" onClick={() => setCheckoutOpen(false)} className="mt-7 h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">Back to services</button></div> : cart.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center px-8 py-14 text-center"><span className="grid size-16 place-items-center rounded-full bg-secondary text-primary"><ShoppingBag aria-hidden="true" className="size-7" /></span><h3 className="mt-5 text-lg font-semibold">Your basket is taking a breather</h3><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Pick a service you need and it will be waiting here.</p><button type="button" onClick={() => setCheckoutOpen(false)} className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">Browse services <ArrowRight aria-hidden="true" className="size-4" /></button></div> : <div className="flex flex-1 flex-col">
            <div className="flex flex-col gap-3 px-5 py-5 sm:px-7">{cart.map((item) => <div key={item.packageId} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3.5"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><ShoppingBag aria-hidden="true" className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.packageName}</p><p className="mt-1.5 text-sm font-bold">{formatMoney(item.priceBdt * item.quantity)}</p></div><div className="flex items-center gap-2 rounded-full bg-secondary p-1"><button type="button" onClick={() => changeQuantity(item.packageId, -1)} className="grid size-7 place-items-center rounded-full bg-white" aria-label={`Remove one ${item.name}`}><Minus aria-hidden="true" className="size-3.5" /></button><span className="min-w-4 text-center text-xs font-semibold">{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.packageId, 1)} className="grid size-7 place-items-center rounded-full bg-white" aria-label={`Add one ${item.name}`}><Plus aria-hidden="true" className="size-3.5" /></button></div></div>)}</div>
            <div className="mx-5 border-t border-border sm:mx-7" /><div className="flex items-center justify-between px-5 py-4 text-sm sm:px-7"><span className="text-muted-foreground">Estimated total</span><strong className="text-lg">{formatMoney(subtotal)}</strong></div><p className="px-5 pb-4 text-xs leading-5 text-muted-foreground sm:px-7">Final price is confirmed from the live service catalogue. The total is recalculated when you book.</p>
            {session?.user ? <form className="flex flex-col gap-4 border-t border-border bg-secondary/45 px-5 py-5 sm:px-7" onSubmit={submitBooking}>
              <div className="flex items-center gap-2 text-sm font-semibold"><MapPin aria-hidden="true" className="size-4 text-primary" />Where should we come?</div>
              <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5 text-xs font-semibold">City<select value={cityId} onChange={(event) => changeCity(event.target.value)} className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary">{catalog.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label><label className="flex flex-col gap-1.5 text-xs font-semibold">Area<select required value={areaId} onChange={(event) => setAreaId(event.target.value)} className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary"><option value="">Choose area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label></div>
              <label className="flex flex-col gap-1.5 text-xs font-semibold">Address<textarea name="addressLine" required minLength={8} maxLength={500} rows={2} placeholder="House, road and a helpful landmark" className="resize-y rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-primary" /></label>
              <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5 text-xs font-semibold">Save as<select name="label" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary"><option>Home</option><option>Work</option><option>Other</option></select></label><label className="flex flex-col gap-1.5 text-xs font-semibold">Service date<input name="scheduledDate" type="date" required min={minDate} defaultValue={defaultDate} className="h-11 min-w-0 rounded-xl border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary" /></label></div>
              <label className="flex flex-col gap-1.5 text-xs font-semibold">Preferred time<select name="scheduledTime" required defaultValue={timeSlots[0]} className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary">{timeSlots.map((slot) => <option key={slot} value={slot}>{slot.slice(0, 2)}:00{Number(slot.slice(0, 2)) < 12 ? ' AM' : ' PM'}</option>)}</select></label>
              {activeArea && <p className="flex items-start gap-2 rounded-xl bg-white p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />{activeArea.codEnabled ? 'Cash on delivery is available here for bookings below the advance-payment threshold.' : 'Cash on delivery is unavailable in this area.'}</p>}
              {bookingMessage && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm leading-5 text-destructive">{bookingMessage}</p>}
              <button type="submit" disabled={isPending || !areaId} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55">{isPending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}{isPending ? 'Confirming…' : 'Request booking'}</button><p className="text-center text-[11px] text-muted-foreground">No payment collected now for eligible cash-on-delivery bookings.</p>
            </form> : <div className="flex flex-col gap-4 border-t border-border bg-secondary/45 px-5 py-5 sm:px-7">
              <div><h3 className="font-semibold">One last step</h3><p className="mt-1 text-sm text-muted-foreground">Sign in securely to save your address and request service.</p></div><button type="button" onClick={() => startAuth(async () => { const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/' }); if (result.error) setAuthMessage('Google sign-in is unavailable right now. Please use phone verification.') })} disabled={authPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-semibold transition hover:bg-secondary disabled:opacity-50"><GoogleMark />Continue with Google</button>
              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"><span className="h-px flex-1 bg-border" />or verify by phone<span className="h-px flex-1 bg-border" /></div>
              {authStep === 'phone' ? <form onSubmit={sendOtp} className="flex flex-col gap-3"><label className="flex flex-col gap-1.5 text-xs font-semibold">Bangladesh mobile number<input type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+880 1XXX XXXXXX" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary" /></label><button type="submit" disabled={authPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">{authPending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}Send verification code</button></form> : <form onSubmit={verifyOtp} className="flex flex-col gap-3"><label className="flex flex-col gap-1.5 text-xs font-semibold">6-digit verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="h-11 rounded-xl border border-border bg-white px-3 text-center text-lg font-bold tracking-[.35em] outline-none focus:border-primary" /></label><button type="submit" disabled={authPending || otp.length !== 6} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">{authPending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}Verify & continue</button><button type="button" onClick={() => { setAuthStep('phone'); setOtp(''); setAuthMessage('') }} className="text-xs font-semibold text-primary hover:underline">Use a different number</button></form>}
              {authMessage && <p role="status" className="text-center text-xs text-muted-foreground">{authMessage}</p>}
            </div>}
          </div>}
        </section>
      </div>}
      {count > 0 && !checkoutOpen && <button type="button" onClick={() => setCheckoutOpen(true)} className="fixed bottom-4 left-4 right-4 z-30 flex h-14 items-center justify-between rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-xl sm:hidden"><span className="flex items-center gap-2"><ShoppingBag aria-hidden="true" className="size-4" />{count} {count === 1 ? 'service' : 'services'}</span><span className="flex items-center gap-2">{formatMoney(subtotal)} <ArrowRight aria-hidden="true" className="size-4" /></span></button>}
    </main>
  )
}

function ServiceCard({ service, onAdd }: { service: MarketplaceService; onAdd: (service: MarketplaceService, packageId: string, packageName: string, priceBdt: number) => void }) {
  const startingPrice = Math.min(...service.packages.map((item) => item.priceBdt))
  const lowest = [...service.packages].sort((a, b) => a.priceBdt - b.priceBdt)[0]
  return <article className="group flex flex-col overflow-hidden rounded-[22px] border border-border/80 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_14px_36px_-28px_rgba(32,53,40,.38)]">
    <div className="relative flex h-[144px] items-end justify-between overflow-hidden bg-[#e7ecdf] p-5"><div className="absolute -right-5 -top-14 size-48 rounded-full border-[24px] border-white/25" aria-hidden="true" /><div className="absolute -right-7 -bottom-20 size-44 rounded-full bg-[#d6e0d0]" aria-hidden="true" /><span className="relative grid size-12 place-items-center rounded-[16px] bg-white text-primary shadow-sm"><CategoryIcon slug={service.categorySlug} className="size-6" /></span><span className="relative rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.09em] text-[#546858]">{service.categoryName}</span></div>
    <div className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-[18px] font-semibold tracking-[-.025em]">{service.name}</h3><p className="mt-1.5 min-h-10 text-[13px] leading-5 text-muted-foreground">{service.description}</p></div><span aria-label="Available" className="mt-1 size-2 shrink-0 rounded-full bg-[#76915e] ring-4 ring-[#76915e]/10" /></div>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">Packages from</p><p className="mt-1 text-lg font-bold tracking-tight">{formatMoney(startingPrice)}</p></div><button type="button" onClick={() => onAdd(service, lowest.id, lowest.name, lowest.priceBdt)} className="inline-flex h-10 items-center gap-2 rounded-full bg-secondary px-4 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground">Add service <Plus aria-hidden="true" className="size-3.5" /></button></div>
      {service.packages.length > 1 && <details className="group/packages mt-3 border-t border-border pt-3"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">Choose a package <ChevronDown aria-hidden="true" className="size-3.5 transition group-open/packages:rotate-180" /></summary><div className="mt-3 flex flex-col gap-2">{service.packages.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 p-2.5"><span className="min-w-0"><span className="block truncate text-xs font-semibold">{item.name}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{item.durationMinutes} min · {formatMoney(item.priceBdt)}</span></span><button type="button" onClick={() => onAdd(service, item.id, item.name, item.priceBdt)} className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-primary transition hover:bg-primary hover:text-white" aria-label={`Add ${item.name}`}><Plus aria-hidden="true" className="size-4" /></button></div>)}</div></details>}
    </div>
  </article>
}

function TrustItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-primary">{icon}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>
}
