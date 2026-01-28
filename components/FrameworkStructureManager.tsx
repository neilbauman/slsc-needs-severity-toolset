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
    indicators?: Array<{
      id: string;
      code: string;
      name: string;
      description?: string;
      unit?: string;
      order_index: number;
    }>;
    themes?: Array<{
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
  
  // Validate Supabase client on mount
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError(
        'Supabase configuration missing.\n\n' +
        'Please ensure your .env.local file contains:\n' +
        'NEXT_PUBLIC_SUPABASE_URL=your_supabase_url\n' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key'
      );
    }
  }, []);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => {
    if (open) {
      // Clear any previous errors when opening the modal
      setError(null);
      // Small delay to ensure modal is fully mounted
      setTimeout(() => {
        loadStructure();
      }, 100);
    }
  }, [open]);

  const loadStructure = async () => {
    // Preserve expanded state before reloading
    const previousExpanded = new Set(expanded);
    
    setLoading(true);
    setError(null);
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Safety check - ensure we have a valid supabase client
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      // Validate environment variables
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error(
          'Supabase configuration missing. Please check your .env.local file contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
        );
      }
      // Skip RPC entirely - it may reference pillar_id/theme_id which aren't in schema cache yet
      // Go straight to safe table queries with fallback handling
      let pillars: any[] = [];
      
      console.log('[FrameworkStructureManager] Starting to load framework structure...');
      
      // Add timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        console.error('[FrameworkStructureManager] Query timeout - queries taking too long (>30s)');
        setError('Request timed out after 30 seconds. The database may be slow or unresponsive.\n\nPlease check:\n1. Your internet connection\n2. Supabase service status\n3. Try clicking "Retry" again');
        setLoading(false);
      }, 30000); // 30 second timeout
      
      // Query tables directly with safe fallback for schema cache issues
      console.log('[FrameworkStructureManager] Executing queries for pillars, themes, subthemes...');
      
      // Test connection first with a simple query
      try {
        const testQuery = await supabase.from('framework_pillars').select('id').limit(1);
        if (testQuery.error && (testQuery.error.message?.includes('Failed to fetch') || testQuery.error.message?.includes('NetworkError'))) {
          throw new Error('Cannot connect to Supabase. Please check your internet connection and Supabase project status.');
        }
      } catch (testErr: any) {
        if (testErr.message?.includes('Failed to fetch') || testErr.message?.includes('NetworkError')) {
          throw new Error('Network error: Cannot reach Supabase. Please check:\n1. Your internet connection\n2. Supabase project is active\n3. No firewall/CORS blocking requests');
        }
        // If it's a different error (like table doesn't exist), continue with the main queries
      }
      
      const [pillarsRes, themesRes, subthemesRes] = await Promise.all([
        supabase.from('framework_pillars').select('*').eq('is_active', true).order('order_index'),
        supabase.from('framework_themes').select('*').eq('is_active', true).order('order_index'),
        supabase.from('framework_subthemes').select('*').eq('is_active', true).order('order_index')
      ]);
      
      if (pillarsRes.error) throw pillarsRes.error;
      if (themesRes.error) throw themesRes.error;
      if (subthemesRes.error) throw subthemesRes.error;
      
      // Query indicators - try safe query first (without new columns) to avoid schema cache issues
      // Then try to get the new columns if available
      let indicatorsRes: any = { data: [], error: null };
      
      try {
        // Query indicators with all columns including pillar_id and theme_id
        // The migration has been applied, so these columns should now exist
        console.log('[FrameworkStructureManager] Querying indicators with all columns (including pillar_id/theme_id)...');
        indicatorsRes = await supabase.from('framework_indicators')
          .select('id, pillar_id, theme_id, subtheme_id, code, name, description, data_type, unit, order_index, is_active, created_at, updated_at')
          .eq('is_active', true)
          .order('order_index');
        
        console.log('[FrameworkStructureManager] Indicators query result:', { 
          hasData: !!indicatorsRes.data, 
          dataLength: indicatorsRes.data?.length || 0,
          error: indicatorsRes.error?.message || null 
        });
        
        if (indicatorsRes.error) {
          // Check if it's a schema cache error
          if (indicatorsRes.error.message?.includes('pillar_id') || 
              indicatorsRes.error.message?.includes('theme_id') ||
              indicatorsRes.error.message?.includes('Could not find') ||
              indicatorsRes.error.code === 'PGRST202') {
            console.error('[FrameworkStructureManager] Schema cache error detected:', indicatorsRes.error);
            
            throw new Error(
              `Schema cache error detected.\n\n` +
              `The database columns exist, but Supabase's API cache needs to be refreshed.\n\n` +
              `Please:\n` +
              `1. Go to your Supabase Dashboard\n` +
              `2. Navigate to Settings > API\n` +
              `3. Click "Reload schema" button\n` +
              `4. Wait 1-2 minutes\n` +
              `5. Hard refresh your browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)\n` +
              `6. Then click "Retry" again\n\n` +
              `Original error: ${indicatorsRes.error.message}`
            );
          }
          throw indicatorsRes.error;
        }
        
        console.log(`Loaded ${indicatorsRes.data.length} indicators (with pillar_id/theme_id columns)`);
      } catch (err: any) {
        // If even the safe query fails, that's a real problem
        const errorMsg = err?.message || err?.toString() || 'Unknown error';
        if (errorMsg.includes('pillar_id') || errorMsg.includes('theme_id') || errorMsg.includes('Could not find')) {
          throw new Error(
            `Schema cache error: ${errorMsg}\n\n` +
            `To fix this:\n` +
            `1. Go to your Supabase Dashboard\n` +
            `2. Navigate to Settings > API\n` +
            `3. Click "Reload schema" button\n` +
            `4. Wait 1-2 minutes, then click "Retry" below`
          );
        }
        throw new Error(
          `Failed to load framework indicators: ${errorMsg}\n\n` +
          `This might be a database connection issue. Please check your Supabase connection.`
        );
      }
      
      // Build hierarchy manually
        const themes = (themesRes.data || []).filter((t: any) => t != null);
        const subthemes = (subthemesRes.data || []).filter((st: any) => st != null);
        const indicators = (indicatorsRes.data || []).filter((i: any) => i != null);
        
        pillars = (pillarsRes.data || []).map(p => ({
          ...p,
          indicators: (indicators || [])
            .filter(i => i && i.pillar_id === p.id)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
          themes: (themes || [])
            .filter(t => t && t.pillar_id === p.id)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
            .map(t => ({
              ...t,
              indicators: (indicators || [])
                .filter(i => i && i.theme_id === t.id)
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
              subthemes: (subthemes || [])
                .filter(st => st && st.theme_id === t.id)
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map(st => ({
                  ...st,
                  indicators: (indicators || [])
                    .filter(i => i && i.subtheme_id === st.id)
                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                }))
            }))
        }));
      
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
      console.error('[FrameworkStructureManager] Error loading framework structure:', err);
      let errorMessage = err?.message || err?.toString() || 'Failed to load framework structure. Check browser console for details.';
      
      // Provide more helpful error messages for common issues
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
        errorMessage = 
          'Network error: Unable to connect to Supabase.\n\n' +
          'Please check:\n' +
          '1. Your internet connection\n' +
          '2. Your Supabase project is active and accessible\n' +
          '3. Your .env.local file has correct NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
          '4. There are no CORS or firewall issues blocking the connection\n\n' +
          'If the issue persists, try:\n' +
          '- Restarting your Next.js dev server\n' +
          '- Checking the browser console (F12) for more details';
      } else if (errorMessage.includes('Invalid API key') || errorMessage.includes('JWT')) {
        errorMessage = 
          'Supabase authentication error.\n\n' +
          'Please verify your NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local is correct.';
      } else if (errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
        errorMessage = 
          'Database table not found.\n\n' +
          'The framework tables may not exist. Please run the migration scripts:\n' +
          '- supabase/migrations/37_create_framework_structure_tables.sql\n' +
          '- supabase/migrations/53_enhance_framework_indicators_for_all_levels.sql';
      }
      
      setError(errorMessage);
      // Don't crash - set empty structure instead
      setStructure({ pillars: [] });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setLoading(false);
      console.log('[FrameworkStructureManager] Loading complete (loading state cleared)');
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
      // Find which parent (pillar, theme, or subtheme) this indicator belongs to
      for (const p of structure?.pillars || []) {
        // Check pillar-level indicators
        if (p.indicators?.find((i: any) => i.id === item.id)) {
          originalParentId = p.id;
          currentParentId = p.id;
          break;
        }
        // Check theme-level indicators
        for (const t of p.themes || []) {
          if (t.indicators?.find((i: any) => i.id === item.id)) {
            originalParentId = t.id;
            currentParentId = t.id;
            break;
          }
          // Check subtheme-level indicators
          for (const st of t.subthemes || []) {
            if (st.indicators?.find((i: any) => i.id === item.id)) {
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
      pillar_id: type === 'theme' ? (currentParentId || item.pillar_id) : 
                 type === 'indicator' && originalParentId && structure?.pillars?.some((p: any) => p.id === originalParentId) ? originalParentId : item.pillar_id,
      theme_id: type === 'subtheme' ? (currentParentId || item.theme_id) :
                type === 'indicator' && originalParentId && structure?.pillars?.some((p: any) => 
                  p.themes?.some((t: any) => t.id === originalParentId)) ? originalParentId : item.theme_id,
      subtheme_id: type === 'indicator' && originalParentId && structure?.pillars?.some((p: any) => 
                    p.themes?.some((t: any) => t.subthemes?.some((st: any) => st.id === originalParentId))) ? originalParentId : item.subtheme_id,
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
        // Indicators can belong to pillar, theme, or subtheme
        if (editData.pillar_id) {
          updateData.pillar_id = editData.pillar_id;
          updateData.theme_id = null;
          updateData.subtheme_id = null;
          if (editData.pillar_id !== editData.originalParentId) {
            console.log(`Moving indicator ${editData.id} to pillar ${editData.pillar_id}`);
          }
        } else if (editData.theme_id) {
          updateData.theme_id = editData.theme_id;
          updateData.pillar_id = null;
          updateData.subtheme_id = null;
          if (editData.theme_id !== editData.originalParentId) {
            console.log(`Moving indicator ${editData.id} to theme ${editData.theme_id}`);
          }
        } else if (editData.subtheme_id) {
          updateData.subtheme_id = editData.subtheme_id;
          updateData.pillar_id = null;
          updateData.theme_id = null;
          if (editData.subtheme_id !== editData.originalParentId) {
            console.log(`Moving indicator ${editData.id} to subtheme ${editData.subtheme_id}`);
          }
        } else {
          setError('Please select a pillar, theme, or sub-theme for this indicator');
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

  const handleAddNew = async (
    type: 'pillar' | 'theme' | 'subtheme' | 'indicator',
    parentId?: string,
    parentType?: 'pillar' | 'theme' | 'subtheme'
  ) => {
    setSaving(true);
    setError(null);
    
    try {
      let newItem: any = {
        name: `New ${type}`,
        code: '',
        description: null,
        order_index: 0,
        is_active: true,
      };

      if (type === 'pillar') {
        // Find the highest order_index and add 1
        const maxOrder = structure?.pillars?.reduce((max: number, p: any) => 
          Math.max(max, p.order_index || 0), -1) || -1;
        newItem.code = `P${(structure?.pillars?.length || 0) + 1}`;
        newItem.order_index = maxOrder + 1;
        
        const { data, error } = await supabase
          .from('framework_pillars')
          .insert(newItem)
          .select()
          .single();
        
        if (error) throw error;
        await loadStructure();
        if (data) {
          setExpanded(prev => new Set([...prev, `p-${data.id}`]));
          handleEdit('pillar', data);
        }
      } else if (type === 'theme') {
        if (!parentId) {
          setError('Please select a pillar first');
          setSaving(false);
          return;
        }
        const parentPillar = structure?.pillars?.find((p: any) => p.id === parentId);
        if (!parentPillar) {
          setError('Parent pillar not found');
          setSaving(false);
          return;
        }
        
        const themes = parentPillar.themes || [];
        const maxOrder = themes.reduce((max: number, t: any) => 
          Math.max(max, t.order_index || 0), -1);
        const themeNum = themes.length + 1;
        newItem.pillar_id = parentId;
        newItem.code = `${parentPillar.code}-T${themeNum}`;
        newItem.order_index = maxOrder + 1;
        
        const { data, error } = await supabase
          .from('framework_themes')
          .insert(newItem)
          .select()
          .single();
        
        if (error) throw error;
        await loadStructure();
        if (data) {
          setExpanded(prev => new Set([...prev, `p-${parentId}`, `t-${data.id}`]));
          handleEdit('theme', data, structure?.pillars);
        }
      } else if (type === 'subtheme') {
        if (!parentId) {
          setError('Please select a theme first');
          setSaving(false);
          return;
        }
        // Find the parent theme
        let parentTheme: any = null;
        for (const p of structure?.pillars || []) {
          const theme = p.themes?.find((t: any) => t.id === parentId);
          if (theme) {
            parentTheme = theme;
            break;
          }
        }
        if (!parentTheme) {
          setError('Parent theme not found');
          setSaving(false);
          return;
        }
        
        const subthemes = parentTheme.subthemes || [];
        const maxOrder = subthemes.reduce((max: number, st: any) => 
          Math.max(max, st.order_index || 0), -1);
        const subthemeNum = subthemes.length + 1;
        newItem.theme_id = parentId;
        newItem.code = `${parentTheme.code}-ST${subthemeNum}`;
        newItem.order_index = maxOrder + 1;
        
        const { data, error } = await supabase
          .from('framework_subthemes')
          .insert(newItem)
          .select()
          .single();
        
        if (error) throw error;
        await loadStructure();
        if (data) {
          // Find parent pillar to expand
          let parentPillarId: string | null = null;
          for (const p of structure?.pillars || []) {
            if (p.themes?.some((t: any) => t.id === parentId)) {
              parentPillarId = p.id;
              break;
            }
          }
          if (parentPillarId) {
            setExpanded(prev => new Set([...prev, `p-${parentPillarId}`, `t-${parentId}`, `st-${data.id}`]));
          }
          handleEdit('subtheme', data, structure?.pillars?.flatMap((p: any) => p.themes || []));
        }
      } else if (type === 'indicator') {
        if (!parentId || !parentType) {
          setError('Please select a parent (pillar, theme, or subtheme)');
          setSaving(false);
          return;
        }
        
        let parentCode = '';
        let indicators: any[] = [];
        
        if (parentType === 'pillar') {
          const parentPillar = structure?.pillars?.find((p: any) => p.id === parentId);
          if (!parentPillar) {
            setError('Parent pillar not found');
            setSaving(false);
            return;
          }
          parentCode = parentPillar.code;
          indicators = parentPillar.indicators || [];
          // Explicitly set pillar_id and null out other parent fields to satisfy constraint
          newItem.pillar_id = parentId;
          newItem.theme_id = null;
          newItem.subtheme_id = null;
        } else if (parentType === 'theme') {
          let parentTheme: any = null;
          for (const p of structure?.pillars || []) {
            const theme = p.themes?.find((t: any) => t.id === parentId);
            if (theme) {
              parentTheme = theme;
              break;
            }
          }
          if (!parentTheme) {
            setError('Parent theme not found');
            setSaving(false);
            return;
          }
          parentCode = parentTheme.code;
          // Get indicators from the loaded structure, or query directly if not available
          indicators = parentTheme.indicators || [];
          
          // If indicators array is empty or undefined, it might not be loaded yet
          // This is okay - we'll just start from 0
          console.log('[FrameworkStructureManager] Adding indicator to theme:', {
            themeId: parentId,
            themeCode: parentCode,
            existingIndicators: indicators.length
          });
          
          // Explicitly set theme_id and null out other parent fields to satisfy constraint
          newItem.theme_id = parentId;
          newItem.pillar_id = null;
          newItem.subtheme_id = null;
        } else if (parentType === 'subtheme') {
          let parentSubtheme: any = null;
          for (const p of structure?.pillars || []) {
            for (const t of p.themes || []) {
              const subtheme = t.subthemes?.find((st: any) => st.id === parentId);
              if (subtheme) {
                parentSubtheme = subtheme;
                break;
              }
            }
            if (parentSubtheme) break;
          }
          if (!parentSubtheme) {
            setError('Parent subtheme not found');
            setSaving(false);
            return;
          }
          parentCode = parentSubtheme.code;
          indicators = parentSubtheme.indicators || [];
          // Explicitly set subtheme_id and null out other parent fields to satisfy constraint
          newItem.subtheme_id = parentId;
          newItem.pillar_id = null;
          newItem.theme_id = null;
        }
        
        const maxOrder = indicators.reduce((max: number, i: any) => 
          Math.max(max, i.order_index || 0), -1);
        const indicatorNum = indicators.length + 1;
        newItem.code = `${parentCode}-I${indicatorNum}`;
        newItem.order_index = maxOrder + 1;
        
        // Ensure data_type is set (required field)
        if (!newItem.data_type) {
          newItem.data_type = 'numeric'; // Default to numeric
        }
        
        console.log('[FrameworkStructureManager] Inserting new indicator:', {
          code: newItem.code,
          name: newItem.name,
          pillar_id: newItem.pillar_id,
          theme_id: newItem.theme_id,
          subtheme_id: newItem.subtheme_id,
          parentType,
          data_type: newItem.data_type
        });
        
        const { data, error } = await supabase
          .from('framework_indicators')
          .insert(newItem)
          .select()
          .single();
        
        if (error) {
          console.error('[FrameworkStructureManager] Error inserting indicator:', {
            error,
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            newItem: {
              code: newItem.code,
              name: newItem.name,
              pillar_id: newItem.pillar_id,
              theme_id: newItem.theme_id,
              subtheme_id: newItem.subtheme_id
            }
          });
          
          // Check if it's a schema cache error
          if (error.message?.includes('pillar_id') || 
              error.message?.includes('theme_id') ||
              error.message?.includes('Could not find') ||
              error.code === 'PGRST202') {
            throw new Error(
              `Schema cache error: ${error.message}\n\n` +
              `The database column may not be recognized yet. Please:\n` +
              `1. Go to your Supabase Dashboard\n` +
              `2. Navigate to Settings > API\n` +
              `3. Click "Reload schema" button\n` +
              `4. Wait 1-2 minutes, then try again`
            );
          }
          
          // Check for constraint violations
          if (error.code === '23505' || error.message?.includes('unique constraint') || error.message?.includes('duplicate key')) {
            throw new Error(
              `Duplicate indicator code: ${newItem.code}\n\n` +
              `An indicator with this code already exists at this level. Please use a different code.`
            );
          }
          
          // Check for check constraint violations (single parent constraint)
          if (error.code === '23514' || error.message?.includes('check constraint') || error.message?.includes('framework_indicators_single_parent_check')) {
            throw new Error(
              `Invalid indicator configuration: ${error.message}\n\n` +
              `An indicator must belong to exactly one parent (pillar, theme, or subtheme).`
            );
          }
          
          throw new Error(
            `Failed to add indicator: ${error.message || 'Unknown error'}\n\n` +
            `Error code: ${error.code || 'N/A'}\n` +
            `Please check the browser console for more details.`
          );
        }
        
        console.log('[FrameworkStructureManager] Successfully inserted indicator:', data);
        await loadStructure();
        if (data) {
          // Expand parent to show new indicator
          if (parentType === 'pillar') {
            setExpanded(prev => new Set([...prev, `p-${parentId}`]));
          } else if (parentType === 'theme') {
            let parentPillarId: string | null = null;
            for (const p of structure?.pillars || []) {
              if (p.themes?.some((t: any) => t.id === parentId)) {
                parentPillarId = p.id;
                break;
              }
            }
            if (parentPillarId) {
              setExpanded(prev => new Set([...prev, `p-${parentPillarId}`, `t-${parentId}`]));
            }
          } else if (parentType === 'subtheme') {
            let parentPillarId: string | null = null;
            let parentThemeId: string | null = null;
            for (const p of structure?.pillars || []) {
              for (const t of p.themes || []) {
                if (t.subthemes?.some((st: any) => st.id === parentId)) {
                  parentPillarId = p.id;
                  parentThemeId = t.id;
                  break;
                }
              }
              if (parentPillarId) break;
            }
            if (parentPillarId && parentThemeId) {
              setExpanded(prev => new Set([...prev, `p-${parentPillarId}`, `t-${parentThemeId}`, `st-${parentId}`]));
            }
          }
          handleEdit('indicator', data, structure?.pillars?.flatMap((p: any) => 
            p.themes?.flatMap((t: any) => t.subthemes || []) || []
          ) || []);
        }
      }
    } catch (err: any) {
      console.error('Error adding new item:', err);
      setError(err.message || 'Failed to add new item');
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
        // Find indicator at any level (pillar, theme, or subtheme)
        for (const p of structure.pillars || []) {
          // Check pillar-level indicators
          const pillarIndicator = p.indicators?.find((i: any) => i.id === activeId);
          if (pillarIndicator) {
            items = [...(p.indicators || [])];
            parentId = p.id;
            break;
          }
          // Check theme-level indicators
          for (const t of p.themes || []) {
            const themeIndicator = t.indicators?.find((i: any) => i.id === activeId);
            if (themeIndicator) {
              items = [...(t.indicators || [])];
              parentId = t.id;
              break;
            }
            // Check subtheme-level indicators
            for (const st of t.subthemes || []) {
              const subthemeIndicator = st.indicators?.find((i: any) => i.id === activeId);
              if (subthemeIndicator) {
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

    // Only allow moving themes to pillars, subthemes to themes, indicators to pillars/themes/subthemes
    const validMoves: Record<string, string[]> = {
      theme: ['pillar'],
      subtheme: ['theme'],
      indicator: ['pillar', 'theme', 'subtheme']
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
        // Find indicator at any level (pillar, theme, or subtheme)
        for (const p of structure.pillars || []) {
          // Check pillar-level indicators
          const pillarIndicator = p.indicators?.find((i: any) => i.id === activeId);
          if (pillarIndicator) {
            activeItem = pillarIndicator;
            break;
          }
          // Check theme-level indicators
          for (const t of p.themes || []) {
            const themeIndicator = t.indicators?.find((i: any) => i.id === activeId);
            if (themeIndicator) {
              activeItem = themeIndicator;
              break;
            }
            // Check subtheme-level indicators
            for (const st of t.subthemes || []) {
              const subthemeIndicator = st.indicators?.find((i: any) => i.id === activeId);
              if (subthemeIndicator) {
                activeItem = subthemeIndicator;
                break;
              }
            }
            if (activeItem) break;
          }
          if (activeItem) break;
        }
        
        // Find the target parent (pillar, theme, or subtheme)
        if (overType === 'pillar') {
          const targetPillar = structure.pillars?.find((p: any) => p.id === overId);
          if (targetPillar) newParentId = targetPillar.id;
        } else if (overType === 'theme') {
          for (const p of structure.pillars || []) {
            const theme = p.themes?.find((t: any) => t.id === overId);
            if (theme) {
              newParentId = theme.id;
              break;
            }
          }
        } else if (overType === 'subtheme') {
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
        if (overType === 'pillar') {
          const targetPillar = structure.pillars?.find((p: any) => p.id === newParentId);
          newSiblings = [...(targetPillar?.indicators || [])];
        } else if (overType === 'theme') {
          for (const p of structure.pillars || []) {
            const theme = p.themes?.find((t: any) => t.id === newParentId);
            if (theme) {
              newSiblings = [...(theme.indicators || [])];
              break;
            }
          }
        } else if (overType === 'subtheme') {
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
        // Clear all parent IDs first
        updateData.pillar_id = null;
        updateData.theme_id = null;
        updateData.subtheme_id = null;
        // Set the appropriate parent ID based on target type
        if (overType === 'pillar') {
          updateData.pillar_id = newParentId;
        } else if (overType === 'theme') {
          updateData.theme_id = newParentId;
        } else if (overType === 'subtheme') {
          updateData.subtheme_id = newParentId;
        }
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
      
      // Fix indicator ordering within each pillar
      (structure.pillars || []).forEach((p: any) => {
        (p.indicators || []).forEach((i: any, index: number) => {
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
      
      // Fix indicator ordering within each theme
      (structure.pillars || []).forEach((p: any) => {
        (p.themes || []).forEach((t: any) => {
          (t.indicators || []).forEach((i: any, index: number) => {
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setError(null)}
                      className="px-3 py-1.5 text-sm bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => {
                        setError(null);
                        loadStructure();
                      }}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition"
                    >
                      Retry
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600 transition flex-shrink-0"
                  title="Dismiss error"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Quick Create Section */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Quick Create</h3>
                  <button
                    onClick={() => handleAddNew('pillar')}
                    disabled={saving || editing !== null}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Add Pillar
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      // Check if Hazards pillar already exists
                      const hazardsExists = structure?.pillars?.some((p: any) => 
                        p.code === 'Hazards' || p.name.toLowerCase().includes('hazard')
                      );
                      if (hazardsExists) {
                        setError('A Hazards pillar already exists');
                        return;
                      }
                      const maxOrder = structure?.pillars?.reduce((max: number, p: any) => 
                        Math.max(max, p.order_index || 0), -1) || -1;
                      const { data, error } = await supabase
                        .from('framework_pillars')
                        .insert({
                          code: 'Hazards',
                          name: 'Hazards',
                          description: 'Hazard exposure and risk assessment',
                          order_index: maxOrder + 1,
                          is_active: true,
                        })
                        .select()
                        .single();
                      if (error) {
                        setError(error.message);
                      } else {
                        await loadStructure();
                        if (data) {
                          setExpanded(prev => new Set([...prev, `p-${data.id}`]));
                        }
                      }
                    }}
                    disabled={saving || editing !== null}
                    className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Add Hazards Pillar
                  </button>
                  <button
                    onClick={async () => {
                      // Check if Underlying Vulnerabilities pillar already exists
                      const vulnExists = structure?.pillars?.some((p: any) => 
                        p.code === 'Underlying Vulnerabilities' || p.name.toLowerCase().includes('underlying vulnerability')
                      );
                      if (vulnExists) {
                        setError('An Underlying Vulnerabilities pillar already exists');
                        return;
                      }
                      const maxOrder = structure?.pillars?.reduce((max: number, p: any) => 
                        Math.max(max, p.order_index || 0), -1) || -1;
                      const { data, error } = await supabase
                        .from('framework_pillars')
                        .insert({
                          code: 'Underlying Vulnerabilities',
                          name: 'Underlying Vulnerabilities',
                          description: 'Pre-existing vulnerabilities and risk factors',
                          order_index: maxOrder + 1,
                          is_active: true,
                        })
                        .select()
                        .single();
                      if (error) {
                        setError(error.message);
                      } else {
                        await loadStructure();
                        if (data) {
                          setExpanded(prev => new Set([...prev, `p-${data.id}`]));
                        }
                      }
                    }}
                    disabled={saving || editing !== null}
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Add Underlying Vulnerabilities Pillar
                  </button>
                </div>
              </div>

              {structure && structure.pillars && structure.pillars.length > 0 ? (
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
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
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
                          <textarea
                            value={editData?.description || ''}
                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Description (optional)"
                            rows={2}
                          />
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-medium text-gray-500 uppercase">Pillar</span>
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
                            onClick={() => handleAddNew('theme', pillar.id)}
                            disabled={saving || editing !== null}
                            className="p-1 text-green-600 hover:text-green-700"
                            title="Add new theme"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => handleAddNew('indicator', pillar.id, 'pillar')}
                            disabled={saving || editing !== null}
                            className="p-1 text-purple-600 hover:text-purple-700"
                            title="Add indicator to pillar"
                          >
                            <Plus size={14} />
                          </button>
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

                        {/* Pillar-level Indicators */}
                        {expanded.has(`p-${pillar.id}`) && pillar.indicators && pillar.indicators.length > 0 && (
                          <SortableContext
                            items={pillar.indicators.map(i => `indicator-${i.id}`)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="border-t border-gray-200 bg-purple-50">
                              <div className="px-4 py-2 text-xs font-medium text-purple-700 uppercase">Pillar Indicators</div>
                              {pillar.indicators.map((indicator) => (
                                <SortableItem key={indicator.id} id={indicator.id} type="indicator" disabled={editing !== null}>
                                  <div className="border-t border-purple-200 bg-white px-4 py-1.5 flex items-center justify-between pl-8">
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
                                            value={editData?.pillar_id || ''}
                                            onChange={(e) => {
                                              const newPillarId = e.target.value;
                                              const newPillar = structure?.pillars?.find((p: any) => p.id === newPillarId);
                                              let newCode = editData?.code || '';
                                              if (newPillar && editData?.code) {
                                                const match = editData.code.match(/-I(\d+)$/);
                                                if (match) {
                                                  newCode = `${newPillar.code}-I${match[1]}`;
                                                }
                                              }
                                              setEditData({ ...editData, pillar_id: newPillarId || null, theme_id: null, subtheme_id: null, code: newCode });
                                            }}
                                            className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[150px]"
                                            title="Attach to pillar"
                                          >
                                            <option value="">Select pillar...</option>
                                            {structure?.pillars?.map((p: any) => (
                                              <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                            ))}
                                          </select>
                                          <select
                                            value={editData?.theme_id || ''}
                                            onChange={(e) => {
                                              const newThemeId = e.target.value;
                                              const newTheme = structure?.pillars?.flatMap((p: any) => p.themes || []).find((t: any) => t.id === newThemeId);
                                              let newCode = editData?.code || '';
                                              if (newTheme && editData?.code) {
                                                const match = editData.code.match(/-I(\d+)$/);
                                                if (match) {
                                                  newCode = `${newTheme.code}-I${match[1]}`;
                                                }
                                              }
                                              setEditData({ ...editData, theme_id: newThemeId || null, pillar_id: null, subtheme_id: null, code: newCode });
                                            }}
                                            className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[200px]"
                                            title="Attach to theme"
                                          >
                                            <option value="">Select theme...</option>
                                            {structure?.pillars?.flatMap((p: any) => 
                                              p.themes?.map((t: any) => (
                                                <option key={t.id} value={t.id}>{p.code} → {t.name}</option>
                                              )) || []
                                            )}
                                          </select>
                                          <select
                                            value={editData?.subtheme_id || ''}
                                            onChange={(e) => {
                                              const newSubthemeId = e.target.value;
                                              const newSubtheme = structure?.pillars?.flatMap((p: any) => 
                                                p.themes?.flatMap((t: any) => t.subthemes || []) || []
                                              ).find((st: any) => st.id === newSubthemeId);
                                              let newCode = editData?.code || '';
                                              if (newSubtheme && editData?.code) {
                                                const match = editData.code.match(/-I(\d+)$/);
                                                if (match) {
                                                  newCode = `${newSubtheme.code}-I${match[1]}`;
                                                }
                                              }
                                              setEditData({ ...editData, subtheme_id: newSubthemeId || null, pillar_id: null, theme_id: null, code: newCode });
                                            }}
                                            className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[250px]"
                                            title="Attach to subtheme"
                                          >
                                            <option value="">Select subtheme...</option>
                                            {structure?.pillars?.flatMap((p: any) => 
                                              p.themes?.flatMap((t: any) => 
                                                t.subthemes?.map((st: any) => (
                                                  <option key={st.id} value={st.id}>{p.code} → {t.name} → {st.name}</option>
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
                            </div>
                          </SortableContext>
                        )}

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
                            <div className="flex-1 flex flex-col gap-2">
                              <div className="flex items-center gap-2">
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
                              <textarea
                                value={editData?.description || ''}
                                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Description (optional)"
                                rows={2}
                              />
                            </div>
                          ) : (
                            <>
                              <span className="text-xs font-medium text-gray-500 uppercase">Theme</span>
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
                            onClick={() => handleAddNew('subtheme', theme.id)}
                            disabled={saving || editing !== null}
                            className="p-1 text-green-600 hover:text-green-700"
                            title="Add new subtheme"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => handleAddNew('indicator', theme.id, 'theme')}
                            disabled={saving || editing !== null}
                            className="p-1 text-purple-600 hover:text-purple-700"
                            title="Add indicator to theme"
                          >
                            <Plus size={12} />
                          </button>
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

                                {/* Theme-level Indicators */}
                                {expanded.has(`t-${theme.id}`) && theme.indicators && theme.indicators.length > 0 && (
                                  <SortableContext
                                    items={theme.indicators.map(i => `indicator-${i.id}`)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <div className="border-t border-gray-200 bg-purple-50">
                                      <div className="px-4 py-1.5 text-xs font-medium text-purple-700 uppercase pl-12">Theme Indicators</div>
                                      {theme.indicators.map((indicator) => (
                                        <SortableItem key={indicator.id} id={indicator.id} type="indicator" disabled={editing !== null}>
                                          <div className="border-t border-purple-200 bg-white px-4 py-1.5 flex items-center justify-between pl-16">
                                            <div className="flex items-center gap-2 flex-1">
                                              {editing === `indicator-${indicator.id}` ? (
                                                <div className="flex-1 flex items-center gap-1">
                                                  <input
                                                    type="text"
                                                    value={editData?.code || ''}
                                                    onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                                    placeholder="Code"
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
                                                    value={editData?.pillar_id || ''}
                                                    onChange={(e) => {
                                                      const newPillarId = e.target.value;
                                                      const newPillar = structure?.pillars?.find((p: any) => p.id === newPillarId);
                                                      let newCode = editData?.code || '';
                                                      if (newPillar && editData?.code) {
                                                        const match = editData.code.match(/-I(\d+)$/);
                                                        if (match) newCode = `${newPillar.code}-I${match[1]}`;
                                                      }
                                                      setEditData({ ...editData, pillar_id: newPillarId || null, theme_id: null, subtheme_id: null, code: newCode });
                                                    }}
                                                    className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[150px]"
                                                  >
                                                    <option value="">Select pillar...</option>
                                                    {structure?.pillars?.map((p: any) => (
                                                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                                    ))}
                                                  </select>
                                                  <select
                                                    value={editData?.theme_id || ''}
                                                    onChange={(e) => {
                                                      const newThemeId = e.target.value;
                                                      const newTheme = structure?.pillars?.flatMap((p: any) => p.themes || []).find((t: any) => t.id === newThemeId);
                                                      let newCode = editData?.code || '';
                                                      if (newTheme && editData?.code) {
                                                        const match = editData.code.match(/-I(\d+)$/);
                                                        if (match) newCode = `${newTheme.code}-I${match[1]}`;
                                                      }
                                                      setEditData({ ...editData, theme_id: newThemeId || null, pillar_id: null, subtheme_id: null, code: newCode });
                                                    }}
                                                    className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[200px]"
                                                  >
                                                    <option value="">Select theme...</option>
                                                    {structure?.pillars?.flatMap((p: any) => 
                                                      p.themes?.map((t: any) => (
                                                        <option key={t.id} value={t.id}>{p.code} → {t.name}</option>
                                                      )) || []
                                                    )}
                                                  </select>
                                                  <select
                                                    value={editData?.subtheme_id || ''}
                                                    onChange={(e) => {
                                                      const newSubthemeId = e.target.value;
                                                      const newSubtheme = structure?.pillars?.flatMap((p: any) => 
                                                        p.themes?.flatMap((t: any) => t.subthemes || []) || []
                                                      ).find((st: any) => st.id === newSubthemeId);
                                                      let newCode = editData?.code || '';
                                                      if (newSubtheme && editData?.code) {
                                                        const match = editData.code.match(/-I(\d+)$/);
                                                        if (match) newCode = `${newSubtheme.code}-I${match[1]}`;
                                                      }
                                                      setEditData({ ...editData, subtheme_id: newSubthemeId || null, pillar_id: null, theme_id: null, code: newCode });
                                                    }}
                                                    className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[250px]"
                                                  >
                                                    <option value="">Select subtheme...</option>
                                                    {structure?.pillars?.flatMap((p: any) => 
                                                      p.themes?.flatMap((t: any) => 
                                                        t.subthemes?.map((st: any) => (
                                                          <option key={st.id} value={st.id}>{p.code} → {t.name} → {st.name}</option>
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
                                    </div>
                                  </SortableContext>
                                )}

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
                                  <span className="text-xs font-medium text-gray-500 uppercase">Subtheme</span>
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
                                    onClick={() => handleAddNew('indicator', subtheme.id, 'subtheme')}
                                    disabled={saving || editing !== null}
                                    className="p-1 text-purple-600 hover:text-purple-700"
                                    title="Add indicator to subtheme"
                                  >
                                    <Plus size={12} />
                                  </button>
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
                                      value={editData?.pillar_id || ''}
                                      onChange={(e) => {
                                        const newPillarId = e.target.value;
                                        const newPillar = structure?.pillars?.find((p: any) => p.id === newPillarId);
                                        let newCode = editData?.code || '';
                                        if (newPillar && editData?.code) {
                                          const match = editData.code.match(/-I(\d+)$/);
                                          if (match) newCode = `${newPillar.code}-I${match[1]}`;
                                        }
                                        setEditData({ ...editData, pillar_id: newPillarId || null, theme_id: null, subtheme_id: null, code: newCode });
                                      }}
                                      className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[150px]"
                                      title="Attach to pillar"
                                    >
                                      <option value="">Select pillar...</option>
                                      {structure?.pillars?.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                      ))}
                                    </select>
                                    <select
                                      value={editData?.theme_id || ''}
                                      onChange={(e) => {
                                        const newThemeId = e.target.value;
                                        const newTheme = structure?.pillars?.flatMap((p: any) => p.themes || []).find((t: any) => t.id === newThemeId);
                                        let newCode = editData?.code || '';
                                        if (newTheme && editData?.code) {
                                          const match = editData.code.match(/-I(\d+)$/);
                                          if (match) newCode = `${newTheme.code}-I${match[1]}`;
                                        }
                                        setEditData({ ...editData, theme_id: newThemeId || null, pillar_id: null, subtheme_id: null, code: newCode });
                                      }}
                                      className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[200px]"
                                      title="Attach to theme"
                                    >
                                      <option value="">Select theme...</option>
                                      {structure?.pillars?.flatMap((p: any) => 
                                        p.themes?.map((t: any) => (
                                          <option key={t.id} value={t.id}>{p.code} → {t.name}</option>
                                        )) || []
                                      )}
                                    </select>
                                    <select
                                      value={editData?.subtheme_id || ''}
                                      onChange={(e) => {
                                        const newSubthemeId = e.target.value;
                                        const newSubtheme = structure?.pillars?.flatMap((p: any) => 
                                          p.themes?.flatMap((t: any) => t.subthemes || []) || []
                                        ).find((st: any) => st.id === newSubthemeId);
                                        let newCode = editData?.code || '';
                                        if (newSubtheme && editData?.code) {
                                          const match = editData.code.match(/-I(\d+)$/);
                                          if (match) newCode = `${newSubtheme.code}-I${match[1]}`;
                                        }
                                        setEditData({ ...editData, subtheme_id: newSubthemeId || null, pillar_id: null, theme_id: null, code: newCode });
                                      }}
                                      className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[250px]"
                                      title="Attach to subtheme"
                                    >
                                      <option value="">Select subtheme...</option>
                                      {structure?.pillars?.flatMap((p: any) => 
                                        p.themes?.flatMap((t: any) => 
                                          t.subthemes?.map((st: any) => (
                                            <option key={st.id} value={st.id}>
                                              {p.code} → {t.name} → {st.name}
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
            </>
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
