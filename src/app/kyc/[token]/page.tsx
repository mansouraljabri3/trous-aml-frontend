'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Shield, Loader2, CheckCircle2, XCircle, ClipboardList, Building2, User } from 'lucide-react'
import { cn } from '@/lib/utils'

// This page is intentionally outside the (dashboard) route group — it is
// publicly accessible and requires no authentication.

interface KYCFormMeta {
  id:          number
  status:      'Generated' | 'Pending' | 'Approved' | 'Rejected'
  org_name_en: string
  org_name_ar: string
}

type CustomerType = 'individual' | 'corporate'

// Use the same env var as the authenticated axios instance so a single
// NEXT_PUBLIC_API_URL covers both authenticated and public API calls.
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1'

// ── Countries (ISO 3166-1 alpha-2) — GCC first, then alphabetical ──────────
// The backend validates nationality as a 2-letter alpha-2 code, so we use
// a dropdown rather than free text to guarantee a valid value is sent.

const COUNTRIES: { code: string; name: string }[] = [
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'QA', name: 'Qatar' },
  { code: 'OM', name: 'Oman' },
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CD', name: 'Congo, DR' },
  { code: 'CG', name: 'Congo, Republic' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: 'Korea, North' },
  { code: 'KR', name: 'Korea, South' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'São Tomé and Príncipe' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
]

