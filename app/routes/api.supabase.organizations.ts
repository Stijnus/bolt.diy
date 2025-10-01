import { json, type ActionFunction } from '@remix-run/cloudflare';
import type { SupabaseOrganization } from '~/types/supabase';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.supabase.organizations');

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { token } = (await request.json()) as { token: string };

    if (!token) {
      return json({ error: 'Token is required' }, { status: 400 });
    }

    logger.debug('Fetching organizations from Supabase API');

    const organizationsResponse = await fetch('https://api.supabase.com/v1/organizations', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!organizationsResponse.ok) {
      const errorText = await organizationsResponse.text();
      logger.error('Organizations fetch failed:', errorText);

      return json({ error: 'Failed to fetch organizations' }, { status: organizationsResponse.status });
    }

    const organizations = (await organizationsResponse.json()) as SupabaseOrganization[];

    logger.debug(`Successfully fetched ${organizations.length} organizations`);

    // Sort organizations by created_at (newest first) or by name if created_at not available
    organizations.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      return a.name.localeCompare(b.name);
    });

    return json({
      organizations,
      totalOrganizations: organizations.length,
    });
  } catch (error) {
    logger.error('Supabase organizations API error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch organizations',
      },
      { status: 500 },
    );
  }
};
