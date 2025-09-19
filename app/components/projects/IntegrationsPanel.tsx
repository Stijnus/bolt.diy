import { useEffect, useState } from 'react';
import { PlugZap, Save, Trash2, RefreshCcw, Send } from 'lucide-react';
import type { Project } from './types';
import {
  listProjectIntegrations,
  saveIntegration,
  removeIntegration,
  syncPRsForProject,
  sendWebhook,
  type IntegrationConfigRow,
} from '~/lib/services/integrationService';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { toast } from 'react-toastify';

interface IntegrationsPanelProps {
  project: Project;
}

export function IntegrationsPanel({ project }: IntegrationsPanelProps) {
  const [rows, setRows] = useState<IntegrationConfigRow[]>([]);
  const [ghRepo, setGhRepo] = useState('');
  const [glRepo, setGlRepo] = useState('');
  const [slackUrl, setSlackUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const list = await listProjectIntegrations(project.id);
    setRows(list);
  };

  useEffect(() => {
    load();
  }, [project.id]);

  const save = async () => {
    setSaving(true);

    try {
      const now = Date.now();

      if (ghRepo.trim()) {
        await saveIntegration({
          id: `${now}-gh`,
          provider: 'github',
          scopeType: 'project',
          scopeId: project.id,
          name: 'GitHub Repo',
          config: { repo: ghRepo.trim() },
        });
      }

      if (glRepo.trim()) {
        await saveIntegration({
          id: `${now}-gl`,
          provider: 'gitlab',
          scopeType: 'project',
          scopeId: project.id,
          name: 'GitLab Repo',
          config: { repo: glRepo.trim() },
        });
      }

      if (slackUrl.trim()) {
        await saveIntegration({
          id: `${now}-slack`,
          provider: 'slack',
          scopeType: 'project',
          scopeId: project.id,
          name: 'Slack Webhook',
          config: { url: slackUrl.trim() },
        });
      }

      setGhRepo('');
      setGlRepo('');
      setSlackUrl('');
      await load();
      toast.success('Integrations saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save integrations');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await removeIntegration(id);
    await load();
  };

  const syncPRs = async () => {
    setSyncing(true);

    try {
      await syncPRsForProject(project.id);
      toast.success('PR sync complete (simulated)');
    } finally {
      setSyncing(false);
    }
  };

  const sendTest = async () => {
    setSending(true);

    try {
      const slack = rows.find((r) => r.provider === 'slack');

      if (!slack?.config?.url) {
        toast.error('Add Slack webhook first');
        return;
      }

      const ok = await sendWebhook(slack.config.url, {
        text: `bolt.diy test notification for project ${project.name}`,
      });
      toast[ok ? 'success' : 'error'](ok ? 'Notification sent (simulated)' : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl shadow-sm hover:shadow-lg hover:shadow-green-500/20 transition-all duration-300 mt-6">
      <div className="p-6 border-b border-bolt-elements-borderColor flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
          <PlugZap className="w-5 h-5" /> Integrations
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={syncPRs}
            disabled={syncing}
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 hover:text-bolt-elements-item-contentAccent hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent transition-colors"
          >
            <RefreshCcw className="w-4 h-4" /> {syncing ? 'Syncing...' : 'Sync PRs'}
          </Button>
          <Button
            onClick={sendTest}
            disabled={sending}
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 hover:text-bolt-elements-item-contentAccent hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent transition-colors"
          >
            <Send className="w-4 h-4" /> Test Notification
          </Button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="github-repo" className="text-sm font-medium text-bolt-elements-textPrimary">
              GitHub repo (owner/name)
            </Label>
            <Input
              id="github-repo"
              value={ghRepo}
              onChange={(e) => setGhRepo(e.target.value)}
              placeholder="owner/repo"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gitlab-repo" className="text-sm font-medium text-bolt-elements-textPrimary">
              GitLab repo (url or owner/name)
            </Label>
            <Input
              id="gitlab-repo"
              value={glRepo}
              onChange={(e) => setGlRepo(e.target.value)}
              placeholder="group/project or URL"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slack-webhook" className="text-sm font-medium text-bolt-elements-textPrimary">
              Slack webhook URL
            </Label>
            <Input
              id="slack-webhook"
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/..."
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            onClick={save}
            disabled={saving}
            variant="outline"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/10 to-blue-500/10 hover:from-green-500/20 hover:to-blue-500/20 border-green-500/30 hover:border-green-500/50 hover:text-bolt-elements-item-contentAccent transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-green-500/20 font-medium"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Integrations'}
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-bolt-elements-textSecondary mb-2">Configured</div>
            <div className="grid gap-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-bolt-elements-background-depth-1 to-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
                >
                  <div>
                    <div className="text-bolt-elements-textPrimary text-sm font-medium">{r.name || r.provider}</div>
                    <div className="text-xs text-bolt-elements-textSecondary">{JSON.stringify(r.config)}</div>
                  </div>
                  <button
                    onClick={() => remove(r.id)}
                    className="text-bolt-elements-textTertiary hover:text-bolt-elements-item-contentDanger"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
