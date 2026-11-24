import type { QueueFormErrors } from '../types/queue';

interface CustomerDetailsFormProps {
  customerName: string;
  phoneNumber: string;
  errors: QueueFormErrors;
  onCustomerNameChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  readOnly?: boolean;
}

const inputClassName =
  'mt-2 w-full rounded-xl border border-white/10 bg-charcoal-deep px-4 py-3.5 text-sm text-cream outline-none transition placeholder:text-stone-600 focus:border-gold/70 focus:ring-2 focus:ring-gold/15';

function CustomerDetailsForm({
  customerName,
  phoneNumber,
  errors,
  onCustomerNameChange,
  onPhoneNumberChange,
  readOnly = false,
}: CustomerDetailsFormProps) {
  return (
    <section
      aria-labelledby="customer-details-title"
      className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-7"
    >
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Your details
        </p>
        <h2
          className="mt-2 font-serif text-2xl text-cream"
          id="customer-details-title"
        >
          Customer information
        </h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-medium text-stone-200"
            htmlFor="customer-name"
          >
            Customer Name
          </label>
          <input
            autoComplete="name"
            className={inputClassName}
            id="customer-name"
            aria-describedby={
              errors.customerName ? 'customer-name-error' : undefined
            }
            aria-invalid={Boolean(errors.customerName)}
            name="customerName"
            onChange={(event) =>
              onCustomerNameChange(event.currentTarget.value)
            }
            placeholder="Enter your name"
            required
            readOnly={readOnly}
            value={customerName}
          />
          {errors.customerName && (
            <p className="mt-2 text-xs text-rose-300" id="customer-name-error">
              {errors.customerName}
            </p>
          )}
        </div>

        <div>
          <label
            className="text-sm font-medium text-stone-200"
            htmlFor="phone-number"
          >
            Phone Number
          </label>
          <input
            autoComplete="tel"
            className={inputClassName}
            id="phone-number"
            inputMode="numeric"
            aria-describedby={[
              'phone-number-help',
              errors.phoneNumber ? 'phone-number-error' : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={Boolean(errors.phoneNumber)}
            name="phoneNumber"
            onChange={(event) =>
              onPhoneNumberChange(event.currentTarget.value)
            }
            pattern="[0-9]*"
            placeholder="10-digit phone number"
            required
            readOnly={readOnly}
            type="tel"
            value={phoneNumber}
          />
          {errors.phoneNumber && (
            <p className="mt-2 text-xs text-rose-300" id="phone-number-error">
              {errors.phoneNumber}
            </p>
          )}
          <p className="mt-2 text-xs text-stone-500" id="phone-number-help">
            Enter exactly 10 digits.
          </p>
        </div>
      </div>
    </section>
  );
}

export default CustomerDetailsForm;
