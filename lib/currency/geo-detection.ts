import type { SupportedCurrency } from './index'

// EU member states (ISO 3166-1 alpha-2 codes)
const EU_COUNTRIES = new Set([
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czech Republic
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
])

/**
 * Check if a country code is in the EU
 */
export function isEuCountry(countryCode: string): boolean {
  return EU_COUNTRIES.has(countryCode.toUpperCase())
}

/**
 * Detect currency based on country code
 * Returns EUR for EU countries, USD for all others
 */
export function getCurrencyForCountry(countryCode: string): SupportedCurrency {
  return isEuCountry(countryCode) ? 'EUR' : 'USD'
}

interface GeoResponse {
  status: 'success' | 'fail'
  countryCode?: string
  message?: string
}

// Simple in-memory cache for geo lookups
const geoCache = new Map<string, { countryCode: string; timestamp: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Detect country from IP address using ip-api.com (free, no API key required)
 * Falls back to 'US' if detection fails
 */
export async function detectCountryFromIP(ip: string): Promise<string> {
  // Check cache first
  const cached = geoCache.get(ip)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.countryCode
  }

  try {
    // ip-api.com free tier: 45 requests/minute, no API key needed
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,message`)

    if (!response.ok) {
      console.warn(`Geo detection failed for IP ${ip}: HTTP ${response.status}`)
      return 'US'
    }

    const data: GeoResponse = await response.json()

    if (data.status === 'success' && data.countryCode) {
      // Cache the result
      geoCache.set(ip, {
        countryCode: data.countryCode,
        timestamp: Date.now(),
      })
      return data.countryCode
    }

    console.warn(`Geo detection failed for IP ${ip}: ${data.message}`)
    return 'US'
  } catch (error) {
    console.warn(`Geo detection error for IP ${ip}:`, error)
    return 'US'
  }
}

/**
 * Detect currency from IP address
 * Returns EUR for EU IPs, USD for all others
 */
export async function detectCurrencyFromIP(ip: string): Promise<SupportedCurrency> {
  const countryCode = await detectCountryFromIP(ip)
  return getCurrencyForCountry(countryCode)
}

/**
 * Extract client IP from request headers
 * Handles Fly.io, Cloudflare, and standard proxy headers
 */
export function getClientIP(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  // Helper to get header value
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name)
    }
    const value = headers[name]
    if (Array.isArray(value)) {
      return value[0] || null
    }
    return value || null
  }

  // Fly.io header
  const flyClientIP = getHeader('fly-client-ip')
  if (flyClientIP) return flyClientIP

  // Cloudflare header
  const cfConnectingIP = getHeader('cf-connecting-ip')
  if (cfConnectingIP) return cfConnectingIP

  // Standard proxy headers
  const xForwardedFor = getHeader('x-forwarded-for')
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first (client) one
    return xForwardedFor.split(',')[0].trim()
  }

  const xRealIP = getHeader('x-real-ip')
  if (xRealIP) return xRealIP

  return null
}
