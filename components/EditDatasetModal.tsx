'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import supabase from '@/lib/supabaseClient';

interface EditDatasetModalProps {
  dataset: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function EditDatasetModal({ dataset, onClose, onSaved }: EditDatasetModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source: '',
    license: '',
    tags: '',
    is_public: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dataset) {
      setFormData({
        name: dataset.name || '',
        description: dataset.description || '',
        source: dataset.source || '',
        license: dataset.license || '',
        tags: dataset.tags || '',
        is_public: dataset.is_public || false,
      });
    }
  }, [dataset]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const { name, value, type } = target;
    const checked = (target as HTMLInputElement).checked ?? false;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('datasets')
      .update({
        name: formData.name,
        description: formData.description,
        source: formData.source,
        license: formData.license,
        tags: formData.tags,
        is_public: formData.is_public,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dataset.id);

    setLoading(false);

    if (error) {
      console.error(error);
      alert('Failed to update dataset.');
    } else {
      await onSaved();
      onClose();
    }
  };

  if (!dataset) return null;

  return (
    <Dialog open={!!dataset} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Dataset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label htmlFor="source">Source</Label>
            <Input id="source" name="source" value={formData.source} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="license">License</Label>
            <Input id="license" name="license" value={formData.license} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" name="tags" value={formData.tags} onChange={handleChange} />
          </div>
          <div className="flex items-center space-x-2">
            <input
              id="is_public"
              name="is_public"
              type="checkbox"
              checked={formData.is_public}
              onChange={handleChange}
            />
            <Label htmlFor="is_public">Publicly Visible</Label>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
