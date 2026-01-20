'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Settings, Plus, Edit2, Trash2, ChevronDown, ChevronRight, Save, X, AlertCircle, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type FrameworkStructure = {
  pillars: Array<{
    id: string;
    code: string;
    name: string;
    description?: string;
    order_index: number;
    themes?: Array<{
      id: string;
      code: string;
      name: string;
      description?: string;
      order_index: number;
      subthemes?: Array<{
        id: string;
        code: string;
        name: string;
        description?: string;
        order_index: number;
        indicators?: Array<{
          id: string;
          code: string;
          name: string;
          description?: string;
          unit?: string;
          order_index: number;
        }>;
      }>;
    }>;
  }>;
};

interface FrameworkStructureManagerProps {
  open: boolean;
  onClose: () => void;
}

// Sortable Item Component
function SortableItem({ 
  id, 
  type, 
  children, 
  disabled = false 
}: { 
  id: string; 
  type: 'pillar' | 'theme' | 'subtheme' | 'indicator';
  children: ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${type}-${id}`, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={isDragging ? 'z-50' : ''}
      {...(!disabled ? attributes : {})}
    >
      <div className="flex items-center gap-1">
        {!disabled && (
          <button
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
            title="Drag to reorder or move"
            type="button"
          >
            <GripVertical size={16} />
          </button>
        )}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function FrameworkStructureManager({ open, onClose }: FrameworkStructureManagerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [structure, setStructure] = useState<FrameworkStructure | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => {
    if (open) {
      loadStructure();
    }
  }, [open]);

  const loadStructure = async () => {
    // Preserve expanded state before reloading
    const previousExpanded = new Set(expanded);
    
    setLoading(true);
    setError(null);
    try {
      // Try RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_framework_structure');
      
      let pillars: any[] = [];
      
      if (rpcError) {
        console.warn('RPC failed, trying direct table queries:', rpcError);
        // Fallback: Query tables directly
        const [pillarsRes, themesRes, subthemesRes, indicatorsRes] = await Promise.all([
          supabase.from('framework_pillars').select('*').eq('is_active', true).order('order_index'),
          supabase.from('framework_themes').select('*').eq('is_active', true).order('order_index'),
          supabase.from('framework_subthemes').select('*').eq('is_active', true).order('order_index'),
          supabase.from('framework_indicators').select('*').eq('is_active', true).order('order_index')
        ]);
        
        if (pillarsRes.error) throw pillarsRes.error;
        if (themesRes.error) throw themesRes.error;
        if (subthemesRes.error) throw subthemesRes.error;
        if (indicatorsRes.error) throw indicatorsRes.error;
        
        // Build hierarchy manually
        const themes = themesRes.data || [];
        const subthemes = subthemesRes.data || [];
        const indicators = indicatorsRes.data || [];
        
        pillars = (pillarsRes.data || []).map(p => ({
          ...p,
          themes: themes
            .filter(t => t.pillar_id === p.id)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
            .map(t => ({
              ...t,
              subthemes: subthemes
                .filter(st => st.theme_id === t.id)
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map(st => ({
                  ...st,
                  indicators: indicators
                    .filter(i => i.subtheme_id === st.id)
                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                }))
            }))
        }));
      } else {
        // Process RPC response
        console.log('Raw RPC response:', rpcData);
        
        if (Array.isArray(rpcData)) {
          pillars = rpcData;
        } else if (rpcData && typeof rpcData === 'object') {
          if ('pillars' in rpcData && Array.isArray(rpcData.pillars)) {
            pillars = rpcData.pillars;
          } else {
            try {
              const parsed = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
              pillars = Array.isArray(parsed) ? parsed : parsed.pillars || [];
            } catch (e) {
              console.error('Failed to parse RPC data:', e);
              pillars = [];
            }
          }
        } else if (typeof rpcData === 'string') {
          try {
            const parsed = JSON.parse(rpcData);
            pillars = Array.isArray(parsed) ? parsed : parsed.pillars || [];
          } catch (e) {
            console.error('Failed to parse JSON string:', e);
            pillars = [];
          }
        }
      }
      
      console.log('Processed pillars:', pillars);
      
      if (pillars && pillars.length > 0) {
        // Sort pillars by order_index
        pillars.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
        
        // Sort themes, subthemes, and indicators within each pillar
        pillars.forEach((p: any) => {
          if (p.themes) {
            p.themes.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
            p.themes.forEach((t: any) => {
              if (t.subthemes) {
                t.subthemes.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
                t.subthemes.forEach((st: any) => {
                  if (st.indicators) {
                    st.indicators.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
                  }
                });
              }
            });
          }
        });
        
        setStructure({ pillars });
        
        // Preserve previous expanded state, but add any new items that were added
        const preservedExpanded = new Set<string>(previousExpanded);
        
        // If this is the first load (no previous expanded state), expand all by default
        if (previousExpanded.size === 0) {
          pillars.forEach((p: any) => {
            preservedExpanded.add(`p-${p.id}`);
            p.themes?.forEach((t: any) => {
              preservedExpanded.add(`t-${t.id}`);
              t.subthemes?.forEach((st: any) => {
                preservedExpanded.add(`st-${st.id}`);
              });
            });
          });
        } else {
          // Preserve expanded state, but verify items still exist
          const existingIds = new Set<string>();
          pillars.forEach((p: any) => {
            existingIds.add(`p-${p.id}`);
            if (previousExpanded.has(`p-${p.id}`)) {
              preservedExpanded.add(`p-${p.id}`);
            }
            p.themes?.forEach((t: any) => {
              existingIds.add(`t-${t.id}`);
              if (previousExpanded.has(`t-${t.id}`)) {
                preservedExpanded.add(`t-${t.id}`);
              }
              t.subthemes?.forEach((st: any) => {
                existingIds.add(`st-${st.id}`);
                if (previousExpanded.has(`st-${st.id}`)) {
                  preservedExpanded.add(`st-${st.id}`);
                }
              });
            });
          });
          // Remove expanded state for items that no longer exist
          previousExpanded.forEach(id => {
            if (!existingIds.has(id)) {
              preservedExpanded.delete(id);
            }
          });
        }
        
        setExpanded(preservedExpanded);
      } else {
        setStructure({ pillars: [] });
        setError('No framework structure found. The framework tables may be empty. Please run the migration script to import the framework structure.');
      }
    } catch (err: any) {
      console.error('Error loading framework structure:', err);
      setError(err.message || 'Failed to load framework structure. Check browser console for details.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const handleEdit = (type: 'pillar' | 'theme' | 'subtheme' | 'indicator', item: any, parentOptions?: any[]) => {
    setEditing(`${type}-${item.id}`);
    
    // Find the actual parent ID from the structure
    let originalParentId: string | null = null;
    let currentParentId: string | null = null;
    
    if (type === 'theme') {
      // Find which pillar this theme belongs to
      for (const p of structure?.pillars || []) {
        const theme = p.themes?.find((t: any) => t.id === item.id);
        if (theme) {
          originalParentId = p.id;
          currentParentId = p.id;
          break;
        }
      }
    } else if (type === 'subtheme') {
      // Find which theme this subtheme belongs to
      for (const p of structure?.pillars || []) {
        for (const t of p.themes || []) {
          const subtheme = t.subthemes?.find((st: any) => st.id === item.id);
          if (subtheme) {
            originalParentId = t.id;
            currentParentId = t.id;
            break;
          }
        }
        if (originalParentId) break;
      }
    } else if (type === 'indicator') {
      // Find which subtheme this indicator belongs to
      for (const p of structure?.pillars || []) {
        for (const t of p.themes || []) {
          for (const st of t.subthemes || []) {
            const indicator = st.indicators?.find((i: any) => i.id === item.id);
            if (indicator) {
              originalParentId = st.id;
              currentParentId = st.id;
              break;
            }
          }
          if (originalParentId) break;
        }
        if (originalParentId) break;
      }
    }
    
    setEditData({ 
      ...item, 
      parentOptions: parentOptions || [],
      originalParentId: originalParentId,
      // Ensure parent_id is set for the dropdown - use found parent or fallback to item property
      pillar_id: type === 'theme' ? (currentParentId || item.pillar_id) : undefined,
      theme_id: type === 'subtheme' ? (currentParentId || item.theme_id) : undefined,
      subtheme_id: type === 'indicator' ? (currentParentId || item.subtheme_id) : undefined,
    });
    
    console.log(`Editing ${type} ${item.id}:`, {
      originalParentId,
      currentParentId,
      editData: { ...item, pillar_id: type === 'theme' ? currentParentId : undefined }
    });
  };

  const handleSave = async (type: 'pillar' | 'theme' | 'subtheme' | 'indicator') => {
    if (!editData) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const tableMap = {
        pillar: 'framework_pillars',
        theme: 'framework_themes',
        subtheme: 'framework_subthemes',
        indicator: 'framework_indicators'
      };
      
      const updateData: any = {
        name: editData.name,
        code: editData.code, // Make code editable
        description: editData.description || null,
        order_index: editData.order_index || 0,
      };
      
      // Handle parent relationship changes - always update if provided
      if (type === 'theme') {
        if (editData.pillar_id) {
          updateData.pillar_id = editData.pillar_id;
          if (editData.pillar_id !== editData.originalParentId) {
            console.log(`Moving theme ${editData.id} from pillar ${editData.originalParentId} to ${editData.pillar_id}`);
          }
        } else {
          setError('Please select a pillar for this theme');
          setSaving(false);
          return;
        }
      } else if (type === 'subtheme') {
        if (editData.theme_id) {
          updateData.theme_id = editData.theme_id;
          if (editData.theme_id !== editData.originalParentId) {
            console.log(`Moving subtheme ${editData.id} from theme ${editData.originalParentId} to ${editData.theme_id}`);
          }
        } else {
          setError('Please select a theme for this sub-theme');
          setSaving(false);
          return;
        }
      } else if (type === 'indicator') {
        if (editData.subtheme_id) {
          updateData.subtheme_id = editData.subtheme_id;
          if (editData.subtheme_id !== editData.originalParentId) {
            console.log(`Moving indicator ${editData.id} from subtheme ${editData.originalParentId} to ${editData.subtheme_id}`);
          }
        } else {
          setError('Please select a sub-theme for this indicator');
          setSaving(false);
          return;
        }
      }
      
      console.log('Updating with data:', updateData);
      
      // Add indicator-specific fields
      if (type === 'indicator') {
        updateData.unit = editData.unit || null;
      }
      
      const { error: updateError } = await supabase
        .from(tableMap[type])
        .update(updateData)
        .eq('id', editData.id);
      
      if (updateError) throw updateError;
      
      setEditing(null);
      setEditData(null);
      await loadStructure();
    } catch (err: any) {
      console.error('Error saving:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: 'pillar' | 'theme' | 'subtheme' | 'indicator', id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) {
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const tableMap = {
        pillar: 'framework_pillars',
        theme: 'framework_themes',
        subtheme: 'framework_subthemes',
        indicator: 'framework_indicators'
      };
      
      const { error: deleteError } = await supabase
        .from(tableMap[type])
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      await loadStructure();
    } catch (err: any) {
      console.error('Error deleting:', err);
      setError(err.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveOrder = async (type: 'pillar' | 'theme' | 'subtheme' | 'indicator', id: string, direction: 'up' | 'down') => {
    if (!structure) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Find the item and its siblings
      let siblings: any[] = [];
      
      if (type === 'pillar') {
        siblings = [...(structure.pillars || [])];
      } else if (type === 'theme') {
        // Find which pillar this theme belongs to
        for (const p of structure.pillars || []) {
          const theme = p.themes?.find((t: any) => t.id === id);
          if (theme) {
            siblings = [...(p.themes || [])];
            break;
          }
        }
      } else if (type === 'subtheme') {
        // Find which theme this subtheme belongs to
        for (const p of structure.pillars || []) {
          for (const t of p.themes || []) {
            const subtheme = t.subthemes?.find((st: any) => st.id === id);
            if (subtheme) {
              siblings = [...(t.subthemes || [])];
              break;
            }
          }
          if (siblings.length > 0) break;
        }
      } else if (type === 'indicator') {
        // Find which subtheme this indicator belongs to
        for (const p of structure.pillars || []) {
          for (const t of p.themes || []) {
            for (const st of t.subthemes || []) {
              const indicator = st.indicators?.find((i: any) => i.id === id);
              if (indicator) {
                siblings = [...(st.indicators || [])];
                break;
              }
            }
            if (siblings.length > 0) break;
          }
          if (siblings.length > 0) break;
        }
      }
      
      // Sort siblings by order_index
      siblings.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
      
      // Find current item index
      const currentIndex = siblings.findIndex((s: any) => s.id === id);
      if (currentIndex === -1) return;
      
      // Calculate new index
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= siblings.length) return;
      
      // Swap order_index values
      const currentItem = siblings[currentIndex];
      const targetItem = siblings[newIndex];
      
      const tableMap = {
        pillar: 'framework_pillars',
        theme: 'framework_themes',
        subtheme: 'framework_subthemes',
        indicator: 'framework_indicators'
      };
      
      // Update both items
      const updates = [
        supabase.from(tableMap[type]).update({ order_index: targetItem.order_index || 0 }).eq('id', currentItem.id),
        supabase.from(tableMap[type]).update({ order_index: currentItem.order_index || 0 }).eq('id', targetItem.id)
      ];
      
      await Promise.all(updates);
      
      await loadStructure();
    } catch (err: any) {
      console.error('Error reordering:', err);
      setError(err.message || 'Failed to reorder');
    } finally {
      setSaving(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !structure) {
      console.log('Drag ended without over target or structure');
      return;
    }

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    console.log('Drag ended:', { activeIdStr, overIdStr });

    // Parse the IDs - split only on first hyphen since UUIDs contain hyphens
    const activeParts = activeIdStr.split('-');
    const overParts = overIdStr.split('-');
    
    if (activeParts.length < 2 || overParts.length < 2) {
      console.warn('Failed to parse drag IDs:', { activeIdStr, overIdStr });
      return;
    }

    const activeType = activeParts[0]; // 'pillar', 'theme', 'subtheme', 'indicator'
    const activeItemId = activeParts.slice(1).join('-'); // Everything after first hyphen (the full UUID)
    const overType = overParts[0];
    const overItemId = overParts.slice(1).join('-'); // Everything after first hyphen (the full UUID)

    if (!activeType || !activeItemId || !overType || !overItemId) {
      console.warn('Failed to parse drag IDs:', { activeIdStr, overIdStr, activeType, activeItemId, overType, overItemId });
      return;
    }
    
    console.log('Parsed IDs:', { activeType, activeItemId, overType, overItemId });

    if (activeType === overType) {
      // Same type - reordering within same parent
      console.log(`Reordering ${activeType} ${activeItemId} to position of ${overItemId}`);
      await handleReorderSameType(activeType as 'pillar' | 'theme' | 'subtheme' | 'indicator', activeItemId, overItemId);
    } else {
      // Different types - moving to different parent
      console.log(`Moving ${activeType} ${activeItemId} to ${overType} ${overItemId}`);
      await handleMoveToDifferentParent(
        activeType as 'pillar' | 'theme' | 'subtheme' | 'indicator', 
        activeItemId, 
        overType as 'pillar' | 'theme' | 'subtheme' | 'indicator', 
        overItemId
      );
    }
  };

  const handleReorderSameType = async (
    type: 'pillar' | 'theme' | 'subtheme' | 'indicator',
    activeId: string,
    overId: string
  ) => {
    if (!structure || activeId === overId) return;

    setSaving(true);
    setError(null);

    try {
      const tableMap = {
        pillar: 'framework_pillars',
        theme: 'framework_themes',
        subtheme: 'framework_subthemes',
        indicator: 'framework_indicators'
      };

      // Find items and their siblings
      let items: any[] = [];
      let parentId: string | null = null;

      if (type === 'pillar') {
        items = [...(structure.pillars || [])];
      } else if (type === 'theme') {
        for (const p of structure.pillars || []) {
          const theme = p.themes?.find((t: any) => t.id === activeId);
          if (theme) {
            items = [...(p.themes || [])];
            parentId = p.id;
            break;
          }
        }
      } else if (type === 'subtheme') {
        for (const p of structure.pillars || []) {
          for (const t of p.themes || []) {
            const subtheme = t.subthemes?.find((st: any) => st.id === activeId);
            if (subtheme) {
              items = [...(t.subthemes || [])];
              parentId = t.id;
              break;
            }
          }
          if (items.length > 0) break;
        }
      } else if (type === 'indicator') {
        for (const p of structure.pillars || []) {
          for (const t of p.themes || []) {
            for (const st of t.subthemes || []) {
              const indicator = st.indicators?.find((i: any) => i.id === activeId);
              if (indicator) {
                items = [...(st.indicators || [])];
                parentId = st.id;
                break;
              }
            }
            if (items.length > 0) break;
          }
          if (items.length > 0) break;
        }
      }

      // Sort by order_index
      items.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      const oldIndex = items.findIndex((item: any) => item.id === activeId);
      const newIndex = items.findIndex((item: any) => item.id === overId);

      console.log(`Reordering ${type}:`, {
        activeId,
        overId,
        oldIndex,
        newIndex,
        itemsCount: items.length,
        itemsIds: items.map((i: any) => i.id)
      });

      if (oldIndex === -1 || newIndex === -1) {
        console.warn(`Could not find index for ${type}:`, { activeId, overId, oldIndex, newIndex });
        return;
      }

      const reordered = arrayMove(items, oldIndex, newIndex);
      console.log(`Reordered ${type} array:`, reordered.map((i: any) => ({ id: i.id, name: i.name, order_index: i.order_index })));

      // Update order_index for all affected items
      const updates = reordered.map((item: any, index: number) =>
        supabase.from(tableMap[type]).update({ order_index: index }).eq('id', item.id)
      );

      await Promise.all(updates);
      await loadStructure();
    } catch (err: any) {
      console.error('Error reordering:', err);
      setError(err.message || 'Failed to reorder');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveToDifferentParent = async (
    activeType: 'pillar' | 'theme' | 'subtheme' | 'indicator',
    activeId: string,
    overType: 'pillar' | 'theme' | 'subtheme' | 'indicator',
    overId: string
  ) => {
    if (!structure) return;

    // Only allow moving themes to pillars, subthemes to themes, indicators to subthemes
    const validMoves: Record<string, string[]> = {
      theme: ['pillar'],
      subtheme: ['theme'],
      indicator: ['subtheme']
    };

    if (!validMoves[activeType]?.includes(overType)) {
      setError(`Cannot move ${activeType} to ${overType}. Only themes can move to pillars, subthemes to themes, and indicators to subthemes.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const tableMap = {
        pillar: 'framework_pillars',
        theme: 'framework_themes',
        subtheme: 'framework_subthemes',
        indicator: 'framework_indicators'
      };

      // Find the active item
      let activeItem: any = null;
      let newParentId: string | null = null;

      if (activeType === 'theme') {
        for (const p of structure.pillars || []) {
          const theme = p.themes?.find((t: any) => t.id === activeId);
          if (theme) {
            activeItem = theme;
            break;
          }
        }
        // Find the target pillar
        const targetPillar = structure.pillars?.find((p: any) => p.id === overId);
        if (targetPillar) newParentId = targetPillar.id;
      } else if (activeType === 'subtheme') {
        for (const p of structure.pillars || []) {
          for (const t of p.themes || []) {
            const subtheme = t.subthemes?.find((st: any) => st.id === activeId);
            if (subtheme) {
              activeItem = subtheme;
              break;
            }
          }
          if (activeItem) break;
        }
        // Find the target theme
        for (const p of structure.pillars || []) {
          const theme = p.themes?.find((t: any) => t.id === overId);
          if (theme) {
            newParentId = theme.id;
            break;
          }
        }
      } else if (activeType === 'indicator') {
        for (const p of structure.pillars || []) {
          for (const t of p.themes || []) {
            for (const st of t.subthemes || []) {
              const indicator = st.indicators?.find((i: any) => i.id === activeId);
              if (indicator) {
                activeItem = indicator;
                break;
              }
            }
            if (activeItem) break;
          }
          if (activeItem) break;
        }
        // Find the target subtheme
        for (const p of structure.pillars || []) {
          for (const t of p.themes || []) {
            const subtheme = t.subthemes?.find((st: any) => st.id === overId);
            if (subtheme) {
              newParentId = subtheme.id;
              break;
            }
          }
          if (newParentId) break;
        }
      }

      if (!activeItem || !newParentId) {
        setError('Could not find item or target parent');
        return;
      }

      // Get the new parent's children to determine the new order_index
      let newSiblings: any[] = [];
      if (activeType === 'theme') {
        const targetPillar = structure.pillars?.find((p: any) => p.id === newParentId);
        newSiblings = [...(targetPillar?.themes || [])];
      } else if (activeType === 'subtheme') {
        for (const p of structure.pillars || []) {
          const theme = p.themes?.find((t: any) => t.id === newParentId);
          if (theme) {
            newSiblings = [...(theme.subthemes || [])];
            break;
          }
        }
      } else if (activeType === 'indicator') {
        for (const p of structure.pillars || []) {
          for (const t of p.themes || []) {
            const subtheme = t.subthemes?.find((st: any) => st.id === newParentId);
            if (subtheme) {
              newSiblings = [...(subtheme.indicators || [])];
              break;
            }
          }
          if (newSiblings.length > 0) break;
        }
      }

      const newOrderIndex = newSiblings.length;

      // Update the item with new parent and order
      const updateData: any = {
        order_index: newOrderIndex,
      };

      if (activeType === 'theme') {
        updateData.pillar_id = newParentId;
      } else if (activeType === 'subtheme') {
        updateData.theme_id = newParentId;
      } else if (activeType === 'indicator') {
        updateData.subtheme_id = newParentId;
      }

      const { error: updateError } = await supabase
        .from(tableMap[activeType])
        .update(updateData)
        .eq('id', activeId);

      if (updateError) throw updateError;

      await loadStructure();
    } catch (err: any) {
      console.error('Error moving item:', err);
      setError(err.message || 'Failed to move item');
    } finally {
      setSaving(false);
    }
  };

  const handleFixOrdering = async () => {
    if (!structure) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const updates: Promise<any>[] = [];
      
      // Fix pillar ordering
      (structure.pillars || []).forEach((p: any, index: number) => {
        if (p.order_index !== index) {
          updates.push(
            Promise.resolve(supabase.from('framework_pillars').update({ order_index: index }).eq('id', p.id)).then((result) => {
              if (result.error) throw result.error;
              return result;
            })
          );
        }
      });
      
      // Fix theme ordering within each pillar
      (structure.pillars || []).forEach((p: any) => {
        (p.themes || []).forEach((t: any, index: number) => {
          if (t.order_index !== index) {
            updates.push(
              Promise.resolve(supabase.from('framework_themes').update({ order_index: index }).eq('id', t.id)).then((result) => {
                if (result.error) throw result.error;
                return result;
              })
            );
          }
        });
      });
      
      // Fix subtheme ordering within each theme
      (structure.pillars || []).forEach((p: any) => {
        (p.themes || []).forEach((t: any) => {
          (t.subthemes || []).forEach((st: any, index: number) => {
            if (st.order_index !== index) {
              updates.push(
                Promise.resolve(supabase.from('framework_subthemes').update({ order_index: index }).eq('id', st.id)).then((result) => {
                  if (result.error) throw result.error;
                  return result;
                })
              );
            }
          });
        });
      });
      
      // Fix indicator ordering within each subtheme
      (structure.pillars || []).forEach((p: any) => {
        (p.themes || []).forEach((t: any) => {
          (t.subthemes || []).forEach((st: any) => {
            (st.indicators || []).forEach((i: any, index: number) => {
              if (i.order_index !== index) {
                updates.push(
                  Promise.resolve(supabase.from('framework_indicators').update({ order_index: index }).eq('id', i.id)).then((result) => {
                    if (result.error) throw result.error;
                    return result;
                  })
                );
              }
            });
          });
        });
      });
      
      if (updates.length > 0) {
        await Promise.all(updates);
        await loadStructure();
        setError(null);
      } else {
        setError('Ordering is already correct');
      }
    } catch (err: any) {
      console.error('Error fixing ordering:', err);
      setError(err.message || 'Failed to fix ordering');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Framework Structure Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading framework structure...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : structure && structure.pillars && structure.pillars.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="space-y-4">
                <SortableContext
                  items={structure.pillars.map(p => `pillar-${p.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {structure.pillars.map((pillar) => (
                    <SortableItem key={pillar.id} id={pillar.id} type="pillar" disabled={editing !== null}>
                      <div className="border border-gray-200 rounded-lg">
                        {/* Pillar Header */}
                        <div className="bg-blue-50 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <button
                              onClick={() => toggleExpand(`p-${pillar.id}`)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              {expanded.has(`p-${pillar.id}`) ? (
                                <ChevronDown size={20} />
                              ) : (
                                <ChevronRight size={20} />
                              )}
                            </button>
                      {editing === `pillar-${pillar.id}` ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editData?.code || ''}
                            onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                            placeholder="Code"
                            title="Pillar code (e.g., P1, P2, P3)"
                          />
                          <input
                            type="text"
                            value={editData?.name || ''}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded"
                            placeholder="Name"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-blue-900">{pillar.code}</span>
                          <span className="text-gray-900">{pillar.name}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editing === `pillar-${pillar.id}` ? (
                        <>
                          <button
                            onClick={() => handleSave('pillar')}
                            disabled={saving}
                            className="p-1 text-green-600 hover:text-green-700"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(null);
                              setEditData(null);
                            }}
                            className="p-1 text-gray-600 hover:text-gray-700"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit('pillar', pillar)}
                            className="p-1 text-blue-600 hover:text-blue-700"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete('pillar', pillar.id)}
                            className="p-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                        </div>

                        {/* Themes */}
                        {expanded.has(`p-${pillar.id}`) && (
                          <SortableContext
                            items={(pillar.themes || []).map(t => `theme-${t.id}`)}
                            strategy={verticalListSortingStrategy}
                          >
                            {pillar.themes?.map((theme) => (
                              <SortableItem key={theme.id} id={theme.id} type="theme" disabled={editing !== null}>
                                <div className="border-t border-gray-200 bg-gray-50">
                      <div className="px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 pl-6">
                          <button
                            onClick={() => toggleExpand(`t-${theme.id}`)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            {expanded.has(`t-${theme.id}`) ? (
                              <ChevronDown size={18} />
                            ) : (
                              <ChevronRight size={18} />
                            )}
                          </button>
                          {editing === `theme-${theme.id}` ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={editData?.code || ''}
                                onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                                placeholder="Code"
                                title="Theme code (e.g., P1-T1)"
                              />
                              <input
                                type="text"
                                value={editData?.name || ''}
                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Name"
                                autoFocus
                              />
                              <select
                                value={editData?.pillar_id || ''}
                                onChange={(e) => {
                                  const newPillarId = e.target.value;
                                  const newPillar = structure?.pillars?.find((p: any) => p.id === newPillarId);
                                  // Auto-update code if it follows pattern, but allow manual override
                                  let newCode = editData?.code || '';
                                  if (newPillar && editData?.code) {
                                    // Try to preserve the theme number if code follows pattern
                                    const match = editData.code.match(/-T(\d+)$/);
                                    if (match) {
                                      newCode = `${newPillar.code}-T${match[1]}`;
                                    } else {
                                      // Just prepend new pillar code
                                      newCode = `${newPillar.code}-${editData.code.split('-').slice(1).join('-')}`;
                                    }
                                  }
                                  console.log(`Changing theme pillar from ${editData?.pillar_id} to ${newPillarId}`);
                                  setEditData({ ...editData, pillar_id: newPillarId, code: newCode });
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm min-w-[200px]"
                                title="Move to different pillar"
                              >
                                <option value="">Select pillar...</option>
                                {structure?.pillars?.map((p: any) => (
                                  <option key={p.id} value={p.id}>
                                    {p.code} - {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <>
                              <span className="font-medium text-gray-700">{theme.code}</span>
                              <span className="text-gray-700 text-sm">{theme.name}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {editing === `theme-${theme.id}` ? (
                            <>
                              <button
                                onClick={() => handleSave('theme')}
                                disabled={saving}
                                className="p-1 text-green-600 hover:text-green-700"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditing(null);
                                  setEditData(null);
                                }}
                                className="p-1 text-gray-600 hover:text-gray-700"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                        <>
                          <button
                            onClick={() => handleEdit('theme', theme, structure?.pillars)}
                            className="p-1 text-blue-600 hover:text-blue-700"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete('theme', theme.id)}
                            className="p-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                                  </div>
                                </div>

                                {/* Sub-themes */}
                                {expanded.has(`t-${theme.id}`) && theme.subthemes && (
                          <SortableContext
                            items={theme.subthemes.map(st => `subtheme-${st.id}`)}
                            strategy={verticalListSortingStrategy}
                          >
                            {theme.subthemes.map((subtheme) => (
                              <SortableItem key={subtheme.id} id={subtheme.id} type="subtheme" disabled={editing !== null}>
                                <div className="border-t border-gray-200 bg-white">
                          <div className="px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 pl-12">
                              <button
                                onClick={() => toggleExpand(`st-${subtheme.id}`)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                {expanded.has(`st-${subtheme.id}`) ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                              </button>
                              {editing === `subtheme-${subtheme.id}` ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editData?.code || ''}
                                    onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                                    className="w-36 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                                    placeholder="Code"
                                    title="Sub-theme code (e.g., P1-T1-ST1)"
                                  />
                                  <input
                                    type="text"
                                    value={editData?.name || ''}
                                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                    placeholder="Name"
                                    autoFocus
                                  />
                                  <select
                                    value={editData?.theme_id || ''}
                                    onChange={(e) => {
                                      const newThemeId = e.target.value;
                                      const newTheme = structure?.pillars?.flatMap((p: any) => p.themes || []).find((t: any) => t.id === newThemeId);
                                      let newCode = editData?.code || '';
                                      if (newTheme && editData?.code) {
                                        const match = editData.code.match(/-ST(\d+)$/);
                                        if (match) {
                                          newCode = `${newTheme.code}-ST${match[1]}`;
                                        } else {
                                          newCode = `${newTheme.code}-${editData.code.split('-').slice(-1)[0]}`;
                                        }
                                      }
                                      setEditData({ ...editData, theme_id: newThemeId, code: newCode });
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm min-w-[200px]"
                                    title="Move to different theme"
                                  >
                                    <option value="">Select theme...</option>
                                    {structure?.pillars?.flatMap((p: any) => 
                                      p.themes?.map((t: any) => (
                                        <option key={t.id} value={t.id}>
                                          {p.name} → {t.name}
                                        </option>
                                      )) || []
                                    )}
                                  </select>
                                </div>
                              ) : (
                                <>
                                  <span className="text-gray-600 text-sm">{subtheme.code}</span>
                                  <span className="text-gray-600 text-sm">{subtheme.name}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {editing === `subtheme-${subtheme.id}` ? (
                                <>
                                  <button
                                    onClick={() => handleSave('subtheme')}
                                    disabled={saving}
                                    className="p-1 text-green-600 hover:text-green-700"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditing(null);
                                      setEditData(null);
                                    }}
                                    className="p-1 text-gray-600 hover:text-gray-700"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEdit('subtheme', subtheme, structure?.pillars?.flatMap((p: any) => p.themes || []))}
                                    className="p-1 text-blue-600 hover:text-blue-700"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete('subtheme', subtheme.id)}
                                    className="p-1 text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Indicators */}
                          {expanded.has(`st-${subtheme.id}`) && subtheme.indicators && (
                            <SortableContext
                              items={subtheme.indicators.map(i => `indicator-${i.id}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              {subtheme.indicators.map((indicator) => (
                                <SortableItem key={indicator.id} id={indicator.id} type="indicator" disabled={editing !== null}>
                                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-1.5 flex items-center justify-between pl-20">
                              <div className="flex items-center gap-2 flex-1">
                                {editing === `indicator-${indicator.id}` ? (
                                  <div className="flex-1 flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editData?.code || ''}
                                      onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                                      className="w-24 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                      placeholder="Code"
                                      title="Indicator code"
                                    />
                                    <input
                                      type="text"
                                      value={editData?.name || ''}
                                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                                      placeholder="Name"
                                      autoFocus
                                    />
                                    <select
                                      value={editData?.subtheme_id || ''}
                                      onChange={(e) => {
                                        const newSubthemeId = e.target.value;
                                        const newSubtheme = structure?.pillars?.flatMap((p: any) => 
                                          p.themes?.flatMap((t: any) => t.subthemes || []) || []
                                        ).find((st: any) => st.id === newSubthemeId);
                                        let newCode = editData?.code || '';
                                        if (newSubtheme && editData?.code) {
                                          // Try to preserve indicator number
                                          const match = editData.code.match(/-I(\d+)$/);
                                          if (match) {
                                            newCode = `${newSubtheme.code}-I${match[1]}`;
                                          } else {
                                            newCode = `${newSubtheme.code}-${editData.code.split('-').slice(-1)[0]}`;
                                          }
                                        }
                                        setEditData({ ...editData, subtheme_id: newSubthemeId, code: newCode });
                                      }}
                                      className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[250px]"
                                      title="Move to different sub-theme"
                                    >
                                      <option value="">Select sub-theme...</option>
                                      {structure?.pillars?.flatMap((p: any) => 
                                        p.themes?.flatMap((t: any) => 
                                          t.subthemes?.map((st: any) => (
                                            <option key={st.id} value={st.id}>
                                              {p.name} → {t.name} → {st.name}
                                            </option>
                                          )) || []
                                        ) || []
                                      )}
                                    </select>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-xs text-gray-500">{indicator.code}</span>
                                    <span className="text-xs text-gray-600">{indicator.name}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {editing === `indicator-${indicator.id}` ? (
                                  <>
                                    <button
                                      onClick={() => handleSave('indicator')}
                                      disabled={saving}
                                      className="p-1 text-green-600 hover:text-green-700"
                                    >
                                      <Save size={12} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditing(null);
                                        setEditData(null);
                                      }}
                                      className="p-1 text-gray-600 hover:text-gray-700"
                                    >
                                      <X size={12} />
                                    </button>
                                  </>
                                ) : (
                                <>
                                  <button
                                    onClick={() => handleEdit('indicator', indicator, structure?.pillars?.flatMap((p: any) => 
                                      p.themes?.flatMap((t: any) => t.subthemes || []) || []
                                    ) || [])}
                                    className="p-1 text-blue-600 hover:text-blue-700"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete('indicator', indicator.id)}
                                    className="p-1 text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                                  )}
                                  </div>
                                </div>
                              </SortableItem>
                              ))}
                            </SortableContext>
                          )}
                                </div>
                              </SortableItem>
                            ))}
                          </SortableContext>
                        )}
                                </div>
                              </SortableItem>
                            ))}
                          </SortableContext>
                        )}
                      </div>
                    </SortableItem>
                  ))}
                </SortableContext>
              </div>
              <DragOverlay>
                {activeId ? (
                  <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-lg opacity-90">
                    <span className="text-sm text-gray-700">Dragging...</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No framework structure found.</p>
              <p className="text-sm text-gray-500 mb-4">
                The framework structure (pillars, themes, sub-themes, indicators) needs to be imported.
              </p>
              <div className="text-xs text-gray-400 space-y-1">
                <p>To import the framework structure:</p>
                <p>1. Run the database migration: <code className="bg-gray-100 px-1 rounded">supabase/migrations/37_create_framework_structure_tables.sql</code></p>
                <p>2. Run the migration script: <code className="bg-gray-100 px-1 rounded">python scripts/migrate_framework_auto.py</code></p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleFixOrdering}
            disabled={loading || saving || !structure}
            className="px-4 py-2 border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-50 transition text-sm"
            title="Fix ordering: Reassigns order_index values based on current display order"
          >
            Fix Ordering
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={loadStructure}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
