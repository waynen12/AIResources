'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertTriangle, Loader2, Download, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';
import AccountsModal from '@/components/AccountsModal';

type ProviderInfo = {
  provider_name: string;
  is_active: boolean;
  has_key: boolean;
};

type ProviderName = 'anthropic' | 'openai';

type Props = {
  open: boolean;
  onClose: () => void;
  onAiStatusChange: (enabled: boolean, hasProvider: boolean) => void;
  onImportComplete?: () => void;
};

export default function SettingsModal({ open, onClose, onAiStatusChange, onImportComplete }: Props) {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedName, setSelectedName] = useState<ProviderName>('anthropic');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [hasNewsToken, setHasNewsToken] = useState(false);
  const [newsToken, setNewsToken] = useState('');
  const [regeneratingToken, setRegeneratingToken] = useState(false);

  const selectedProvider = providers.find(p => p.provider_name === selectedName) ?? null;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setNewsToken('');
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/settings/providers').then(r => r.json()),
      fetch('/api/settings/news-token').then(r => r.json()),
    ]).then(([settings, providerList, newsTokenInfo]: [{ ai_enabled: boolean }, ProviderInfo[], { has_token: boolean }]) => {
      setAiEnabled(settings.ai_enabled);
      setProviders(providerList);
      const active = providerList.find(p => p.is_active);
      const initial: ProviderName = active?.provider_name === 'openai' ? 'openai' : 'anthropic';
      setSelectedName(initial);
      const initialProvider = providerList.find(p => p.provider_name === initial) ?? null;
      setApiKeyInput('');
      setEditingKey(!initialProvider?.has_key);
      setTestStatus('idle');
      setHasNewsToken(newsTokenInfo.has_token);
    }).catch(() => {
      toast.error('Failed to load settings');
    }).finally(() => setLoading(false));
  }, [open]);

  function handleSelectProvider(name: ProviderName) {
    if (name === selectedName) return;
    setSelectedName(name);
    const p = providers.find(pr => pr.provider_name === name) ?? null;
    setApiKeyInput('');
    setEditingKey(!p?.has_key);
    setTestStatus('idle');
  }

  async function handleToggleAi() {
    const next = !aiEnabled;
    setAiEnabled(next);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_enabled: next }),
      });
      onAiStatusChange(next, providers.some(p => p.has_key));
    } catch {
      setAiEnabled(!next);
      toast.error('Failed to update AI setting');
    }
  }

  async function handleTestConnection() {
    if (!apiKeyInput.trim() && !selectedProvider?.has_key) {
      toast.error('Enter an API key first');
      return;
    }
    setTestStatus('testing');
    try {
      const res = await fetch('/api/settings/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_name: selectedName, api_key: apiKeyInput.trim() || undefined }),
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
      const body: Record<string, string> = { provider_name: selectedName };
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
      setProviders(prev => {
        const updated = prev.filter(p => p.provider_name !== saved.provider_name);
        return [...updated, { ...saved, is_active: true }].map(p =>
          p.provider_name === saved.provider_name ? p : { ...p, is_active: false }
        );
      });
      setApiKeyInput('');
      setEditingKey(false);
      setTestStatus('idle');
      onAiStatusChange(aiEnabled, saved.has_key);
      toast.success('Settings saved');
      onClose();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  const providerLabels: Record<ProviderName, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
  };

  const keyPlaceholders: Record<ProviderName, string> = {
    anthropic: 'sk-ant-...',
    openai: 'sk-...',
  };

  return (
    <>
    <AccountsModal open={accountsOpen} onClose={() => setAccountsOpen(false)} />
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

            {/* Provider selector */}
            <div className="space-y-3">
              <Label>AI Provider</Label>
              <div className="flex gap-2">
                {(['anthropic', 'openai'] as ProviderName[]).map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSelectProvider(name)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      selectedName === name
                        ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-600'
                        : 'border-input text-muted-foreground hover:border-amber-400 hover:text-foreground'
                    }`}
                  >
                    {providerLabels[name]}
                  </button>
                ))}
              </div>
            </div>

            {/* API key */}
            <div className="space-y-1.5">
              <Label htmlFor="api-key">{providerLabels[selectedName]} API Key</Label>
              {!editingKey && selectedProvider?.has_key ? (
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
                  placeholder={keyPlaceholders[selectedName]}
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

            {/* Accounts */}
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Accounts</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAccountsOpen(true)}
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Manage Accounts
              </Button>
            </div>

            {/* News Ingest Token */}
            <div className="space-y-3 pt-2 border-t">
              <div>
                <p className="text-sm font-medium">News Ingest Token</p>
                <p className="text-xs text-muted-foreground">Bearer token for the n8n webhook to POST digests</p>
              </div>
              {newsToken ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-amber-600 dark:text-amber-400">Copy this token — it won&apos;t be shown again.</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newsToken}
                      readOnly
                      className="flex-1 font-mono text-xs"
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { navigator.clipboard.writeText(newsToken); toast.success('Token copied'); }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {hasNewsToken && (
                    <span className="text-sm text-muted-foreground">Token configured</span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={regeneratingToken}
                    onClick={async () => {
                      setRegeneratingToken(true);
                      try {
                        const res = await fetch('/api/settings/news-token', { method: 'POST' });
                        if (!res.ok) throw new Error();
                        const data = await res.json() as { token: string };
                        setNewsToken(data.token);
                        setHasNewsToken(true);
                      } catch {
                        toast.error('Failed to generate token');
                      } finally {
                        setRegeneratingToken(false);
                      }
                    }}
                  >
                    {regeneratingToken
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Generating...</>
                      : hasNewsToken ? 'Regenerate' : 'Generate Token'
                    }
                  </Button>
                </div>
              )}
            </div>

            {/* Export / Import */}
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Data</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => { window.location.href = '/api/resources/export'; }}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={importing}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.csv,text/csv';
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      setImporting(true);
                      try {
                        const body = new FormData();
                        body.append('file', file);
                        const res = await fetch('/api/resources/import', { method: 'POST', body });
                        const data = await res.json();
                        if (!res.ok) {
                          toast.error(data.error ?? 'Import failed');
                          return;
                        }
                        const { added, skipped_duplicates, skipped_bad_rows } = data;
                        const parts = [`${added} added`];
                        if (skipped_duplicates > 0) parts.push(`${skipped_duplicates} duplicate${skipped_duplicates > 1 ? 's' : ''} skipped`);
                        if (skipped_bad_rows > 0) parts.push(`${skipped_bad_rows} bad row${skipped_bad_rows > 1 ? 's' : ''} skipped`);
                        toast.success(`Import complete: ${parts.join(', ')}`);
                        if (added > 0) onImportComplete?.();
                      } catch {
                        toast.error('Import failed — check your connection');
                      } finally {
                        setImporting(false);
                      }
                    };
                    input.click();
                  }}
                >
                  {importing
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Importing...</>
                    : <><Upload className="h-3.5 w-3.5 mr-1.5" />Import CSV</>
                  }
                </Button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || (!apiKeyInput.trim() && !selectedProvider?.has_key)}
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
    </>
  );
}
