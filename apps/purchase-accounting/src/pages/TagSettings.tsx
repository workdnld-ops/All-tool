import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tag, TAG_COLORS, SnackBudgetSettings, DEFAULT_SNACK_BUDGET } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirebaseTags, useFirebaseSnackBudget } from '@/hooks/useFirebase';
import { DEFAULT_TAGS } from '@/types';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function TagSettings() {
  const navigate = useNavigate();
  const { tags: firebaseTags, loading: tagsLoading, saveTags } = useFirebaseTags();
  const { snackBudget: firebaseSnackBudget, loading: budgetLoading, saveSnackBudget } = useFirebaseSnackBudget();
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [snackBudget, setSnackBudget] = useState<SnackBudgetSettings>(DEFAULT_SNACK_BUDGET);
  const [tempNeihu, setTempNeihu] = useState('');
  const [tempRuiguang, setTempRuiguang] = useState('');
  const [editingBudget, setEditingBudget] = useState<'neihu' | 'ruiguang' | null>(null);

  // 同步 Firebase 資料到本地 state
  useEffect(() => {
    if (!tagsLoading && firebaseTags.length > 0) {
      setTags(firebaseTags);
    }
  }, [firebaseTags, tagsLoading]);

  useEffect(() => {
    if (!budgetLoading) {
      setSnackBudget(firebaseSnackBudget);
    }
  }, [firebaseSnackBudget, budgetLoading]);

  const handleAddTag = async () => {
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      name: '新標籤',
      color: 'sky',
    };
    const updatedTags = [...tags, newTag];
    setTags(updatedTags);
    await saveTags(updatedTags);
  };

  const handleUpdateTag = async (id: string, updates: Partial<Tag>) => {
    const updatedTags = tags.map(tag => tag.id === id ? { ...tag, ...updates } : tag);
    setTags(updatedTags);
    await saveTags(updatedTags);
  };

  const handleDeleteTag = async (id: string) => {
    const updatedTags = tags.filter(tag => tag.id !== id);
    setTags(updatedTags);
    await saveTags(updatedTags);
  };

  const handleNameSubmit = async (id: string) => {
    if (tempName.trim()) {
      await handleUpdateTag(id, { name: tempName });
    }
    setEditingId(null);
  };

  const handleBudgetSubmit = async (type: 'neihu' | 'ruiguang') => {
    const value = type === 'neihu' ? parseInt(tempNeihu) : parseInt(tempRuiguang);
    if (!isNaN(value) && value >= 0) {
      const updatedBudget = { ...snackBudget, [type]: value };
      setSnackBudget(updatedBudget);
      await saveSnackBudget(updatedBudget);
    }
    setEditingBudget(null);
  };

  const loading = tagsLoading || budgetLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-border px-4 flex items-center gap-3 pt-[env(safe-area-inset-top)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { window.location.href = '/'; }}
          className="h-8 px-2 text-xs font-bold"
        >
          工具箱
        </Button>
        <h1 className="font-bold text-xl">設定</h1>
      </header>

      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* 零食預算設定 */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">零食預算</h2>
          <div className="bg-card rounded-lg p-4 border border-border space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-16 text-muted-foreground">內湖：</span>
              {editingBudget === 'neihu' ? (
                <Input
                  value={tempNeihu}
                  onChange={(e) => setTempNeihu(e.target.value)}
                  onBlur={() => handleBudgetSubmit('neihu')}
                  onKeyDown={(e) => e.key === 'Enter' && handleBudgetSubmit('neihu')}
                  className="flex-1"
                  inputMode="numeric"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingBudget('neihu');
                    setTempNeihu(snackBudget.neihu.toString());
                  }}
                  className="flex-1 text-left font-medium hover:text-primary"
                >
                  ${snackBudget.neihu.toLocaleString('zh-TW')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 text-muted-foreground">瑞光：</span>
              {editingBudget === 'ruiguang' ? (
                <Input
                  value={tempRuiguang}
                  onChange={(e) => setTempRuiguang(e.target.value)}
                  onBlur={() => handleBudgetSubmit('ruiguang')}
                  onKeyDown={(e) => e.key === 'Enter' && handleBudgetSubmit('ruiguang')}
                  className="flex-1"
                  inputMode="numeric"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingBudget('ruiguang');
                    setTempRuiguang(snackBudget.ruiguang.toString());
                  }}
                  className="flex-1 text-left font-medium hover:text-primary"
                >
                  ${snackBudget.ruiguang.toLocaleString('zh-TW')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 標籤設定 */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">標籤管理</h2>
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="bg-card rounded-lg p-4 border border-border flex items-center gap-3"
            >
              {editingId === tag.id ? (
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={() => handleNameSubmit(tag.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit(tag.id)}
                  className="flex-1"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingId(tag.id);
                    setTempName(tag.name);
                  }}
                  className="flex-1 text-left font-medium hover:text-primary"
                >
                  {tag.name}
                </button>
              )}

              <Select
                value={tag.color}
                onValueChange={(color) => handleUpdateTag(tag.id, { color })}
              >
                <SelectTrigger className="w-10 h-10 p-0 flex items-center justify-center">
                  <div className={cn('w-6 h-6 rounded', `bg-tag-${tag.color}`)} />
                </SelectTrigger>
                <SelectContent>
                  {TAG_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className={cn('w-6 h-6 rounded', color.class)} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteTag(tag.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleAddTag}
          >
            <Plus className="w-4 h-4 mr-2" />
            新增標籤
          </Button>
        </div>
      </div>
    </div>
  );
}
