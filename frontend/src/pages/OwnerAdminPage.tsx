import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import AccountActions from '../components/AccountActions';
import {
  createOwnerBarber,
  createOwnerService,
  createStaffAccount,
  fetchOwnerDashboard,
  fetchStaffAccounts,
  updateOwnerBarber,
  updateOwnerBarberStatus,
  updateOwnerService,
  updateOwnerSettings,
  updateStaffAccount,
} from '../services/adminApi';
import type {
  OwnerBarber,
  OwnerDashboardData,
  OwnerSettings,
  StaffAccount,
} from '../types/admin';
import type { SalonService } from '../types/queue';
import type { BarberStatus } from '../types/reception';

const weekDays = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const inputClassName =
  'mt-2 w-full rounded-xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-cream outline-none transition placeholder:text-stone-600 focus:border-gold/60 focus:ring-2 focus:ring-gold/10';
const labelClassName = 'text-xs font-medium text-stone-300';
const buttonClassName =
  'inline-flex items-center justify-center rounded-full bg-gold px-5 py-3 text-xs font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50';
const secondaryButtonClassName =
  'inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2.5 text-xs font-medium text-stone-300 transition hover:border-gold/40 hover:text-gold-light disabled:opacity-50';

interface ServiceForm {
  id: string | null;
  name: string;
  description: string;
  durationMinutes: string;
  priceRupees: string;
  isActive: boolean;
}

interface BarberForm {
  id: string | null;
  name: string;
  photoUrl: string;
  isActive: boolean;
}

interface StaffForm {
  id: string | null;
  name: string;
  email: string;
  username: string;
  password: string;
  role: 'RECEPTIONIST' | 'BARBER';
  barberId: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-2xl text-cream sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{detail}</p>
    </div>
  );
}