export default function KYCFormPage() {
  const { token } = useParams<{ token: string }>()

  const [meta, setMeta]         = useState<KYCFormMeta | null>(null)
  const [loadErr, setLoadErr]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [submitErr, setSubmitErr]   = useState('')

  // Customer type toggle
  const [customerType, setCustomerType] = useState<CustomerType>('individual')

  // Individual fields
  const [fullName,    setFullName]    = useState('')
  const [nationalID,  setNationalID]  = useState('')
  const [nationality, setNationality] = useState('')

  // Corporate fields
  const [companyName,        setCompanyName]        = useState('')
  const [commercialRecord,   setCommercialRecord]   = useState('')
  const [representativeName, setRepresentativeName] = useState('')

  // Fetch form metadata on mount
  useEffect(() => {
    if (!token) return
    fetch(`${API}/kyc/public/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : 'error')
        return r.json()
      })
      .then((body) => setMeta(body.data as KYCFormMeta))
      .catch((e: Error) => setLoadErr(e.message === 'not_found' ? 'not_found' : 'error'))
      .finally(() => setLoading(false))
  }, [token])

  const isSubmitDisabled = () => {
    if (submitting) return true
    if (customerType === 'individual') {
      return !fullName || !nationalID || !nationality
    }
    return !companyName || !commercialRecord
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitErr('')
    setSubmitting(true)
    try {
      const payload =
        customerType === 'individual'
          ? { customer_type: 'individual', full_name: fullName, national_id: nationalID, nationality }
          : { customer_type: 'corporate', company_name: companyName, commercial_record: commercialRecord, representative_name: representativeName }

      const r = await fetch(`${API}/kyc/public/${token}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'submission_failed')
      }
      setSubmitted(true)
    } catch (err: unknown) {
      const msg = (err as Error).message
      if (msg === 'this KYC form has already been submitted') {
        setSubmitErr('This form has already been submitted.')
      } else {
        setSubmitErr('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </PageShell>
    )
  }

  // ── Not found ───────────────────────────────────────────────────────────
  if (loadErr === 'not_found' || !meta) {
    return (
      <PageShell>
        <StatusCard
          icon={<XCircle className="h-12 w-12 text-red-400" />}
          title="Form Not Found"
          message="This KYC link is invalid or has been removed. Please contact your organisation."
          color="red"
        />
      </PageShell>
    )
  }

  // ── Already submitted ────────────────────────────────────────────────────
  if (meta.status === 'Pending' || submitted) {
    return (
      <PageShell orgName={meta.org_name_en}>
        <StatusCard
          icon={<CheckCircle2 className="h-12 w-12 text-emerald-400" />}
          title="Submission Received"
          message="Thank you — your information has been submitted and is under review. You will be contacted once the verification is complete."
          color="green"
        />
      </PageShell>
    )
  }

  // ── Approved ─────────────────────────────────────────────────────────────
  if (meta.status === 'Approved') {
    return (
      <PageShell orgName={meta.org_name_en}>
        <StatusCard
          icon={<CheckCircle2 className="h-12 w-12 text-emerald-400" />}
          title="KYC Approved"
          message="Your identity verification has been approved. You are now a registered customer."
          color="green"
        />
      </PageShell>
    )
  }

  // ── Rejected ─────────────────────────────────────────────────────────────
  if (meta.status === 'Rejected') {
    return (
      <PageShell orgName={meta.org_name_en}>
        <StatusCard
          icon={<XCircle className="h-12 w-12 text-red-400" />}
          title="KYC Not Approved"
          message="Unfortunately your KYC application was not approved. Please contact your organisation for further information."
          color="red"
        />
      </PageShell>
    )
  }

  // ── Form (status === 'Generated') ────────────────────────────────────────
  return (
    <PageShell orgName={meta.org_name_en}>
      <div className="rounded-2xl bg-white/5 p-6 sm:p-8 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-indigo-300" />
          <h2 className="text-lg font-semibold text-white">KYC Verification Form</h2>
        </div>
        <p className="mb-6 text-sm text-indigo-200">
          <strong>{meta.org_name_en}</strong> requires the following information to verify your
          identity in accordance with AML regulations. All required fields are marked below.
        </p>

        {/* Customer type toggle */}
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-indigo-200">Customer Type</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCustomerType('individual')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition',
                customerType === 'individual'
                  ? 'border-indigo-400 bg-indigo-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-indigo-300 hover:border-white/20',
              )}
            >
              <User className="h-4 w-4" />
              Individual
            </button>
            <button
              type="button"
              onClick={() => setCustomerType('corporate')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition',
                customerType === 'corporate'
                  ? 'border-indigo-400 bg-indigo-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-indigo-300 hover:border-white/20',
              )}
            >
              <Building2 className="h-4 w-4" />
              Corporate
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          {customerType === 'individual' ? (
            <>
              <Field label="Full Legal Name *" id="full_name">
                <input
                  id="full_name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="As it appears on your ID"
                  required
                  disabled={submitting}
                  className={inputCls}
                />
              </Field>

              <Field label="National ID / Iqama Number *" id="national_id">
                <input
                  id="national_id"
                  type="text"
                  value={nationalID}
                  onChange={(e) => setNationalID(e.target.value)}
                  placeholder="e.g. 1234567890"
                  required
                  disabled={submitting}
                  className={inputCls}
                />
              </Field>

              <Field label="Nationality *" id="nationality">
                <select
                  id="nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  required
                  disabled={submitting}
                  className={cn(inputCls, 'cursor-pointer')}
                >
                  <option value="">— Select nationality —</option>
                  {COUNTRIES.map(({ code, name }) => (
                    <option key={code} value={code}>
                      {name} ({code})
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Company Name *" id="company_name">
                <input
                  id="company_name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Legal registered company name"
                  required
                  disabled={submitting}
                  className={inputCls}
                />
              </Field>

              <Field label="Commercial Registration Number *" id="commercial_record">
                <input
                  id="commercial_record"
                  type="text"
                  value={commercialRecord}
                  onChange={(e) => setCommercialRecord(e.target.value)}
                  placeholder="e.g. 1010XXXXXX"
                  required
                  disabled={submitting}
                  className={inputCls}
                />
              </Field>

              <Field label="Authorised Representative Name" id="representative_name">
                <input
                  id="representative_name"
                  type="text"
                  value={representativeName}
                  onChange={(e) => setRepresentativeName(e.target.value)}
                  placeholder="Optional"
                  disabled={submitting}
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {submitErr && (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
              {submitErr}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled()}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
              'bg-indigo-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20',
              'transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit KYC Information
          </button>
        </form>
      </div>
    </PageShell>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────

function PageShell({ children, orgName }: { children: React.ReactNode; orgName?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Trous</h1>
          {orgName && (
            <p className="mt-1 text-sm text-indigo-300">{orgName} — KYC Verification</p>
          )}
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-white/30">
          Trous AML Compliance Platform — All rights reserved
        </p>
      </div>
    </div>
  )
}

function StatusCard({
  icon,
  title,
  message,
  color,
}: {
  icon: React.ReactNode
  title: string
  message: string
  color: 'green' | 'red'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-8 text-center shadow-2xl ring-1 backdrop-blur-sm',
        color === 'green'
          ? 'bg-emerald-500/10 ring-emerald-500/20'
          : 'bg-red-500/10 ring-red-500/20',
      )}
    >
      <div className="mb-4 flex justify-center">{icon}</div>
      <h2 className="mb-2 text-lg font-semibold text-white">{title}</h2>
      <p className="text-sm text-slate-300">{message}</p>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-indigo-200">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = cn(
  'w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30',
  'border-white/10 outline-none transition',
  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
  'disabled:opacity-50',
)
