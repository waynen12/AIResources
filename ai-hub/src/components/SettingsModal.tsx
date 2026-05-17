'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ProviderInfo = {
  provider_name: string;
  is_active: boolean;
  has_key: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAiStatusChange: (enabled: boolean, hasProvider: boolean) => void;
};

export default function SettingsModal({ open, onClose, onAiStatusChange }: Props) {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/settings/providers').then(r => r.json()),
    ]).then(([settings, providers]: [{ ai_enabled: boolean }, ProviderInfo[]]) => {
      setAiEnabled(settings.ai_enabled);
      const anthropic = providers.find(p => p.provider_name === 'anthropic') ?? null;
      setProvider(anthropic);
      setApiKeyInput('');
      setEditingKey(!anthropic?.has_key);
      setTestStatus('idle');
    }).catch(() => {
      toast.error('Failed to load settings');
    }).finally(() => setLoading(false));
  }, [open]);

  async function handleToggleAi() {
    const next = !aiEnabled;
    setAiEnabled(next);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_enabled: next }),
      });
      onAiStatusChange(next, !!provider?.has_key || !!apiKeyInput);
    } catch {
      setAiEnabled(!next);
      toast.error('Failed to update AI setting');
    }
  }

  async function handleTestConnection() {
    if (!apiKeyInput.trim() && !provider?.has_key) {
      toast.error('Enter an API key first');
      return;
    }
    setTestStatus('testing');
    try {
      const res = await fetch('/api/settings/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_name: 'anthropic', api_key: apiKeyInput.trim() || undefined }),
      });
      if (res.ok) {
        setTestStatus('ok');
        toast.success('Connection successful');
      } else {
        setTestStatus('fail');
        const data = await res.json();
        toast.error(data.error ?? 'Connection failed');
      }
    } catch {
      setTestStatus('fail');
      toast.error('Could not reach the AI provider — check your connection');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = { provider_name: 'anthropic' };
      if (apiKeyInput.trim()) body.api_key = apiKeyInput.trim();

      const res = await fetch('/api/settings/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to save provider');
        return;
      }
      const saved: ProviderInfo = await res.json();
      setProvider(saved);
      setApiKeyInput('');
      setEditingKey(false);
      setTestStatus('idle');
      onAiStatusChange(aiEnabled, saved.has_key);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open, details) => { if (details.reason === 'close-press') onClose(); }}
      disablePointerDismissal
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            {/* Kill switch */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">AI Features</p>
                <p className="text-xs text-muted-foreground">Enable auto-fill and tag suggestions</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiEnabled}
                onClick={handleToggleAi}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${aiEnabled ? 'bg-amber-500' : 'bg-muted'}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* Provider */}
            <div className="space-y-3">
              <Label>AI Provider</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-600"
                >
                  Anthropic
                </button>
                <button
                  type="button"
                  disabled
                  className="flex-1 rounded-md border border-input px-3 py-2 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
                  title="Coming soon"
                >
                  OpenAI <span className="text-xs">(coming soon)</span>
                </button>
              </div>
            </div>

            {/* API key */}
            <div className="space-y-1.5">
              <Label htmlFor="api-key">API Key</Label>
              {!editingKey && provider?.has_key ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="api-key"
                    type="password"
                    value="••••••••••••••••"
                    readOnly
                    className="flex-1 text-muted-foreground"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingKey(true); setApiKeyInput(''); setTestStatus('idle'); }}
                  >
                    Change key
                  </Button>
                </div>
              ) : (
                <Input
                  id="api-key"
                  type="password"
                  value={apiKeyInput}
                  onChange={e => { setApiKeyInput(e.target.value); setTestStatus('idle'); }}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                />
              )}
            </div>

            {/* Test connection */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing' ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Testing...</>
                ) : 'Test connection'}
              </Button>
              {testStatus === 'ok' && (
                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" /> Connected
                </span>
              )}
              {testStatus === 'fail' && (
                <span className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> Check key
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || (!apiKeyInput.trim() && !provider?.has_key)}
                style={{ background: '#F57C00' }}
                className="text-white hover:brightness-110"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
