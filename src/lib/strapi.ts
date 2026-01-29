/**
 * Strapi API Client
 * Helper functions to fetch data from Strapi CMS
 * 
 * Usage:
 * - const professionals = await getProfessionals();
 * - const professional = await getProfessional(1);
 * - const specializations = await getSpecializations();
 */

const STRAPI_API_URL = import.meta.env.STRAPI_API_URL || 'http://localhost:1337';

/**
 * Generic fetch wrapper for Strapi API
 * @param endpoint - API endpoint (e.g., '/professionals')
 * @param params - Query parameters (populate, filters, sort, etc.)
 * @returns Parsed JSON response
 */
async function fetchAPI<T>(
  endpoint: string,
  params?: Record<string, string | string[]>
): Promise<{ data: T }> {
  const queryString = new URLSearchParams();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((v) => queryString.append(key, v));
      } else {
        queryString.set(key, value);
      }
    }
  }

  const url = `${STRAPI_API_URL}/api${endpoint}${queryString.toString() ? `?${queryString.toString()}` : ''}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Strapi API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

/**
 * Get all professionals with full relations for directory display
 * Populates: photo, specializations, professions, social_media
 */
export async function getProfessionals() {
  const response = await fetchAPI('/professionals', {
    populate: ['photo', 'specializations', 'professions', 'social_media'],
  });
  return response.data;
}

/**
 * Get a single professional by slug with all details
 * @param slug - Professional slug
 */
export async function getProfessionalBySlug(slug: string) {
  const response = await fetchAPI('/professionals', {
    populate: ['photo', 'specializations', 'professions', 'social_media', 'pronouns'],
    'filters[slug][$eq]': slug,
  });
  return response.data?.[0] || null;
}

/**
 * Get all specializations
 * Populates: professionals, businesses
 */
export async function getSpecializations() {
  const response = await fetchAPI('/specializations', {
    populate: 'professionals,businesses',
  });
  return response.data;
}

/**
 * Get a single specialization by ID
 * @param id - Specialization ID
 */
export async function getSpecialization(id: string | number) {
  const response = await fetchAPI(`/specializations/${id}`, {
    populate: 'professionals,businesses',
  });
  return response.data;
}

/**
 * Get all professions
 * Populates: professionals
 */
export async function getProfessions() {
  const response = await fetchAPI('/professions', {
    populate: 'professionals',
  });
  return response.data;
}

/**
 * Get a single profession by ID
 * @param id - Profession ID
 */
export async function getProfession(id: string | number) {
  const response = await fetchAPI(`/professions/${id}`, {
    populate: 'professionals',
  });
  return response.data;
}

/**
 * Get all businesses
 * Populates: specializations
 */
export async function getBusinesses() {
  const response = await fetchAPI('/businesses', {
    populate: 'specializations',
  });
  return response.data;
}

/**
 * Get a single business by ID
 * @param id - Business ID
 */
export async function getBusiness(id: string | number) {
  const response = await fetchAPI(`/businesses/${id}`, {
    populate: 'specializations',
  });
  return response.data;
}

/**
 * Get all staff members
 */
export async function getStaffMembers() {
  const response = await fetchAPI('/staff-members', {
    populate: ['photo', 'pronouns', 'social_media'],
    sort: 'order:asc',  // Sort by order
  });
  return response.data;
}

/**
 * Get a single staff member by ID
 * @param id - Staff Member ID
 * @param locale - Locale for i18n content (default: 'en')
 */
export async function getStaffMember(id: string | number, locale: string = 'en') {
  const response = await fetchAPI(`/staff-members/${id}`, {
    populate: ['photo', 'pronouns', 'social_media'],
  }, locale);
  return response.data;
}

/**
 * Search professionals by various filters
 * @param filters - Filter criteria (e.g., { entity_type: 'individual_health' })
 * @param sort - Sort field (e.g., 'firstName')
 * @param locale - Locale for i18n content (default: 'en')
 */
export async function searchProfessionals(
  filters?: Record<string, unknown>,
  sort?: string,
  locale: string = 'en'
) {
  const params: Record<string, string> = {
    populate: 'specializations,professions',
  };

  if (sort) {
    params.sort = sort;
  }

  if (filters) {
    // Build filter query (Strapi filter syntax)
    // Example: { entity_type: 'individual_health' } → filters[entity_type][$eq]=individual_health
    for (const [key, value] of Object.entries(filters)) {
      params[`filters[${key}][$eq]`] = String(value);
    }
  }

  const response = await fetchAPI('/professionals', params, locale);
  return response.data;
}

/**
 * Get all active social links for footer and other UI
 * Sorted by order, filtered to show only active links
 */
