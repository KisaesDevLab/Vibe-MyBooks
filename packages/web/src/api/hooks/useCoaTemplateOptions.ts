import { useQuery } from '@tanstack/react-query';
import { BUSINESS_TYPE_OPTIONS, type CoaTemplateOption } from '@kis-books/shared';

/**
 * Fetches the live list of business-type/COA-template options from the
 * public endpoint at /api/v1/coa-templates/options. Used by the setup
 * wizards, register page, and company switcher so that templates added
 * by super admins via /admin/coa-templates show up immediately.
 *
 * Falls back to the static BUSINESS_TYPE_OPTIONS constant on first paint
 * (and forever if the API is unreachable) so the UI never has an empty
 * dropdown.
 *
 * The endpoint is unauthenticated so this hook is safe to call from
 * pre-login pages like /first-run-setup and /register.
 */
export function useCoaTemplateOptions(): CoaTemplateOption[] {
  const { data } = useQuery({
    queryKey: ['coa-template-options'],
    queryFn: async () => {
      const res = await fetch('/api/v1/coa-templates/options');
      if (!res.ok) throw new Error('Failed to load template options');
      const body = (await res.json()) as { options: CoaTemplateOption[] };
      return body.options;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return data && data.length > 0 ? data : (BUSINESS_TYPE_OPTIONS as readonly CoaTemplateOption[] as CoaTemplateOption[]);
}
