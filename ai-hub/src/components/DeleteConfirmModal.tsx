'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Resource } from '@/lib/db';

type Props = {
  resource: Resource | null;
  onClose: () => void;
  onDeleted: (id: number) => void;
};

export default function DeleteConfirmModal({ resource, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!resource) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/resources/${resource.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      onDeleted(resource.id);
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={!!resource}
      onOpenChange={(_open, details) => { if (details.reason === 'close-press') onClose(); }}
      disablePointerDismissal
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Resource</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">&ldquo;{resource?.title}&rdquo;</span>? This cannot be undone.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
