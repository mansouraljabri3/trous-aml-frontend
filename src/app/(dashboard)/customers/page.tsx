'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users,
  Plus,
  Pencil,
  User,
  Building2,
  Shield,
  Loader2,
  RefreshCw,
  X,
  Receipt,
  ArrowUpDown,
} from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface Customer {
  ID:                 number
  CreatedAt:          string
  OrgID:              number
  CustomerType:       'individual' | 'corporate'
  FullName:           string
  NationalID:         string
  Nationality:        string
  CompanyName:        string
  CommercialRecord:   string
  RepresentativeName: string
  RiskLevel:          RiskLevel
  IsUBO:              boolean
  PEPStatus:          string | null
  SanctionsStatus:    string | null
}

type TxStatus = 'pending' | 'completed' | 'flagged' | 'reversed'
type TxType   = 'deposit' | 'withdrawal' | 'transfer' | 'payment'

interface Transaction {
  ID:        number
  CreatedAt: string
  Amount:    number
  Currency:  string
  TxType:    TxType
  TxDate:    string
  Status:    TxStatus
  Reference: string
  Notes:     string
}

const TX_STATUS_BADGE: Record<TxStatus, string> = {
  pending:   'bg-slate-100  text-slate-600',
  completed: 'bg-emerald-100 text-emerald-700',
  flagged:   'bg-red-100    text-red-700',
  reversed:  'bg-orange-100 text-orange-700',
}

const TX_CURRENCIES = ['SAR', 'AED', 'USD', 'EUR', 'GBP', 'KWD', 'BHD', 'QAR', 'OMR', 'EGP', 'JOD', 'PKR', 'INR', 'BDT', 'PHP']

const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const
type RiskLevel = typeof RISK_LEVELS[number]

const RISK_BADGE: Record<RiskLevel, string> = {
  Low:      'bg-emerald-100 text-emerald-700',
  Medium:   'bg-amber-100   text-amber-700',
  High:     'bg-orange-100  text-orange-700',
  Critical: 'bg-red-100     text-red-700',
}

const RISK_SELECTED: Record<RiskLevel, string> = {
  Low:      'border-emerald-400 bg-emerald-50 text-emerald-700',
  Medium:   'border-amber-400   bg-amber-50   text-amber-700',
  High:     'border-orange-400  bg-orange-50  text-orange-700',
  Critical: 'border-red-500     bg-red-50     text-red-700',
}

// ── Countries (ISO 3166-1 alpha-2) — GCC first, then alphabetical ──────────

