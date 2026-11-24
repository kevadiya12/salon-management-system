import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BarberSelectionSection from '../components/BarberSelectionSection';
import BookingSummary from '../components/BookingSummary';
import CustomerDetailsForm from '../components/CustomerDetailsForm';
import SalonBrand from '../components/SalonBrand';
import ServiceSelectionSection from '../components/ServiceSelectionSection';
import { requestQueueBooking } from '../services/queueBookingApi';
import { MAX_SELECTED_SERVICES } from '../services/salonServiceCatalog';
import { fetchSalonBarbers, fetchSalonServices } from '../services/salonApi';
import { salonConfig } from '../config/salon';
import { useAuth } from '../contexts/AuthContext';
import AccountActions from '../components/AccountActions';
import type { QueueFormErrors } from '../types/queue';
import type { SalonService } from '../types/queue';
import type { ReceptionBarber } from '../types/reception';

function JoinQueuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [salonServices, setSalonServices] = useState<SalonService[]>([]);
  const [barbers, setBarbers] = useState<
    Array<Pick<ReceptionBarber, 'id' | 'name' | 'status'>>
  >([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState(user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.customerPhoneNumber ?? '');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [errors, setErrors] = useState<QueueFormErrors>({});
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetchSalonServices(controller.signal),
      fetchSalonBarbers(controller.signal),
    ])
      .then(([services, salonBarbers]) => {
        setSalonServices(services);
        setBarbers(salonBarbers);
        setCatalogError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setCatalogError(
            error instanceof Error
              ? error.message
              : 'Salon services and barber information could not be loaded.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogLoading(false);
      });
    return () => controller.abort();
  }, []);

  const selectedServices = useMemo(
    () =>
      salonServices.filter((service) =>
        selectedServiceIds.includes(service.id),
      ),
    [selectedServiceIds],
  );
  const totalDuration = selectedServices.reduce(
    (total, service) => total + service.durationMinutes,
    0,
  );
  const totalPrice = selectedServices.reduce(
    (total, service) => total + service.priceRupees,
    0,
  );

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(value);
    setErrors((current) => ({ ...current, customerName: undefined }));
    setSubmissionMessage(null);
  };

  const handlePhoneNumberChange = (value: string) => {
    if (!/^\d*$/.test(value)) {
      setErrors((current) => ({
        ...current,
        phoneNumber: 'Use digits only for the phone number.',
      }));
      return;
    }

    setPhoneNumber(value);
    setErrors((current) => ({ ...current, phoneNumber: undefined }));
    setSubmissionMessage(null);
  };

  const handleServiceToggle = (serviceId: string) => {
    setSubmissionMessage(null);

    if (selectedServiceIds.includes(serviceId)) {
      setSelectedServiceIds((current) =>
        current.filter((selectedId) => selectedId !== serviceId),
      );
      setErrors((current) => ({ ...current, services: undefined }));
      return;
    }

    if (selectedServiceIds.length >= MAX_SELECTED_SERVICES) {
      setErrors((current) => ({
        ...current,
        services: `You can select up to ${MAX_SELECTED_SERVICES} services.`,
      }));
      return;
    }

    setSelectedServiceIds((current) => [...current, serviceId]);
    setErrors((current) => ({ ...current, services: undefined }));
  };

  const validateForm = (): boolean => {
    const nextErrors: QueueFormErrors = {};

    if (!customerName.trim()) {
      nextErrors.customerName = 'Enter your name.';
    }

    if (!phoneNumber) {
      nextErrors.phoneNumber = 'Enter your phone number.';
    } else if (!/^\d{10}$/.test(phoneNumber)) {
      nextErrors.phoneNumber = 'Phone number must contain exactly 10 digits.';
    }

    if (selectedServiceIds.length === 0) {
      nextErrors.services = 'Select at least one service.';
    } else if (selectedServiceIds.length > MAX_SELECTED_SERVICES) {
      nextErrors.services = `You can select up to ${MAX_SELECTED_SERVICES} services.`;
    }

    if (!selectedBarberId) {
      nextErrors.barber = 'Choose a barber option.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionMessage(null);

    if (!validateForm() || !selectedBarberId) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await requestQueueBooking({
        customerName: customerName.trim(),
        phoneNumber,
        serviceIds: selectedServiceIds,
        barberId: selectedBarberId,
      });

      if (result.status === 'success') {
        navigate(`/status/${encodeURIComponent(result.bookingId)}`);
        return;
      }

      setSubmissionMessage(result.message);
    } catch (error) {
      setSubmissionMessage(
        error instanceof Error
          ? `Unable to submit the queue request: ${error.message}`
          : 'Unable to submit the queue request right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-charcoal text-cream">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link
            aria-label={`${salonConfig.name} Queue home`}
            className="flex items-center gap-3"
            to="/"
          >
            <SalonBrand />
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-medium text-stone-300 transition hover:border-gold/60 hover:text-gold-light sm:text-sm"
            to="/"
          >
            <span aria-hidden="true">←</span>
            Back to Home
          </Link>
          <AccountActions />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:px-12">
        <div className="mb-9 max-w-2xl sm:mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
            Your next visit
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
            Join the Queue
          </h1>
          <p className="mt-4 text-sm leading-6 text-stone-400 sm:text-base sm:leading-7">
            Share a few details, choose your services, and review your visit
            before continuing.
          </p>
        </div>

        <form
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8"
          id="join-queue-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="space-y-5">
            <CustomerDetailsForm
              customerName={customerName}
              errors={errors}
              onCustomerNameChange={handleCustomerNameChange}
              onPhoneNumberChange={handlePhoneNumberChange}
              phoneNumber={phoneNumber}
              readOnly
            />
            <ServiceSelectionSection
              error={errors.services}
              onToggle={handleServiceToggle}
              selectedServiceIds={selectedServiceIds}
              services={salonServices}
            />
            {catalogError && (
              <p
                className="rounded-xl border border-rose-200/20 bg-rose-100/[0.05] px-4 py-3 text-xs leading-5 text-rose-100"
                role="alert"
              >
                Salon information could not be loaded: {catalogError}
              </p>
            )}
            <BarberSelectionSection
              barbers={barbers}
              error={errors.barber}
              loading={catalogLoading}
              onSelect={(barberId) => {
                setSelectedBarberId(barberId);
                setErrors((current) => ({ ...current, barber: undefined }));
                setSubmissionMessage(null);
              }}
              selectedBarberId={selectedBarberId}
            />
          </div>

          <BookingSummary
            isSubmitting={isSubmitting}
            selectedBarberId={selectedBarberId}
            selectedServices={selectedServices}
            submissionMessage={submissionMessage}
            totalDuration={totalDuration}
            totalPrice={totalPrice}
          />
        </form>

        <p aria-live="polite" className="sr-only">
          {Object.values(errors).filter(Boolean).join(' ')}
        </p>
      </div>
    </main>
  );
}

export default JoinQueuePage;
