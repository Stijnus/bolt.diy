import { useNavigate } from '@remix-run/react';
import ProfileTab from '~/components/@settings/tabs/profile/ProfileTab';
import { AvatarDropdown } from '~/components/@settings/core/AvatarDropdown';
import { PageShell } from '~/components/layout/PageShell';

export default function ProfileSettingsPage() {
  const navigate = useNavigate();

  return (
    <PageShell
      title="Profile Settings"
      description="Update your contact information, avatar, and notification preferences."
      breadcrumbs={[{ label: 'Settings', to: '/settings' }, { label: 'Profile' }]}
      maxWidthClassName="max-w-5xl"
      actions={
        <>
          <AvatarDropdown
            onSelectTab={(tab) => {
              if (tab === 'profile') {
                return;
              }

              navigate(`/settings?tab=${tab}`);
            }}
          />
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-bolt-elements-borderColor px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-bolt-elements-textSecondary transition-colors"
          >
            <div className="i-ph:arrow-left w-4 h-4" />
            Back
          </button>
        </>
      }
    >
      <div className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2/80 backdrop-blur shadow-xl p-6">
        <ProfileTab />
      </div>
    </PageShell>
  );
}
