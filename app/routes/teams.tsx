import { useNavigate } from '@remix-run/react';
import { TeamManagement } from '~/components/teams/TeamManagement';
import { PageShell } from '~/components/layout/PageShell';

export default function TeamsPage() {
  const navigate = useNavigate();

  return (
    <PageShell
      title="Team Management"
      description="Organize teams, manage roles, and collaborate with your workspace members."
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Teams' }]}
      maxWidthClassName="max-w-6xl"
      actions={
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-bolt-elements-borderColor px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-bolt-elements-textSecondary bg-transparent hover:bg-transparent focus-visible:bg-transparent transition-colors"
        >
          <div className="i-ph:arrow-left w-4 h-4" />
          Back
        </button>
      }
    >
      <div className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2/80 backdrop-blur shadow-xl">
        <TeamManagement />
      </div>
    </PageShell>
  );
}