function OwnerAdminPage() {
  const [dashboard, setDashboard] = useState<OwnerDashboardData | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<OwnerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm | null>(null);
  const [barberForm, setBarberForm] = useState<BarberForm | null>(null);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [staffForm, setStaffForm] = useState<StaffForm | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setPageError(null);
    try {
      const [result, accounts] = await Promise.all([
        fetchOwnerDashboard(),
        fetchStaffAccounts(),
      ]);
      setDashboard(result);
      setSettingsDraft(result.settings);
      setStaffAccounts(accounts);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveSettings = async (
    section: string,
    savedMessage: string,
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!settingsDraft) return;
    setSaving(section);
    setNotice(null);
    try {
      const settings = await updateOwnerSettings(settingsDraft);
      setSettingsDraft(settings);
      setNotice({ kind: 'success', text: savedMessage });
      await refresh(false);
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(null);
    }
  };

  const saveService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!serviceForm) return;
    const existingService = serviceForm.id
      ? dashboard?.services.find((service) => service.id === serviceForm.id)
      : undefined;
    if (
      existingService?.isActive &&
      !serviceForm.isActive &&
      !window.confirm(`Deactivate ${serviceForm.name}? Customers will no longer be able to select it.`)
    ) {
      return;
    }
    setSaving('service');
    setNotice(null);
    const service = {
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      durationMinutes: Number(serviceForm.durationMinutes),
      priceRupees: Number(serviceForm.priceRupees),
      isActive: serviceForm.isActive,
    };
    try {
      if (serviceForm.id) {
        await updateOwnerService(serviceForm.id, service);
      } else {
        await createOwnerService(service);
      }
      setServiceForm(null);
      setNotice({
        kind: 'success',
        text: serviceForm.id ? 'Service updated.' : 'Service added.',
      });
      await refresh(false);
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(null);
    }
  };

  const saveBarber = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!barberForm) return;
    const existingBarber = barberForm.id
      ? dashboard?.barbers.find((barber) => barber.id === barberForm.id)
      : undefined;
    if (
      existingBarber?.isActive &&
      !barberForm.isActive &&
      !window.confirm(`Deactivate ${barberForm.name}? They will no longer be assigned new customers.`)
    ) {
      return;
    }
    setSaving('barber');
    setNotice(null);
    try {
      if (barberForm.id) {
        await updateOwnerBarber(barberForm.id, {
          name: barberForm.name.trim(),
          photoUrl: barberForm.photoUrl.trim() || null,
          isActive: barberForm.isActive,
        });
      } else {
        await createOwnerBarber({
          name: barberForm.name.trim(),
          photoUrl: barberForm.photoUrl.trim() || null,
        });
      }
      setBarberForm(null);
      setNotice({
        kind: 'success',
        text: barberForm.id ? 'Barber profile updated.' : 'Barber added.',
      });
      await refresh(false);
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(null);
    }
  };

  const toggleService = async (service: SalonService) => {
    const nextActive = !service.isActive;
    const action = nextActive ? 'activate' : 'deactivate';
    if (
      !nextActive &&
      !window.confirm(`Deactivate ${service.name}? Customers will no longer be able to select it.`)
    ) {
      return;
    }
    setSaving(`service-${service.id}`);
    setNotice(null);
    try {
      await updateOwnerService(service.id, {
        name: service.name,
        description: service.description ?? null,
        durationMinutes: service.durationMinutes,
        priceRupees: service.priceRupees,
        isActive: nextActive,
      });
      setNotice({ kind: 'success', text: `Service ${action}d.` });
      await refresh(false);
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(null);
    }
  };

  const changeBarberStatus = async (
    barberId: string,
    status: Exclude<BarberStatus, 'busy'>,
  ) => {
    setSaving(`availability-${barberId}`);
    setNotice(null);
    try {
      await updateOwnerBarberStatus(barberId, status);
      setNotice({ kind: 'success', text: 'Barber availability updated.' });
      await refresh(false);
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(null);
    }
  };

  const changeSalonOpenState = async () => {
    if (!settingsDraft) return;
    const nextOpen = !settingsDraft.queueOpen;
    if (
      !nextOpen &&
      !window.confirm('Close the salon queue? New customers will not be able to join.')
    ) {
      return;
    }
    setSaving('salon-status');
    setNotice(null);
    try {
      const settings = await updateOwnerSettings({
        ...settingsDraft,
        queueOpen: nextOpen,
      });
      setSettingsDraft(settings);
      setNotice({
        kind: 'success',
        text: nextOpen ? 'Salon queue is open.' : 'Salon queue is closed.',
      });
      await refresh(false);
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(null);
    }
  };

  const saveStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!staffForm) return;
    setSaving('staff');
    setNotice(null);
    try {
      if (staffForm.id) {
        await updateStaffAccount(staffForm.id, {
          name: staffForm.name.trim(),
          email: staffForm.email.trim(),
          ...(staffForm.password ? { password: staffForm.password } : {}),
        });
      } else {
        await createStaffAccount({
          name: staffForm.name.trim(),
          email: staffForm.email.trim(),
          ...(staffForm.username.trim() ? { username: staffForm.username.trim() } : {}),
          password: staffForm.password,
          role: staffForm.role,
          ...(staffForm.role === 'BARBER' ? { barberId: staffForm.barberId } : {}),
        });
      }
      setStaffForm(null);
      setNotice({
        kind: 'success',
        text: staffForm.id ? 'Staff account updated.' : 'Staff account created.',
      });
      await refresh(false);
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(null);
    }
  };

  const toggleStaffActive = async (account: StaffAccount) => {
    const nextActive = !account.isActive;
    if (
      !nextActive &&
      !window.confirm(`Deactivate ${account.name}'s account? They will be signed out and unable to sign in.`)
    ) {
      return;
    }
    setSaving(`staff-${account.id}`);
    setNotice(null);
    try {
      await updateStaffAccount(account.id, {
        name: account.name,
        email: account.email,
        isActive: nextActive,
      });
      setNotice({
        kind: 'success',
        text: `Staff account ${nextActive ? 'activated' : 'deactivated'}.`,
      });
      await refresh(false);
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(null);
    }
  };

  const toggleWorkingDay = (day: number) => {
    if (!settingsDraft) return;
    const workingDays = settingsDraft.workingDays.includes(day)
      ? settingsDraft.workingDays.filter((currentDay) => currentDay !== day)
      : [...settingsDraft.workingDays, day];
    setSettingsDraft({ ...settingsDraft, workingDays });
  };

  return (
    <main className="min-h-screen bg-charcoal text-cream">
      <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-white/[0.08] bg-charcoal-deep lg:min-h-screen lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-5 py-5 lg:block lg:px-6 lg:py-8">
            <Link aria-label="Owner dashboard home" className="flex items-center gap-3" to="/">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/60 font-serif text-lg text-gold">
                {settingsDraft?.salonName.charAt(0).toLocaleUpperCase() || 'S'}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-cream">
                  {settingsDraft?.salonName || 'Salon'}
                </span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-gold">
                  Owner Studio
                </span>
              </span>
            </Link>
            <Link className={`${secondaryButtonClassName} lg:mt-8`} to="/">
              Back to site
            </Link>
          </div>
          <nav aria-label="Dashboard sections" className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:px-4 lg:pb-6">
            {[
              ['overview', 'Overview'],
              ['salon-information', 'Salon information'],
              ['services', 'Services'],
              ['barbers', 'Barber team'],
              ['staff-accounts', 'Staff accounts'],
              ['queue-settings', 'Queue settings'],
              ['business-hours', 'Business hours'],
            ].map(([id, label]) => (
              <a
                className="block shrink-0 rounded-xl px-4 py-3 text-xs text-stone-400 transition hover:bg-white/[0.05] hover:text-cream lg:mb-1"
                href={`#${id}`}
                key={id}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="hidden px-6 pb-8 lg:block">
            <div className="rounded-2xl border border-gold/15 bg-gold/[0.04] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                Owner access
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                Settings are saved to this salon&apos;s database.
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-8 lg:px-12">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                Salon management
              </p>
              <p className="mt-1 text-sm text-stone-400">Owner settings dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              {settingsDraft && (
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-medium uppercase tracking-wide ${
                  settingsDraft.queueOpen
                    ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
                    : 'border-rose-200/20 bg-rose-200/[0.05] text-rose-100'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${settingsDraft.queueOpen ? 'bg-emerald-300' : 'bg-rose-200'}`} />
                  {settingsDraft.queueOpen ? 'Salon open' : 'Salon closed'}
                </span>
              )}
              <Link className={secondaryButtonClassName} to="/reception">
                Reception
              </Link>
              <AccountActions />
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] px-5 pb-20 pt-8 sm:px-8 sm:pt-10 lg:px-12">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                  Good to see you
                </p>
                <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">
                  {settingsDraft?.salonName || 'Your salon'}
                </h1>
                <p className="mt-3 text-sm text-stone-500">
                  Manage your services, team, hours, and queue from one place.
                </p>
              </div>
              <button
                className={secondaryButtonClassName}
                disabled={loading}
                onClick={() => void refresh()}
                type="button"
              >
                {loading ? 'Refreshing…' : 'Refresh data'}
              </button>
            </div>

            {notice && (
              <div
                aria-live="polite"
                className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                  notice.kind === 'success'
                    ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100'
                    : 'border-rose-200/20 bg-rose-200/[0.05] text-rose-100'
                }`}
                role={notice.kind === 'error' ? 'alert' : 'status'}
              >
                {notice.text}
              </div>
            )}

            {pageError && (
              <div className="mb-7 rounded-2xl border border-rose-200/20 bg-rose-200/[0.05] p-5" role="alert">
                <p className="text-sm font-medium text-rose-100">Dashboard data unavailable</p>
                <p className="mt-2 text-sm text-rose-100/70">{pageError}</p>
                <button className={`${secondaryButtonClassName} mt-4`} onClick={() => void refresh()} type="button">
                  Retry
                </button>
              </div>
            )}

            {!dashboard && loading && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-6 py-16 text-center">
                <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
                <p className="mt-4 text-sm text-stone-400">Loading live salon data…</p>
              </div>
            )}

            {dashboard && (
              <>
                <section aria-labelledby="overview-title" className="scroll-mt-6" id="overview">
                  <SectionHeading
                    detail="A live snapshot of today’s salon activity and queue."
                    eyebrow="Today at a glance"
                    title="Overview"
                  />
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                    {[
                      {
                        label: 'Customers served',
                        value: dashboard.statistics.completed,
                        detail: 'Completed services today',
                        accent: true,
                      },
                      {
                        label: 'Waiting now',
                        value: dashboard.statistics.currentWaiting,
                        detail: 'Customers in the active queue',
                      },
                      {
                        label: 'Completed services',
                        value: dashboard.statistics.completedServiceCount,
                        detail: 'Individual services delivered today',
                      },
                      {
                        label: 'Active barbers',
                        value: dashboard.statistics.activeBarbers,
                        detail: `${dashboard.statistics.availableBarbers} currently available`,
                      },
                    ].map((metric) => (
                      <article
                        className={`rounded-2xl border p-5 ${
                          metric.accent
                            ? 'border-gold/25 bg-gold/[0.07]'
                            : 'border-white/[0.08] bg-white/[0.025]'
                        }`}
                        key={metric.label}
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400">
                          {metric.label}
                        </p>
                        <p className="mt-4 font-serif text-4xl text-cream">{metric.value}</p>
                        <p className="mt-2 text-xs text-stone-500">{metric.detail}</p>
                      </article>
                    ))}
                    {dashboard.statistics.averageWaitMinutes !== null && (
                      <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400">
                          Average wait
                        </p>
                        <p className="mt-4 font-serif text-4xl text-cream">
                          {dashboard.statistics.averageWaitMinutes}
                          <span className="ml-1 text-lg text-stone-400">min</span>
                        </p>
                        <p className="mt-2 text-xs text-stone-500">Observed from today&apos;s called queue entries</p>
                      </article>
                    )}
                  </div>
                </section>

                <section aria-labelledby="salon-information-title" className="mt-14 scroll-mt-6" id="salon-information">
                  <SectionHeading
                    detail="Keep the salon’s public details accurate. Changes are saved to the backend."
                    eyebrow="Business profile"
                    title="Salon information"
                  />
                  {settingsDraft && (
                    <form
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7"
                      onSubmit={(event) => void saveSettings('salon', 'Salon information saved.', event)}
                    >
                      <div className="grid gap-5 md:grid-cols-2">
                        <label className={labelClassName}>
                          Salon name
                          <input
                            className={inputClassName}
                            maxLength={100}
                            onChange={(event) => setSettingsDraft({ ...settingsDraft, salonName: event.target.value })}
                            required
                            value={settingsDraft.salonName}
                          />
                        </label>
                        <label className={labelClassName}>
                          Contact number
                          <input
                            autoComplete="tel"
                            className={inputClassName}
                            maxLength={30}
                            onChange={(event) => setSettingsDraft({ ...settingsDraft, contactNumber: event.target.value })}
                            placeholder="+1 555 123 4567"
                            value={settingsDraft.contactNumber}
                          />
                        </label>
                        <label className={`${labelClassName} md:col-span-2`}>
                          Salon address
                          <textarea
                            className={`${inputClassName} min-h-24 resize-y`}
                            maxLength={300}
                            onChange={(event) => setSettingsDraft({ ...settingsDraft, address: event.target.value })}
                            rows={3}
                            value={settingsDraft.address}
                          />
                        </label>
                      </div>
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
                        <p className="text-xs text-stone-500">Salon identity, hours, and queue status are stored in the salon settings table.</p>
                        <button className={buttonClassName} disabled={saving === 'salon'} type="submit">
                          {saving === 'salon' ? 'Saving…' : 'Save salon information'}
                        </button>
                      </div>
                    </form>
                  )}
                </section>

                <section aria-labelledby="services-title" className="mt-14 scroll-mt-6" id="services">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <SectionHeading
                      detail="Maintain the catalogue customers can choose from, including price and estimated duration."
                      eyebrow="What you offer"
                      title="Service management"
                    />
                    <button
                      className={`${buttonClassName} mb-6`}
                      onClick={() => setServiceForm({
                        id: null,
                        name: '',
                        description: '',
                        durationMinutes: '30',
                        priceRupees: '0',
                        isActive: true,
                      })}
                      type="button"
                    >
                      + Add service
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[690px] text-left">
                        <thead className="border-b border-white/[0.08] bg-white/[0.025] text-[10px] uppercase tracking-[0.14em] text-stone-500">
                          <tr>
                            <th className="px-5 py-4 font-medium">Service</th>
                            <th className="px-5 py-4 font-medium">Duration</th>
                            <th className="px-5 py-4 font-medium">Price</th>
                            <th className="px-5 py-4 font-medium">Status</th>
                            <th className="px-5 py-4 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {dashboard.services.map((service) => (
                            <tr className="text-sm" key={service.id}>
                              <td className="px-5 py-4">
                                <p className="font-medium text-cream">{service.name}</p>
                                <p className="mt-1 max-w-xs truncate text-xs text-stone-500">
                                  {service.description || 'No description'}
                                </p>
                              </td>
                              <td className="px-5 py-4 text-stone-300">{service.durationMinutes} min</td>
                              <td className="px-5 py-4 text-stone-300">₹{service.priceRupees}</td>
                              <td className="px-5 py-4">
                                <span className={`rounded-full px-2.5 py-1 text-[10px] ${service.isActive ? 'bg-emerald-300/[0.08] text-emerald-200' : 'bg-white/[0.06] text-stone-500'}`}>
                                  {service.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    className={secondaryButtonClassName}
                                    onClick={() => setServiceForm({
                                      id: service.id,
                                      name: service.name,
                                      description: service.description ?? '',
                                      durationMinutes: String(service.durationMinutes),
                                      priceRupees: String(service.priceRupees),
                                      isActive: Boolean(service.isActive),
                                    })}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className={secondaryButtonClassName}
                                    disabled={saving === `service-${service.id}`}
                                    onClick={() => void toggleService(service)}
                                    type="button"
                                  >
                                    {service.isActive ? 'Deactivate' : 'Activate'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {dashboard.services.length === 0 && (
                            <tr><td className="px-5 py-10 text-center text-sm text-stone-500" colSpan={5}>No services yet. Add the first service to get started.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section aria-labelledby="barbers-title" className="mt-14 scroll-mt-6" id="barbers">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <SectionHeading
                      detail="Manage profiles, active status, and day-to-day availability for your barber team."
                      eyebrow="Your people"
                      title="Barber management"
                    />
                    <button
                      className={`${buttonClassName} mb-6`}
                      onClick={() => setBarberForm({ id: null, name: '', photoUrl: '', isActive: true })}
                      type="button"
                    >
                      + Add barber
                    </button>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {dashboard.barbers.map((barber) => (
                      <BarberCard
                        barber={barber}
                        key={barber.id}
                        saving={saving}
                        onEdit={() => setBarberForm({
                          id: barber.id,
                          name: barber.name,
                          photoUrl: barber.photoUrl ?? '',
                          isActive: barber.isActive,
                        })}
                        onStatusChange={(status) => void changeBarberStatus(barber.id, status)}
                      />
                    ))}
                    {dashboard.barbers.length === 0 && (
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-10 text-center text-sm text-stone-500 xl:col-span-2">
                        No barbers have been added yet.
                      </div>
                    )}
                  </div>
                </section>

                <section aria-labelledby="staff-accounts-title" className="mt-14 scroll-mt-6" id="staff-accounts">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <SectionHeading
                      detail="Create receptionist and barber sign-in accounts. Deactivated accounts are signed out and cannot access staff tools."
                      eyebrow="Access control"
                      title="Staff accounts"
                    />
                    <button
                      className={`${buttonClassName} mb-6`}
                      onClick={() => setStaffForm({
                        id: null,
                        name: '',
                        email: '',
                        username: '',
                        password: '',
                        role: 'RECEPTIONIST',
                        barberId: '',
                      })}
                      type="button"
                    >
                      + Add staff account
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[690px] text-left">
                        <thead className="border-b border-white/[0.08] bg-white/[0.025] text-[10px] uppercase tracking-[0.14em] text-stone-500">
                          <tr>
                            <th className="px-5 py-4 font-medium">Staff member</th>
                            <th className="px-5 py-4 font-medium">Role</th>
                            <th className="px-5 py-4 font-medium">Status</th>
                            <th className="px-5 py-4 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {staffAccounts.map((account) => (
                            <tr className="text-sm" key={account.id}>
                              <td className="px-5 py-4">
                                <p className="font-medium text-cream">{account.name}</p>
                                <p className="mt-1 text-xs text-stone-500">
                                  {account.email}{account.username ? ` · @${account.username}` : ''}
                                </p>
                              </td>
                              <td className="px-5 py-4 text-stone-300">
                                {account.role === 'BARBER' ? 'Barber' : 'Receptionist'}
                                {account.role === 'BARBER' && (
                                  <span className="block mt-1 text-xs text-stone-500">
                                    {dashboard.barbers.find((barber) => barber.id === account.barberId)?.name ?? 'Linked barber'}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                <span className={`rounded-full px-2.5 py-1 text-[10px] ${account.isActive ? 'bg-emerald-300/[0.08] text-emerald-200' : 'bg-white/[0.06] text-stone-500'}`}>
                                  {account.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    className={secondaryButtonClassName}
                                    onClick={() => setStaffForm({
                                      id: account.id,
                                      name: account.name,
                                      email: account.email,
                                      username: account.username ?? '',
                                      password: '',
                                      role: account.role,
                                      barberId: account.barberId ?? '',
                                    })}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className={secondaryButtonClassName}
                                    disabled={saving === `staff-${account.id}`}
                                    onClick={() => void toggleStaffActive(account)}
                                    type="button"
                                  >
                                    {account.isActive ? 'Deactivate' : 'Activate'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {staffAccounts.length === 0 && (
                            <tr>
                              <td className="px-5 py-10 text-center text-sm text-stone-500" colSpan={4}>
                                No staff accounts yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section aria-labelledby="queue-settings-title" className="mt-14 scroll-mt-6" id="queue-settings">
                  <SectionHeading
                    detail="Control queue intake and optionally cap the number of customers waiting at once."
                    eyebrow="Queue controls"
                    title="Queue settings"
                  />
                  {settingsDraft && (
                    <form
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7"
                      onSubmit={(event) => void saveSettings('queue', 'Queue settings saved.', event)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-white/[0.08] pb-6">
                        <div>
                          <p className="text-sm font-medium text-cream">Salon queue status</p>
                          <p className="mt-1 text-xs leading-5 text-stone-500">
                            Closing pauses new customers; existing customers can still be served.
                          </p>
                        </div>
                        <button
                          className={settingsDraft.queueOpen ? secondaryButtonClassName : buttonClassName}
                          disabled={saving === 'salon-status'}
                          onClick={() => void changeSalonOpenState()}
                          type="button"
                        >
                          {settingsDraft.queueOpen ? 'Close queue' : 'Open queue'}
                        </button>
                      </div>
                      <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-end">
                        <label className={labelClassName}>
                          Maximum waiting capacity
                          <input
                            className={inputClassName}
                            max={1000}
                            min={1}
                            onChange={(event) => setSettingsDraft({
                              ...settingsDraft,
                              maxQueueCapacity: event.target.value ? Number(event.target.value) : null,
                            })}
                            placeholder="Unlimited"
                            type="number"
                            value={settingsDraft.maxQueueCapacity ?? ''}
                          />
                          <span className="mt-2 block text-[11px] leading-5 text-stone-500">
                            Blank means unlimited. Called and in-service customers are not counted toward this limit.
                          </span>
                        </label>
                        <p className="pb-3 text-xs leading-5 text-stone-500">
                          Service durations are managed with each service and are used by the queue wait estimator.
                        </p>
                      </div>
                      <div className="mt-5 flex justify-end">
                        <button className={buttonClassName} disabled={saving === 'queue'} type="submit">
                          {saving === 'queue' ? 'Saving…' : 'Save queue settings'}
                        </button>
                      </div>
                    </form>
                  )}
                </section>

                <section aria-labelledby="business-hours-title" className="mt-14 scroll-mt-6" id="business-hours">
                  <SectionHeading
                    detail="Record your regular opening schedule for staff and customers. The schedule does not automatically open or close queue intake."
                    eyebrow="When you are open"
                    title="Business hours"
                  />
                  {settingsDraft && (
                    <form
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7"
                      onSubmit={(event) => void saveSettings('hours', 'Business hours saved.', event)}
                    >
                      <div className="grid gap-5 sm:grid-cols-2">
                        <label className={labelClassName}>
                          Opening time
                          <input
                            className={inputClassName}
                            onChange={(event) => setSettingsDraft({ ...settingsDraft, openingTime: event.target.value })}
                            type="time"
                            value={settingsDraft.openingTime}
                          />
                        </label>
                        <label className={labelClassName}>
                          Closing time
                          <input
                            className={inputClassName}
                            onChange={(event) => setSettingsDraft({ ...settingsDraft, closingTime: event.target.value })}
                            type="time"
                            value={settingsDraft.closingTime}
                          />
                        </label>
                      </div>
                      <fieldset className="mt-6">
                        <legend className={labelClassName}>Working days</legend>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {weekDays.map((day) => {
                            const selected = settingsDraft.workingDays.includes(day.value);
                            return (
                              <label
                                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition ${
                                  selected
                                    ? 'border-gold/40 bg-gold/[0.08] text-gold-light'
                                    : 'border-white/10 bg-charcoal-deep text-stone-400'
                                }`}
                                key={day.value}
                              >
                                <input
                                  checked={selected}
                                  className="accent-gold"
                                  onChange={() => toggleWorkingDay(day.value)}
                                  type="checkbox"
                                />
                                {day.label}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
                        <p className="text-xs text-stone-500">
                          No selected days means the weekly schedule is not configured.
                        </p>
                        <button className={buttonClassName} disabled={saving === 'hours'} type="submit">
                          {saving === 'hours' ? 'Saving…' : 'Save business hours'}
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {serviceForm && (
        <Modal title={serviceForm.id ? 'Edit service' : 'Add service'} onClose={() => setServiceForm(null)}>
          <form className="space-y-4" onSubmit={(event) => void saveService(event)}>
            <label className={labelClassName}>
              Service name
              <input
                autoFocus
                className={inputClassName}
                maxLength={100}
                onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })}
                required
                value={serviceForm.name}
              />
            </label>
            <label className={labelClassName}>
              Description
              <textarea
                className={`${inputClassName} min-h-20 resize-y`}
                maxLength={500}
                onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })}
                value={serviceForm.description}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={labelClassName}>
                Duration (minutes)
                <input
                  className={inputClassName}
                  max={1440}
                  min={1}
                  onChange={(event) => setServiceForm({ ...serviceForm, durationMinutes: event.target.value })}
                  required
                  type="number"
                  value={serviceForm.durationMinutes}
                />
              </label>
              <label className={labelClassName}>
                Price (₹)
                <input
                  className={inputClassName}
                  min={0}
                  onChange={(event) => setServiceForm({ ...serviceForm, priceRupees: event.target.value })}
                  required
                  type="number"
                  value={serviceForm.priceRupees}
                />
              </label>
            </div>
            <label className="flex items-center gap-3 pt-1 text-xs text-stone-300">
              <input
                checked={serviceForm.isActive}
                className="accent-gold"
                onChange={(event) => setServiceForm({ ...serviceForm, isActive: event.target.checked })}
                type="checkbox"
              />
              Available to customers
            </label>
            <ModalActions
              busy={saving === 'service'}
              cancel={() => setServiceForm(null)}
              submitLabel={serviceForm.id ? 'Save changes' : 'Add service'}
            />
          </form>
        </Modal>
      )}

      {barberForm && (
        <Modal title={barberForm.id ? 'Edit barber profile' : 'Add barber'} onClose={() => setBarberForm(null)}>
          <form className="space-y-4" onSubmit={(event) => void saveBarber(event)}>
            <label className={labelClassName}>
              Barber name
              <input
                autoFocus
                className={inputClassName}
                maxLength={100}
                onChange={(event) => setBarberForm({ ...barberForm, name: event.target.value })}
                required
                value={barberForm.name}
              />
            </label>
            <label className={labelClassName}>
              Photo URL (optional)
              <input
                className={inputClassName}
                onChange={(event) => setBarberForm({ ...barberForm, photoUrl: event.target.value })}
                placeholder="https://…"
                type="url"
                value={barberForm.photoUrl}
              />
            </label>
            {barberForm.id && (
              <label className="flex items-center gap-3 pt-1 text-xs text-stone-300">
                <input
                  checked={barberForm.isActive}
                  className="accent-gold"
                  onChange={(event) => setBarberForm({ ...barberForm, isActive: event.target.checked })}
                  type="checkbox"
                />
                Active and available for new queue assignments
              </label>
            )}
            <ModalActions
              busy={saving === 'barber'}
              cancel={() => setBarberForm(null)}
              submitLabel={barberForm.id ? 'Save profile' : 'Add barber'}
            />
          </form>
        </Modal>
      )}

      {staffForm && (
        <Modal
          title={staffForm.id ? 'Edit staff account' : 'Create staff account'}
          onClose={() => setStaffForm(null)}
        >
          <form className="space-y-4" onSubmit={(event) => void saveStaff(event)}>
            <label className={labelClassName}>
              Name
              <input
                autoFocus
                className={inputClassName}
                maxLength={100}
                onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })}
                required
                value={staffForm.name}
              />
            </label>
            <label className={labelClassName}>
              Email
              <input
                autoComplete="email"
                className={inputClassName}
                onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })}
                required
                type="email"
                value={staffForm.email}
              />
            </label>
            {!staffForm.id && (
              <>
                <label className={labelClassName}>
                  Username (optional)
                  <input
                    autoComplete="username"
                    className={inputClassName}
                    maxLength={30}
                    onChange={(event) => setStaffForm({ ...staffForm, username: event.target.value })}
                    value={staffForm.username}
                  />
                </label>
                <label className={labelClassName}>
                  Temporary password
                  <input
                    autoComplete="new-password"
                    className={inputClassName}
                    minLength={12}
                    onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })}
                    required
                    type="password"
                    value={staffForm.password}
                  />
                </label>
                <label className={labelClassName}>
                  Role
                  <select
                    className={inputClassName}
                    onChange={(event) => setStaffForm({
                      ...staffForm,
                      role: event.target.value === 'BARBER' ? 'BARBER' : 'RECEPTIONIST',
                      barberId: '',
                    })}
                    value={staffForm.role}
                  >
                    <option value="RECEPTIONIST">Receptionist</option>
                    <option value="BARBER">Barber</option>
                  </select>
                </label>
                {staffForm.role === 'BARBER' && (
                  <label className={labelClassName}>
                    Barber profile
                    <select
                      className={inputClassName}
                      onChange={(event) => setStaffForm({ ...staffForm, barberId: event.target.value })}
                      required
                      value={staffForm.barberId}
                    >
                      <option value="">Select a barber profile</option>
                      {dashboard?.barbers
                        .filter((barber) =>
                          barber.isActive &&
                          !staffAccounts.some((account) => account.barberId === barber.id),
                        )
                        .map((barber) => (
                          <option key={barber.id} value={barber.id}>{barber.name}</option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {staffForm.id && (
              <>
                <p className="text-xs text-stone-500">
                  {staffForm.role === 'BARBER' ? 'Barber account' : 'Receptionist account'}
                  {staffForm.role === 'BARBER'
                    ? ` · ${dashboard?.barbers.find((barber) => barber.id === staffForm.barberId)?.name ?? 'Linked barber'}`
                    : ''}
                </p>
                <label className={labelClassName}>
                  Reset password (optional)
                  <input
                    autoComplete="new-password"
                    className={inputClassName}
                    minLength={12}
                    onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })}
                    placeholder="Leave blank to keep current password"
                    type="password"
                    value={staffForm.password}
                  />
                </label>
              </>
            )}
            <ModalActions
              busy={saving === 'staff'}
              cancel={() => setStaffForm(null)}
              submitLabel={staffForm.id ? 'Save account' : 'Create account'}
            />
          </form>
        </Modal>
      )}
    </main>
  );
}

function BarberCard({
  barber,
  saving,
  onEdit,
  onStatusChange,
}: {
  barber: OwnerBarber;
  saving: string | null;
  onEdit: () => void;
  onStatusChange: (status: Exclude<BarberStatus, 'busy'>) => void;
}) {
  const isSaving = saving === `availability-${barber.id}`;
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/25 bg-gold/[0.06] font-serif text-lg text-gold">
          {barber.photoUrl ? (
            <img alt="" className="h-full w-full object-cover" src={barber.photoUrl} />
          ) : (
            barber.name.charAt(0).toLocaleUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-cream">{barber.name}</p>
          <p className="mt-1 text-xs text-stone-500">
            {barber.isActive ? 'Active team member' : 'Inactive team member'}
            {barber.status === 'busy' ? ' · Serving a customer' : ''}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <select
          aria-label={`${barber.name} availability`}
          className="rounded-full border border-white/10 bg-charcoal-deep px-3 py-2.5 text-xs text-stone-300 outline-none focus:border-gold/50 disabled:opacity-50"
          disabled={!barber.isActive || barber.status === 'busy' || isSaving}
          onChange={(event) => {
            const status = event.target.value;
            if (status === 'available' || status === 'on_break') onStatusChange(status);
          }}
          value={barber.status}
        >
          <option value="available">Available</option>
          <option value="on_break">On break</option>
          <option disabled value="busy">Busy</option>
        </select>
        <button className={secondaryButtonClassName} onClick={onEdit} type="button">
          Edit profile
        </button>
      </div>
    </article>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="admin-modal-title"
        aria-modal="true"
        className="my-auto w-full max-w-lg rounded-3xl border border-white/10 bg-charcoal p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Management</p>
            <h2 className="mt-2 font-serif text-2xl text-cream" id="admin-modal-title">{title}</h2>
          </div>
          <button aria-label="Close dialog" className={secondaryButtonClassName} onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ModalActions({
  busy,
  cancel,
  submitLabel,
}: {
  busy: boolean;
  cancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-white/[0.08] pt-5">
      <button className={secondaryButtonClassName} disabled={busy} onClick={cancel} type="button">
        Cancel
      </button>
      <button className={buttonClassName} disabled={busy} type="submit">
        {busy ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

export default OwnerAdminPage;
