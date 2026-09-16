import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useLabels, useCreateLabel, useDeleteLabel } from '@/api/labels';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function LabelManagerDialog({ projectId, open, onOpenChange }) {
  const labels = useLabels(projectId);
  const createLabel = useCreateLabel(projectId);
  const deleteLabel = useDeleteLabel(projectId);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  const onCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createLabel.mutateAsync({ name: name.trim(), color });
      toast.success(`Created “${name.trim()}”`);
      setName('');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const onDelete = async (label) => {
    try {
      await deleteLabel.mutateAsync(label.id);
      toast.success(`Deleted “${label.name}”`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Labels</DialogTitle>
          <DialogDescription>Create and manage labels for this project.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onCreate} className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="label-name">Name</Label>
            <Input
              id="label-name"
              placeholder="bug"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label-color">Color</Label>
            <input
              id="label-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
            />
          </div>
          <Button type="submit" disabled={createLabel.isPending}>
            Add
          </Button>
        </form>

        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {labels.data?.length ? (
            labels.data.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-md border p-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="inline-block h-4 w-4 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(l)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No labels yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