const COUNTRIES: { code: string; name: string; nameAr: string }[] = [
  // GCC
  { code: 'SA', name: 'Saudi Arabia',               nameAr: 'المملكة العربية السعودية' },
  { code: 'AE', name: 'United Arab Emirates',        nameAr: 'الإمارات العربية المتحدة' },
  { code: 'KW', name: 'Kuwait',                      nameAr: 'الكويت' },
  { code: 'BH', name: 'Bahrain',                     nameAr: 'البحرين' },
  { code: 'QA', name: 'Qatar',                       nameAr: 'قطر' },
  { code: 'OM', name: 'Oman',                        nameAr: 'عُمان' },
  // Rest — alphabetical by English name
  { code: 'AF', name: 'Afghanistan',                 nameAr: 'أفغانستان' },
  { code: 'AL', name: 'Albania',                     nameAr: 'ألبانيا' },
  { code: 'DZ', name: 'Algeria',                     nameAr: 'الجزائر' },
  { code: 'AD', name: 'Andorra',                     nameAr: 'أندورا' },
  { code: 'AO', name: 'Angola',                      nameAr: 'أنغولا' },
  { code: 'AG', name: 'Antigua and Barbuda',          nameAr: 'أنتيغوا وبربودا' },
  { code: 'AR', name: 'Argentina',                   nameAr: 'الأرجنتين' },
  { code: 'AM', name: 'Armenia',                     nameAr: 'أرمينيا' },
  { code: 'AU', name: 'Australia',                   nameAr: 'أستراليا' },
  { code: 'AT', name: 'Austria',                     nameAr: 'النمسا' },
  { code: 'AZ', name: 'Azerbaijan',                  nameAr: 'أذربيجان' },
  { code: 'BS', name: 'Bahamas',                     nameAr: 'جزر البهاما' },
  { code: 'BD', name: 'Bangladesh',                  nameAr: 'بنغلاديش' },
  { code: 'BY', name: 'Belarus',                     nameAr: 'بيلاروسيا' },
  { code: 'BE', name: 'Belgium',                     nameAr: 'بلجيكا' },
  { code: 'BZ', name: 'Belize',                      nameAr: 'بليز' },
  { code: 'BJ', name: 'Benin',                       nameAr: 'بنين' },
  { code: 'BT', name: 'Bhutan',                      nameAr: 'بوتان' },
  { code: 'BO', name: 'Bolivia',                     nameAr: 'بوليفيا' },
  { code: 'BA', name: 'Bosnia and Herzegovina',       nameAr: 'البوسنة والهرسك' },
  { code: 'BW', name: 'Botswana',                    nameAr: 'بوتسوانا' },
  { code: 'BR', name: 'Brazil',                      nameAr: 'البرازيل' },
  { code: 'BN', name: 'Brunei',                      nameAr: 'بروناي' },
  { code: 'BG', name: 'Bulgaria',                    nameAr: 'بلغاريا' },
  { code: 'BF', name: 'Burkina Faso',                nameAr: 'بوركينا فاسو' },
  { code: 'BI', name: 'Burundi',                     nameAr: 'بوروندي' },
  { code: 'CV', name: 'Cabo Verde',                  nameAr: 'الرأس الأخضر' },
  { code: 'KH', name: 'Cambodia',                    nameAr: 'كمبوديا' },
  { code: 'CM', name: 'Cameroon',                    nameAr: 'الكاميرون' },
  { code: 'CA', name: 'Canada',                      nameAr: 'كندا' },
  { code: 'CF', name: 'Central African Republic',    nameAr: 'جمهورية أفريقيا الوسطى' },
  { code: 'TD', name: 'Chad',                        nameAr: 'تشاد' },
  { code: 'CL', name: 'Chile',                       nameAr: 'تشيلي' },
  { code: 'CN', name: 'China',                       nameAr: 'الصين' },
  { code: 'CO', name: 'Colombia',                    nameAr: 'كولومبيا' },
  { code: 'KM', name: 'Comoros',                     nameAr: 'جزر القمر' },
  { code: 'CD', name: 'Congo, DR',                   nameAr: 'الكونغو الديمقراطية' },
  { code: 'CG', name: 'Congo, Republic',             nameAr: 'جمهورية الكونغو' },
  { code: 'CR', name: 'Costa Rica',                  nameAr: 'كوستاريكا' },
  { code: 'HR', name: 'Croatia',                     nameAr: 'كرواتيا' },
  { code: 'CU', name: 'Cuba',                        nameAr: 'كوبا' },
  { code: 'CY', name: 'Cyprus',                      nameAr: 'قبرص' },
  { code: 'CZ', name: 'Czech Republic',              nameAr: 'جمهورية التشيك' },
  { code: 'DK', name: 'Denmark',                     nameAr: 'الدنمارك' },
  { code: 'DJ', name: 'Djibouti',                    nameAr: 'جيبوتي' },
  { code: 'DO', name: 'Dominican Republic',           nameAr: 'جمهورية الدومينيكان' },
  { code: 'EC', name: 'Ecuador',                     nameAr: 'الإكوادور' },
  { code: 'EG', name: 'Egypt',                       nameAr: 'مصر' },
  { code: 'SV', name: 'El Salvador',                 nameAr: 'السلفادور' },
  { code: 'GQ', name: 'Equatorial Guinea',           nameAr: 'غينيا الاستوائية' },
  { code: 'ER', name: 'Eritrea',                     nameAr: 'إريتريا' },
  { code: 'EE', name: 'Estonia',                     nameAr: 'إستونيا' },
  { code: 'SZ', name: 'Eswatini',                    nameAr: 'إسواتيني' },
  { code: 'ET', name: 'Ethiopia',                    nameAr: 'إثيوبيا' },
  { code: 'FJ', name: 'Fiji',                        nameAr: 'فيجي' },
  { code: 'FI', name: 'Finland',                     nameAr: 'فنلندا' },
  { code: 'FR', name: 'France',                      nameAr: 'فرنسا' },
  { code: 'GA', name: 'Gabon',                       nameAr: 'الغابون' },
  { code: 'GM', name: 'Gambia',                      nameAr: 'غامبيا' },
  { code: 'GE', name: 'Georgia',                     nameAr: 'جورجيا' },
  { code: 'DE', name: 'Germany',                     nameAr: 'ألمانيا' },
  { code: 'GH', name: 'Ghana',                       nameAr: 'غانا' },
  { code: 'GR', name: 'Greece',                      nameAr: 'اليونان' },
  { code: 'GT', name: 'Guatemala',                   nameAr: 'غواتيمالا' },
  { code: 'GN', name: 'Guinea',                      nameAr: 'غينيا' },
  { code: 'GW', name: 'Guinea-Bissau',               nameAr: 'غينيا بيساو' },
  { code: 'GY', name: 'Guyana',                      nameAr: 'غيانا' },
  { code: 'HT', name: 'Haiti',                       nameAr: 'هايتي' },
  { code: 'HN', name: 'Honduras',                    nameAr: 'هندوراس' },
  { code: 'HU', name: 'Hungary',                     nameAr: 'المجر' },
  { code: 'IS', name: 'Iceland',                     nameAr: 'آيسلندا' },
  { code: 'IN', name: 'India',                       nameAr: 'الهند' },
  { code: 'ID', name: 'Indonesia',                   nameAr: 'إندونيسيا' },
  { code: 'IR', name: 'Iran',                        nameAr: 'إيران' },
  { code: 'IQ', name: 'Iraq',                        nameAr: 'العراق' },
  { code: 'IE', name: 'Ireland',                     nameAr: 'أيرلندا' },
  { code: 'IL', name: 'Israel',                      nameAr: 'إسرائيل' },
  { code: 'IT', name: 'Italy',                       nameAr: 'إيطاليا' },
  { code: 'JM', name: 'Jamaica',                     nameAr: 'جامايكا' },
  { code: 'JP', name: 'Japan',                       nameAr: 'اليابان' },
  { code: 'JO', name: 'Jordan',                      nameAr: 'الأردن' },
  { code: 'KZ', name: 'Kazakhstan',                  nameAr: 'كازاخستان' },
  { code: 'KE', name: 'Kenya',                       nameAr: 'كينيا' },
  { code: 'KI', name: 'Kiribati',                    nameAr: 'كيريباتي' },
  { code: 'KP', name: 'Korea, North',                nameAr: 'كوريا الشمالية' },
  { code: 'KR', name: 'Korea, South',                nameAr: 'كوريا الجنوبية' },
  { code: 'XK', name: 'Kosovo',                      nameAr: 'كوسوفو' },
  { code: 'KG', name: 'Kyrgyzstan',                  nameAr: 'قيرغيزستان' },
  { code: 'LA', name: 'Laos',                        nameAr: 'لاوس' },
  { code: 'LV', name: 'Latvia',                      nameAr: 'لاتفيا' },
  { code: 'LB', name: 'Lebanon',                     nameAr: 'لبنان' },
  { code: 'LS', name: 'Lesotho',                     nameAr: 'ليسوتو' },
  { code: 'LR', name: 'Liberia',                     nameAr: 'ليبيريا' },
  { code: 'LY', name: 'Libya',                       nameAr: 'ليبيا' },
  { code: 'LI', name: 'Liechtenstein',               nameAr: 'ليختنشتاين' },
  { code: 'LT', name: 'Lithuania',                   nameAr: 'ليتوانيا' },
  { code: 'LU', name: 'Luxembourg',                  nameAr: 'لوكسمبورغ' },
  { code: 'MG', name: 'Madagascar',                  nameAr: 'مدغشقر' },
  { code: 'MW', name: 'Malawi',                      nameAr: 'ملاوي' },
  { code: 'MY', name: 'Malaysia',                    nameAr: 'ماليزيا' },
  { code: 'MV', name: 'Maldives',                    nameAr: 'جزر المالديف' },
  { code: 'ML', name: 'Mali',                        nameAr: 'مالي' },
  { code: 'MT', name: 'Malta',                       nameAr: 'مالطا' },
  { code: 'MH', name: 'Marshall Islands',            nameAr: 'جزر مارشال' },
  { code: 'MR', name: 'Mauritania',                  nameAr: 'موريتانيا' },
  { code: 'MU', name: 'Mauritius',                   nameAr: 'موريشيوس' },
  { code: 'MX', name: 'Mexico',                      nameAr: 'المكسيك' },
  { code: 'FM', name: 'Micronesia',                  nameAr: 'ميكرونيزيا' },
  { code: 'MD', name: 'Moldova',                     nameAr: 'مولدوفا' },
  { code: 'MC', name: 'Monaco',                      nameAr: 'موناكو' },
  { code: 'MN', name: 'Mongolia',                    nameAr: 'منغوليا' },
  { code: 'ME', name: 'Montenegro',                  nameAr: 'الجبل الأسود' },
  { code: 'MA', name: 'Morocco',                     nameAr: 'المغرب' },
  { code: 'MZ', name: 'Mozambique',                  nameAr: 'موزمبيق' },
  { code: 'MM', name: 'Myanmar',                     nameAr: 'ميانمار' },
  { code: 'NA', name: 'Namibia',                     nameAr: 'ناميبيا' },
  { code: 'NR', name: 'Nauru',                       nameAr: 'ناورو' },
  { code: 'NP', name: 'Nepal',                       nameAr: 'نيبال' },
  { code: 'NL', name: 'Netherlands',                 nameAr: 'هولندا' },
  { code: 'NZ', name: 'New Zealand',                 nameAr: 'نيوزيلندا' },
  { code: 'NI', name: 'Nicaragua',                   nameAr: 'نيكاراغوا' },
  { code: 'NE', name: 'Niger',                       nameAr: 'النيجر' },
  { code: 'NG', name: 'Nigeria',                     nameAr: 'نيجيريا' },
  { code: 'MK', name: 'North Macedonia',             nameAr: 'مقدونيا الشمالية' },
  { code: 'NO', name: 'Norway',                      nameAr: 'النرويج' },
  { code: 'PK', name: 'Pakistan',                    nameAr: 'باكستان' },
  { code: 'PW', name: 'Palau',                       nameAr: 'بالاو' },
  { code: 'PS', name: 'Palestine',                   nameAr: 'فلسطين' },
  { code: 'PA', name: 'Panama',                      nameAr: 'بنما' },
  { code: 'PG', name: 'Papua New Guinea',            nameAr: 'بابوا غينيا الجديدة' },
  { code: 'PY', name: 'Paraguay',                    nameAr: 'باراغواي' },
  { code: 'PE', name: 'Peru',                        nameAr: 'بيرو' },
  { code: 'PH', name: 'Philippines',                 nameAr: 'الفلبين' },
  { code: 'PL', name: 'Poland',                      nameAr: 'بولندا' },
  { code: 'PT', name: 'Portugal',                    nameAr: 'البرتغال' },
  { code: 'RO', name: 'Romania',                     nameAr: 'رومانيا' },
  { code: 'RU', name: 'Russia',                      nameAr: 'روسيا' },
  { code: 'RW', name: 'Rwanda',                      nameAr: 'رواندا' },
  { code: 'KN', name: 'Saint Kitts and Nevis',       nameAr: 'سانت كيتس ونيفيس' },
  { code: 'LC', name: 'Saint Lucia',                 nameAr: 'سانت لوسيا' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', nameAr: 'سانت فنسنت وغرينادين' },
  { code: 'WS', name: 'Samoa',                       nameAr: 'ساموا' },
  { code: 'SM', name: 'San Marino',                  nameAr: 'سان مارينو' },
  { code: 'ST', name: 'São Tomé and Príncipe',       nameAr: 'ساو تومي وبرينسيبي' },
  { code: 'SN', name: 'Senegal',                     nameAr: 'السنغال' },
  { code: 'RS', name: 'Serbia',                      nameAr: 'صربيا' },
  { code: 'SC', name: 'Seychelles',                  nameAr: 'سيشل' },
  { code: 'SL', name: 'Sierra Leone',                nameAr: 'سيراليون' },
  { code: 'SG', name: 'Singapore',                   nameAr: 'سنغافورة' },
  { code: 'SK', name: 'Slovakia',                    nameAr: 'سلوفاكيا' },
  { code: 'SI', name: 'Slovenia',                    nameAr: 'سلوفينيا' },
  { code: 'SB', name: 'Solomon Islands',             nameAr: 'جزر سليمان' },
  { code: 'SO', name: 'Somalia',                     nameAr: 'الصومال' },
  { code: 'ZA', name: 'South Africa',                nameAr: 'جنوب أفريقيا' },
  { code: 'SS', name: 'South Sudan',                 nameAr: 'جنوب السودان' },
  { code: 'ES', name: 'Spain',                       nameAr: 'إسبانيا' },
  { code: 'LK', name: 'Sri Lanka',                   nameAr: 'سريلانكا' },
  { code: 'SD', name: 'Sudan',                       nameAr: 'السودان' },
  { code: 'SR', name: 'Suriname',                    nameAr: 'سورينام' },
  { code: 'SE', name: 'Sweden',                      nameAr: 'السويد' },
  { code: 'CH', name: 'Switzerland',                 nameAr: 'سويسرا' },
  { code: 'SY', name: 'Syria',                       nameAr: 'سوريا' },
  { code: 'TW', name: 'Taiwan',                      nameAr: 'تايوان' },
  { code: 'TJ', name: 'Tajikistan',                  nameAr: 'طاجيكستان' },
  { code: 'TZ', name: 'Tanzania',                    nameAr: 'تنزانيا' },
  { code: 'TH', name: 'Thailand',                    nameAr: 'تايلاند' },
  { code: 'TL', name: 'Timor-Leste',                 nameAr: 'تيمور الشرقية' },
  { code: 'TG', name: 'Togo',                        nameAr: 'توغو' },
  { code: 'TO', name: 'Tonga',                       nameAr: 'تونغا' },
  { code: 'TT', name: 'Trinidad and Tobago',         nameAr: 'ترينيداد وتوباغو' },
  { code: 'TN', name: 'Tunisia',                     nameAr: 'تونس' },
  { code: 'TR', name: 'Turkey',                      nameAr: 'تركيا' },
  { code: 'TM', name: 'Turkmenistan',                nameAr: 'تركمانستان' },
  { code: 'TV', name: 'Tuvalu',                      nameAr: 'توفالو' },
  { code: 'UG', name: 'Uganda',                      nameAr: 'أوغندا' },
  { code: 'UA', name: 'Ukraine',                     nameAr: 'أوكرانيا' },
  { code: 'GB', name: 'United Kingdom',              nameAr: 'المملكة المتحدة' },
  { code: 'US', name: 'United States',               nameAr: 'الولايات المتحدة' },
  { code: 'UY', name: 'Uruguay',                     nameAr: 'أوروغواي' },
  { code: 'UZ', name: 'Uzbekistan',                  nameAr: 'أوزبكستان' },
  { code: 'VU', name: 'Vanuatu',                     nameAr: 'فانواتو' },
  { code: 'VE', name: 'Venezuela',                   nameAr: 'فنزويلا' },
  { code: 'VN', name: 'Vietnam',                     nameAr: 'فيتنام' },
  { code: 'YE', name: 'Yemen',                       nameAr: 'اليمن' },
  { code: 'ZM', name: 'Zambia',                      nameAr: 'زامبيا' },
  { code: 'ZW', name: 'Zimbabwe',                    nameAr: 'زيمبابوي' },
]

// ── Saudi ID validation ─────────────────────────────────────────────────────
// Returns an error string (localised) or '' for valid / empty input.

function validateSaudiID(id: string, isAr: boolean): string {
  if (!id) return ''
  if (!/^\d{10}$/.test(id)) {
    return isAr
      ? 'يجب أن يكون رقم الهوية 10 أرقام بالضبط'
      : 'ID must be exactly 10 digits'
  }
  if (!['1', '2', '7'].includes(id[0])) {
    return isAr
      ? 'يجب أن يبدأ بـ 1 (هوية وطنية) أو 2 (إقامة) أو 7 (رقم موحد)'
      : 'Must start with 1 (National ID), 2 (Iqama), or 7 (Unified Number)'
  }
  return ''
}

// ── Form state ─────────────────────────────────────────────────────────────

type CustomerType = 'individual' | 'corporate'

interface FormState {
  customerType:       CustomerType
  fullName:           string
  nationalID:         string
  nationality:        string
  companyName:        string
  commercialRecord:   string
  representativeName: string
  riskLevel:          RiskLevel
  isUBO:              boolean
}

const EMPTY_FORM: FormState = {
  customerType:       'individual',
  fullName:           '',
  nationalID:         '',
  nationality:        '',
  companyName:        '',
  commercialRecord:   '',
  representativeName: '',
  riskLevel:          'Low',
  isUBO:              false,
}

// ── Helpers ────────────────────────────────────────────────────────────────

const displayName = (c: Customer) =>
  c.CustomerType === 'corporate' ? c.CompanyName : c.FullName

const displaySub = (c: Customer) =>
  c.CustomerType === 'corporate' ? c.CommercialRecord : c.NationalID

// ── Page ───────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { language } = useAuthStore()
  const isAr = language === 'ar'

  // ── List state ──────────────────────────────────────────────────────────
  const [customers, setCustomers]     = useState<Customer[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [typeFilter, setTypeFilter]   = useState<CustomerType | ''>('')
  const [riskFilter, setRiskFilter]   = useState<RiskLevel | ''>('')
  const [loading, setLoading]         = useState(true)
  const [fetchErr, setFetchErr]       = useState(false)

  // ── Modal state ─────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Customer | null>(null)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [saveErr, setSaveErr]         = useState('')
  const [txnCustomer, setTxnCustomer] = useState<Customer | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setFetchErr(false)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (typeFilter) params.set('customer_type', typeFilter)
      if (riskFilter) params.set('risk_level', riskFilter)
      const { data } = await api.get(`/customers?${params}`)
      setCustomers((data.data.items ?? []) as Customer[])
      setTotal(data.data.total ?? 0)
    } catch {
      setFetchErr(true)
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, riskFilter])

  useEffect(() => { load() }, [load])

  // Reset to page 1 when filters change
  const applyTypeFilter = (val: CustomerType | '') => {
    setTypeFilter(val)
    setPage(1)
  }
  const applyRiskFilter = (val: RiskLevel | '') => {
    setRiskFilter(val)
    setPage(1)
  }

  // ── Open modal ───────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setSaveErr('')
    setModalOpen(true)
  }

  const openEdit = (c: Customer) => {
    setEditing(c)
    setForm({
      customerType:       c.CustomerType,
      fullName:           c.FullName           ?? '',
      nationalID:         c.NationalID         ?? '',
      nationality:        c.Nationality        ?? '',
      companyName:        c.CompanyName        ?? '',
      commercialRecord:   c.CommercialRecord   ?? '',
      representativeName: c.RepresentativeName ?? '',
      riskLevel:          c.RiskLevel,
      isUBO:              c.IsUBO,
    })
    setSaveErr('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setSaveErr('')
    try {
      if (editing) {
        // PUT — partial update, only type-appropriate fields + common fields
        const body: Record<string, unknown> = { risk_level: form.riskLevel }
        if (editing.CustomerType === 'individual') {
          body.full_name   = form.fullName
          body.national_id = form.nationalID
          body.nationality = form.nationality
          // is_ubo is not sent — backend enforces false for individual
        } else {
          body.company_name         = form.companyName
          body.commercial_record    = form.commercialRecord
          body.representative_name  = form.representativeName
          body.is_ubo               = form.isUBO
        }
        await api.put(`/customers/${editing.ID}`, body)
      } else {
        // POST — all fields
        const body: Record<string, unknown> = {
          customer_type: form.customerType,
          risk_level:    form.riskLevel,
        }
        if (form.customerType === 'individual') {
          body.full_name   = form.fullName
          body.national_id = form.nationalID
          body.nationality = form.nationality
          // is_ubo is not sent — backend enforces false for individual
        } else {
          body.company_name         = form.companyName
          body.commercial_record    = form.commercialRecord
          body.representative_name  = form.representativeName
          body.is_ubo               = form.isUBO
        }
        await api.post('/customers', body)
      }
      closeModal()
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setSaveErr(msg ?? (isAr ? 'فشل حفظ بيانات العميل.' : 'Failed to save customer.'))
    } finally {
      setSaving(false)
    }
  }

  const isSaveDisabled = (): boolean => {
    if (saving) return true
    const type = editing ? editing.CustomerType : form.customerType
    if (type === 'individual') {
      return (
        !form.fullName.trim() ||
        !form.nationalID.trim() ||
        !form.nationality.trim() ||
        !!validateSaudiID(form.nationalID, isAr)
      )
    }
    return !form.companyName.trim() || !form.commercialRecord.trim()
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Users className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {isAr ? 'العملاء' : 'Customers'}
          </h1>
          {total > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title={isAr ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'إضافة عميل' : 'Add Customer'}
          </button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {/* Type filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-400">
            {isAr ? 'النوع:' : 'Type:'}
          </span>
          {([['', isAr ? 'الكل' : 'All'], ['individual', isAr ? 'فرد' : 'Individual'], ['corporate', isAr ? 'شركة' : 'Corporate']] as [CustomerType | '', string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => applyTypeFilter(val)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                typeFilter === val
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Risk filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-400">
            {isAr ? 'المخاطر:' : 'Risk:'}
          </span>
          {([['', isAr ? 'الكل' : 'All'], ...RISK_LEVELS.map((r) => [r, r])] as [RiskLevel | '', string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => applyRiskFilter(val as RiskLevel | '')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                riskFilter === val
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {fetchErr && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {isAr ? 'فشل تحميل العملاء. حاول مرة أخرى.' : 'Failed to load customers. Please try again.'}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState isAr={isAr} hasFilters={!!(typeFilter || riskFilter)} onAdd={openAdd} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500 rtl:text-right">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="px-4 py-3">{isAr ? 'الاسم / الشركة' : 'Name / Company'}</th>
                  <th className="hidden px-4 py-3 sm:table-cell">{isAr ? 'الهوية / السجل' : 'ID / CR'}</th>
                  <th className="hidden px-4 py-3 md:table-cell">{isAr ? 'الجنسية' : 'Nationality'}</th>
                  <th className="px-4 py-3">{isAr ? 'المخاطر' : 'Risk'}</th>
                  <th className="hidden px-4 py-3 lg:table-cell">UBO</th>
                  <th className="px-4 py-3">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {customers.map((c) => (
                  <tr key={c.ID} className="group hover:bg-slate-50/60">

                    {/* ID */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      #{c.ID}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <TypeBadge type={c.CustomerType} isAr={isAr} />
                    </td>

                    {/* Primary name + secondary ID */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {displayName(c) || <span className="italic text-slate-300">—</span>}
                      </p>
                      {displaySub(c) && (
                        <p className="font-mono text-xs text-slate-400">{displaySub(c)}</p>
                      )}
                    </td>

                    {/* National ID or CR (hidden on mobile) */}
                    <td className="hidden px-4 py-3 font-mono text-xs text-slate-600 sm:table-cell">
                      {(c.CustomerType === 'corporate' ? c.CommercialRecord : c.NationalID) || (
                        <span className="italic text-slate-300">—</span>
                      )}
                    </td>

                    {/* Nationality — only meaningful for individuals (hidden on tablet) */}
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {c.CustomerType === 'individual'
                        ? c.Nationality || <span className="italic text-slate-300">—</span>
                        : <span className="italic text-slate-300">—</span>}
                    </td>

                    {/* Risk level badge */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        RISK_BADGE[c.RiskLevel],
                      )}>
                        {c.RiskLevel}
                      </span>
                    </td>

                    {/* UBO badge (hidden on small screens) */}
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {c.IsUBO && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          <Shield className="h-3 w-3" />
                          UBO
                        </span>
                      )}
                    </td>

                    {/* Action buttons — reveal on row hover */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(c)}
                          className={cn(
                            'flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1',
                            'text-xs font-medium text-slate-600 transition',
                            'hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700',
                          )}
                        >
                          <Pencil className="h-3 w-3" />
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                        <button
                          onClick={() => setTxnCustomer(c)}
                          className={cn(
                            'flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1',
                            'text-xs font-medium text-slate-600 transition',
                            'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
                          )}
                        >
                          <Receipt className="h-3 w-3" />
                          {isAr ? 'معاملات' : 'Txns'}
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {isAr
              ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} من ${total}`
              : `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total}`}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              {isAr ? 'السابق' : 'Prev'}
            </button>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              {isAr ? 'التالي' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* ── Add / Edit modal ─────────────────────────────────────────────── */}
      {modalOpen && (
        <CustomerModal
          isAr={isAr}
          editing={editing}
          form={form}
          setForm={setForm}
          saving={saving}
          saveErr={saveErr}
          isSaveDisabled={isSaveDisabled()}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* ── Transactions modal ───────────────────────────────────────────── */}
      {txnCustomer && (
        <TransactionsModal
          isAr={isAr}
          customer={txnCustomer}
          onClose={() => setTxnCustomer(null)}
        />
      )}

    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────────────────────────

function EmptyState({
  isAr,
  hasFilters,
  onAdd,
}: {
  isAr: boolean
  hasFilters: boolean
  onAdd: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="rounded-2xl bg-slate-50 p-4">
        <Users className="h-10 w-10 text-slate-300" />
      </div>
      <div>
        {hasFilters ? (
          <>
            <p className="text-sm font-medium text-slate-600">
              {isAr ? 'لا توجد نتائج للفلتر المحدد' : 'No customers match the selected filters'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {isAr ? 'جرّب إزالة أحد الفلاتر' : 'Try removing one of the active filters.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-600">
              {isAr ? 'لا يوجد عملاء بعد' : 'No customers yet'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {isAr
                ? 'أضف عميلاً يدوياً أو اعتمد طلب KYC لإنشاء سجل تلقائياً.'
                : 'Add a customer manually or approve a KYC request to create one automatically.'}
            </p>
          </>
        )}
      </div>
      {!hasFilters && (
        <button
          onClick={onAdd}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          {isAr ? 'إضافة عميل' : 'Add Customer'}
        </button>
      )}
    </div>
  )
}

// ── TypeBadge ──────────────────────────────────────────────────────────────

function TypeBadge({ type, isAr }: { type: CustomerType; isAr: boolean }) {
  if (type === 'corporate') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-violet-600">
        <Building2 className="h-3.5 w-3.5" />
        {isAr ? 'شركة' : 'Corp'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <User className="h-3.5 w-3.5" />
      {isAr ? 'فرد' : 'Indiv'}
    </span>
  )
}

// ── CustomerModal ──────────────────────────────────────────────────────────

interface ModalProps {
  isAr:           boolean
  editing:        Customer | null
  form:           FormState
  setForm:        React.Dispatch<React.SetStateAction<FormState>>
  saving:         boolean
  saveErr:        string
  isSaveDisabled: boolean
  onSave:         () => void
  onClose:        () => void
}

function CustomerModal({
  isAr, editing, form, setForm,
  saving, saveErr, isSaveDisabled, onSave, onClose,
}: ModalProps) {
  const isEdit        = !!editing
  const effectiveType = isEdit ? editing.CustomerType : form.customerType
  const nidErr        = validateSaudiID(form.nationalID, isAr)

  // Convenience setter that merges one field into form state
  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {isEdit
                ? (isAr ? 'تعديل بيانات العميل' : 'Edit Customer')
                : (isAr ? 'إضافة عميل جديد'     : 'Add New Customer')}
            </h3>
            {isEdit && (
              <p className="mt-0.5 text-xs text-slate-400">
                {isAr ? `العميل رقم #${editing.ID}` : `Customer #${editing.ID}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">

          {/* ── Customer type (Add mode: toggle; Edit mode: read-only chip) ── */}
          {!isEdit ? (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">
                {isAr ? 'نوع العميل *' : 'Customer Type *'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(['individual', 'corporate'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('customerType', t)}
                    disabled={saving}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition',
                      form.customerType === t
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                    )}
                  >
                    {t === 'individual'
                      ? <User className="h-4 w-4" />
                      : <Building2 className="h-4 w-4" />}
                    {t === 'individual'
                      ? (isAr ? 'فرد'  : 'Individual')
                      : (isAr ? 'شركة' : 'Corporate')}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // In edit mode show a non-interactive info strip
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              {editing.CustomerType === 'corporate'
                ? <Building2 className="h-4 w-4 shrink-0 text-violet-500" />
                : <User       className="h-4 w-4 shrink-0 text-slate-400" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">{isAr ? 'نوع العميل' : 'Customer type'}</p>
                <p className="text-sm font-medium capitalize text-slate-700">
                  {editing.CustomerType === 'corporate'
                    ? (isAr ? 'شركة'  : 'Corporate')
                    : (isAr ? 'فرد'   : 'Individual')}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">
                {isAr ? 'لا يمكن تغييره' : 'Locked'}
              </span>
            </div>
          )}

          {/* ── Individual fields ─────────────────────────────────────── */}
          {effectiveType === 'individual' && (
            <>
              <ModalField label={isAr ? 'الاسم الكامل *'                     : 'Full Legal Name *'}         id="full_name">
                <input
                  id="full_name"
                  type="text"
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  placeholder={isAr ? 'كما يظهر في الهوية' : 'As it appears on ID'}
                  disabled={saving}
                  className={inputCls}
                />
              </ModalField>

              <ModalField label={isAr ? 'رقم الهوية الوطنية / الإقامة *' : 'National ID / Iqama No. *'} id="national_id">
                <input
                  id="national_id"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.nationalID}
                  onChange={(e) => set('nationalID', e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234567890"
                  disabled={saving}
                  className={cn(
                    inputCls,
                    nidErr && form.nationalID && 'border-red-400 focus:border-red-400 focus:ring-red-400/20',
                  )}
                />
                {nidErr && form.nationalID && (
                  <p className="mt-1 text-xs text-red-500">{nidErr}</p>
                )}
              </ModalField>

              <ModalField label={isAr ? 'الجنسية *' : 'Nationality *'} id="nationality">
                <select
                  id="nationality"
                  value={form.nationality}
                  onChange={(e) => set('nationality', e.target.value)}
                  disabled={saving}
                  className={cn(inputCls, 'cursor-pointer')}
                >
                  <option value="">{isAr ? '— اختر الجنسية —' : '— Select nationality —'}</option>
                  {COUNTRIES.map(({ code, name, nameAr }) => (
                    <option key={code} value={code}>
                      {isAr ? nameAr : name} ({code})
                    </option>
                  ))}
                </select>
              </ModalField>
            </>
          )}

          {/* ── Corporate fields ──────────────────────────────────────── */}
          {effectiveType === 'corporate' && (
            <>
              <ModalField label={isAr ? 'اسم الشركة *'           : 'Company Name *'}               id="company_name">
                <input
                  id="company_name"
                  type="text"
                  value={form.companyName}
                  onChange={(e) => set('companyName', e.target.value)}
                  placeholder={isAr ? 'الاسم القانوني المسجل' : 'Legal registered name'}
                  disabled={saving}
                  className={inputCls}
                />
              </ModalField>

              <ModalField label={isAr ? 'رقم السجل التجاري *' : 'Commercial Reg. No. *'} id="commercial_record">
                <input
                  id="commercial_record"
                  type="text"
                  value={form.commercialRecord}
                  onChange={(e) => set('commercialRecord', e.target.value)}
                  placeholder="e.g. 1010XXXXXX"
                  disabled={saving}
                  className={inputCls}
                />
              </ModalField>

              <ModalField label={isAr ? 'اسم الممثل المفوض' : 'Authorised Representative'} id="representative_name">
                <input
                  id="representative_name"
                  type="text"
                  value={form.representativeName}
                  onChange={(e) => set('representativeName', e.target.value)}
                  placeholder={isAr ? 'اختياري' : 'Optional'}
                  disabled={saving}
                  className={inputCls}
                />
              </ModalField>

              {/* ── IsUBO toggle — corporate only ──────────────────────── */}
              <button
                type="button"
                onClick={() => set('isUBO', !form.isUBO)}
                disabled={saving}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left rtl:text-right transition',
                  form.isUBO
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <div className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition',
                  form.isUBO ? 'border-purple-500 bg-purple-500' : 'border-slate-300 bg-white',
                )}>
                  {form.isUBO && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', form.isUBO ? 'text-purple-800' : 'text-slate-700')}>
                    {isAr ? 'المستفيد الحقيقي (UBO)' : 'Ultimate Beneficial Owner (UBO)'}
                  </p>
                  <p className={cn('text-xs', form.isUBO ? 'text-purple-500' : 'text-slate-400')}>
                    {isAr
                      ? 'يمتلك 25% أو أكثر أو يمارس سيطرة فعلية'
                      : 'Owns ≥ 25% or exercises effective control'}
                  </p>
                </div>
                <Shield className={cn(
                  'h-4 w-4 shrink-0 transition',
                  form.isUBO ? 'text-purple-500' : 'text-slate-300',
                )} />
              </button>
            </>
          )}

          {/* ── Risk Level ────────────────────────────────────────────── */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              {isAr ? 'مستوى المخاطرة' : 'Risk Level'}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {RISK_LEVELS.map((rl) => (
                <button
                  key={rl}
                  type="button"
                  onClick={() => set('riskLevel', rl)}
                  disabled={saving}
                  className={cn(
                    'rounded-lg border py-2 text-xs font-semibold transition',
                    form.riskLevel === rl
                      ? RISK_SELECTED[rl]
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                  )}
                >
                  {rl}
                </button>
              ))}
            </div>
          </div>

          {/* ── API error ─────────────────────────────────────────────── */}
          {saveErr && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
              {saveErr}
            </div>
          )}

        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={onSave}
            disabled={isSaveDisabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit
              ? (isAr ? 'حفظ التغييرات' : 'Save Changes')
              : (isAr ? 'إضافة العميل'   : 'Add Customer')}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── ModalField ─────────────────────────────────────────────────────────────

function ModalField({
  label, id, children,
}: {
  label: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}

// ── TransactionsModal ──────────────────────────────────────────────────────

function TransactionsModal({ isAr, customer, onClose }: {
  isAr: boolean
  customer: Customer
  onClose: () => void
}) {
  const custName = customer.CustomerType === 'corporate'
    ? customer.CompanyName
    : customer.FullName

  // ── List ──────────────────────────────────────────────────────────────
  const [txns, setTxns]         = useState<Transaction[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loadingList, setLL]    = useState(true)
  const [listErr, setListErr]   = useState(false)

  // ── Add form ──────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount]     = useState('')
  const [currency, setCurrency] = useState('SAR')
  const [txType, setTxType]     = useState<TxType>('deposit')
  const [txDate, setTxDate]     = useState(today)
  const [txStatus, setTxStatus] = useState<TxStatus>('completed')
  const [reference, setRef]     = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [saveErr, setSaveErr]   = useState('')
  const [showForm, setShowForm] = useState(false)

  const loadTxns = useCallback(async () => {
    setLL(true)
    setListErr(false)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '10' })
      const { data } = await api.get(`/customers/${customer.ID}/transactions?${params}`)
      setTxns((data.data.items ?? []) as Transaction[])
      setTotal(data.data.total ?? 0)
    } catch {
      setListErr(true)
    } finally {
      setLL(false)
    }
  }, [customer.ID, page])

  useEffect(() => { loadTxns() }, [loadTxns])

  const isAddDisabled = saving || !amount || Number(amount) <= 0 || !txDate

  const handleAdd = async () => {
    setSaving(true)
    setSaveErr('')
    try {
      const body: Record<string, unknown> = {
        amount:    Number(amount),
        currency,
        tx_type:   txType,
        tx_date:   txDate,
        status:    txStatus,
      }
      if (reference.trim()) body.reference = reference.trim()
      if (notes.trim())     body.notes     = notes.trim()
      await api.post(`/customers/${customer.ID}/transactions`, body)
      // Reset form and reload list
      setAmount(''); setRef(''); setNotes('')
      setTxDate(today); setTxType('deposit'); setTxStatus('completed')
      setShowForm(false)
      setPage(1)
      loadTxns()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setSaveErr(msg ?? (isAr ? 'فشل إضافة المعاملة.' : 'Failed to add transaction.'))
    } finally {
      setSaving(false)
    }
  }

  const formatAmount = (n: number, cur: string) =>
    new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + cur

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ArrowUpDown className="h-4 w-4 text-emerald-600" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {isAr ? 'المعاملات المالية' : 'Transactions'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">{custName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSaveErr(''); setShowForm((v) => !v) }}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                showForm
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? 'إضافة معاملة' : 'Add Transaction'}
            </button>
            <button onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">

          {/* ── Add form (collapsible) ─────────────────────────────────── */}
          {showForm && (
            <div className="border-b border-slate-100 bg-emerald-50/40 px-6 py-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                {isAr ? 'معاملة جديدة' : 'New Transaction'}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {/* Amount */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {isAr ? 'المبلغ *' : 'Amount *'}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={saving}
                    className={txInputCls}
                  />
                </div>
                {/* Currency */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {isAr ? 'العملة' : 'Currency'}
                  </label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                    disabled={saving} className={txSelectCls}>
                    {TX_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Type */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {isAr ? 'النوع' : 'Type'}
                  </label>
                  <select value={txType} onChange={(e) => setTxType(e.target.value as TxType)}
                    disabled={saving} className={txSelectCls}>
                    <option value="deposit">{isAr ? 'إيداع' : 'Deposit'}</option>
                    <option value="withdrawal">{isAr ? 'سحب' : 'Withdrawal'}</option>
                    <option value="transfer">{isAr ? 'تحويل' : 'Transfer'}</option>
                    <option value="payment">{isAr ? 'دفعة' : 'Payment'}</option>
                  </select>
                </div>
                {/* Date */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {isAr ? 'التاريخ *' : 'Date *'}
                  </label>
                  <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)}
                    disabled={saving} className={txInputCls} />
                </div>
                {/* Status */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {isAr ? 'الحالة' : 'Status'}
                  </label>
                  <select value={txStatus} onChange={(e) => setTxStatus(e.target.value as TxStatus)}
                    disabled={saving} className={txSelectCls}>
                    <option value="completed">{isAr ? 'مكتملة' : 'Completed'}</option>
                    <option value="pending">{isAr ? 'معلقة' : 'Pending'}</option>
                    <option value="flagged">{isAr ? 'مشبوهة' : 'Flagged'}</option>
                    <option value="reversed">{isAr ? 'مُرجَعة' : 'Reversed'}</option>
                  </select>
                </div>
                {/* Reference */}
                <div className="col-span-2 sm:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {isAr ? 'المرجع' : 'Reference'}
                    <span className="ml-1 text-slate-400">{isAr ? '(اختياري)' : '(optional)'}</span>
                  </label>
                  <input type="text" value={reference} onChange={(e) => setRef(e.target.value)}
                    placeholder={isAr ? 'رقم المرجع الخارجي' : 'External reference number'}
                    disabled={saving} className={txInputCls} maxLength={200} />
                </div>
                {/* Notes */}
                <div className="col-span-2 sm:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {isAr ? 'ملاحظات' : 'Notes'}
                    <span className="ml-1 text-slate-400">{isAr ? '(اختياري)' : '(optional)'}</span>
                  </label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder={isAr ? 'ملاحظات داخلية...' : 'Internal notes…'}
                    disabled={saving} className={txInputCls} maxLength={2000} />
                </div>
              </div>

              {saveErr && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">
                  {saveErr}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowForm(false); setSaveErr('') }}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={handleAdd} disabled={isAddDisabled}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {/* ── Transaction list ──────────────────────────────────────── */}
          {loadingList ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            </div>
          ) : listErr ? (
            <div className="px-6 py-8 text-center text-sm text-red-500">
              {isAr ? 'فشل تحميل المعاملات.' : 'Failed to load transactions.'}
            </div>
          ) : txns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <ArrowUpDown className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-500">
                {isAr ? 'لا توجد معاملات بعد' : 'No transactions yet'}
              </p>
              <p className="text-xs text-slate-400">
                {isAr ? 'أضف معاملة باستخدام الزر أعلاه' : 'Add a transaction using the button above'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-400 rtl:text-right">
                  <tr>
                    <th className="px-4 py-3">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-4 py-3">{isAr ? 'النوع' : 'Type'}</th>
                    <th className="px-4 py-3 text-right rtl:text-left">{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th className="hidden px-4 py-3 sm:table-cell">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="hidden px-4 py-3 md:table-cell">{isAr ? 'المرجع' : 'Reference'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {txns.map((t) => (
                    <tr key={t.ID} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(t.TxDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                          {isAr
                            ? { deposit: 'إيداع', withdrawal: 'سحب', transfer: 'تحويل', payment: 'دفعة' }[t.TxType]
                            : t.TxType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium text-slate-800 rtl:text-left">
                        {formatAmount(t.Amount, t.Currency)}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          TX_STATUS_BADGE[t.Status],
                        )}>
                          {isAr
                            ? { pending: 'معلقة', completed: 'مكتملة', flagged: 'مشبوهة', reversed: 'مُرجَعة' }[t.Status]
                            : t.Status}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-slate-400 md:table-cell">
                        {t.Reference || <span className="italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {total > 10 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                  <span>
                    {isAr
                      ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} من ${total}`
                      : `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} of ${total}`}
                  </span>
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                      className="rounded border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40">
                      {isAr ? 'السابق' : 'Prev'}
                    </button>
                    <button disabled={page * 10 >= total} onClick={() => setPage((p) => p + 1)}
                      className="rounded border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40">
                      {isAr ? 'التالي' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Input class ────────────────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5',
  'text-sm text-slate-800 placeholder-slate-400 outline-none transition',
  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
  'disabled:bg-slate-50 disabled:opacity-60',
)

const txInputCls = cn(
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2',
  'text-xs text-slate-800 placeholder-slate-400 outline-none transition',
  'focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20',
  'disabled:bg-slate-50 disabled:opacity-60',
)

const txSelectCls = cn(txInputCls, 'cursor-pointer appearance-none')
