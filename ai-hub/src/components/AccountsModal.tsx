'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, KeyRound, UserX, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

type Account = {
  id: number;
  username: string;
  role: 'admin' | 'contributor';
  is_active: boolean;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AccountsModal({ open, onClose }: Props) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? '';
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'contributor'>('contributor');
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowCreateForm(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('contributor');
      setResetTarget(null);
      setResetPassword('');
      return;
    }
    setLoading(true);
    fetch('/api/admin/accounts')
      .then(r => r.json())
      .then((data: Account[]) => setAccounts(data))
      .catch(() => toast.error('Failed to load accounts'))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });
      const data = await res.json() as Account & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create account');
        return;
      }
      setAccounts(prev => [...prev, data]);
      setNewUsername('');
      setNewPassword('');
      setNewRole('contributor');
      setShowCreateForm(false);
      toast.success(`Account "${data.username}" created`);
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(id: number, role: string | null) {
    if (!role) return;
    const prev = accounts.find(a => a.id === id);
    if (!prev || prev.role === role) return;
    setAccounts(a => a.map(ac => ac.id === id ? { ...ac, role: role as Account['role'] } : ac));
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'role', role }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setAccounts(a => a.map(ac => ac.id === id ? { ...ac, role: prev.role } : ac));
        toast.error(data.error ?? 'Failed to update role');
      }
    } catch {
      setAccounts(a => a.map(ac => ac.id === id ? { ...ac, role: prev.role } : ac));
      toast.error('Could not reach the server');
    }
  }

  async function handleDeactivate(id: number) {
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate' }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to deactivate account');
        return;
      }
      setAccounts(a => a.map(ac => ac.id === id ? { ...ac, is_active: false } : ac));
      toast.success('Account deactivated');
    } catch {
      toast.error('Could not reach the server');
    }
  }

  async function handleReactivate(id: number) {
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? 'Failed to reactivate account');
        return;
      }
      setAccounts(a => a.map(ac => ac.id === id ? { ...ac, is_active: true } : ac));
      toast.success('Account reactivated');
    } catch {
      toast.error('Could not reach the server');
    }
  }

  async function handleResetPassword(id: number, e: React.FormEvent) {
    e.preventDefault();
    setResetSubmitting(true);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to reset password');
        return;
      }
      setResetTarget(null);
      setResetPassword('');
      toast.success('Password reset');
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setResetSubmitting(false);
    }
  }

  const activeAccounts = accounts.filter(a => a.is_active);
  const inactiveAccounts = accounts.filter(a => !a.is_active);

  function renderRow(account: Account) {
    const isSelf = String(account.id) === currentUserId;
    const isResetting = resetTarget === account.id;

    return (
      <div
        key={account.id}
        className={`rounded-lg border p-3 space-y-2 ${!account.is_active ? 'opacity-50 bg-muted/30' : ''}`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-sm flex-1 min-w-0 truncate">
            {account.username}
            {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
          </span>

          <Select
            value={account.role}
            onValueChange={val => handleRoleChange(account.id, val)}
            disabled={!account.is_active}
          >
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="contributor">Contributor</SelectItem>
            </SelectContent>
          </Select>

          {account.is_active ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setResetTarget(isResetting ? null : account.id);
                  setResetPassword('');
                }}
              >
                <KeyRound className="h-3.5 w-3.5 mr-1" />
                Reset password
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSelf}
                onClick={() => handleDeactivate(account.id)}
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <UserX className="h-3.5 w-3.5 mr-1" />
                Deactivate
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleReactivate(account.id)}
            >
              <UserCheck className="h-3.5 w-3.5 mr-1" />
              Reactivate
            </Button>
          )}
        </div>

        {isResetting && (
          <form
            onSubmit={e => handleResetPassword(account.id, e)}
            className="flex items-center gap-2 pt-1"
          >
            <Input
              type="password"
              value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              className="flex-1 h-8 text-sm"
              autoFocus
              autoComplete="new-password"
              required
              minLength={8}
            />
            <Button type="submit" size="sm" disabled={resetSubmitting}>
              {resetSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Set'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setResetTarget(null); setResetPassword(''); }}
            >
              Cancel
            </Button>
          </form>
        )}

        <p className="text-xs text-muted-foreground">
          Created {new Date(account.created_at).toLocaleDateString()}
        </p>
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open, details) => { if (details.reason === 'close-press') onClose(); }}
      disablePointerDismissal
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Accounts</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Active accounts */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active ({activeAccounts.length})
              </p>
              {activeAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No active accounts.</p>
              ) : (
                activeAccounts.map(renderRow)
              )}
            </div>

            {/* Inactive accounts */}
            {inactiveAccounts.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Inactive ({inactiveAccounts.length})
                </p>
                {inactiveAccounts.map(renderRow)}
              </div>
            )}

            {/* New account form */}
            <div className="pt-2 border-t">
              {!showCreateForm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  New Account
                </Button>
              ) : (
                <form onSubmit={handleCreate} className="space-y-3">
                  <p className="text-sm font-medium">New Account</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-username">Username</Label>
                      <Input
                        id="new-username"
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        required
                        autoFocus
                        autoComplete="off"
                        placeholder="e.g. alice"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-role">Role</Label>
                      <Select value={newRole} onValueChange={val => { if (val) setNewRole(val as Account['role']); }}>
                        <SelectTrigger id="new-role" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contributor">Contributor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      minLength={8}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowCreateForm(false); setNewUsername(''); setNewPassword(''); setNewRole('contributor'); }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={creating} style={{ background: '#F57C00' }} className="text-white hover:brightness-110">
                      {creating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Creating...</> : 'Create Account'}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
