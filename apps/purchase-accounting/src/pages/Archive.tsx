import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Archive as ArchiveIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { List as ListType, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import { useFirebaseLists, useFirebaseTags, useFirebaseArchivedLists } from '@/hooks/useFirebase';
import { DEFAULT_TAGS } from '@/types';

export default function Archive() {
  const navigate = useNavigate();
  const { lists: firebaseLists, saveLists } = useFirebaseLists();
  const { tags: firebaseTags } = useFirebaseTags();
  const { archivedLists: firebaseArchivedLists, loading, saveArchivedLists } = useFirebaseArchivedLists();
  
  const [archivedLists, setArchivedLists] = useState<ListType[]>([]);
  const [lists, setLists] = useState<ListType[]>([]);
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);

  // 同步 Firebase 資料到本地 state
  useEffect(() => {
    setArchivedLists(firebaseArchivedLists);
  }, [firebaseArchivedLists]);

  useEffect(() => {
    setLists(firebaseLists);
  }, [firebaseLists]);

  useEffect(() => {
    if (firebaseTags.length > 0) {
      setTags(firebaseTags);
    }
  }, [firebaseTags]);

  const handleUnarchive = async (listId: string) => {
    const list = archivedLists.find(l => l.id === listId);
    if (list) {
      const updatedLists = [...lists, list];
      setLists(updatedLists);
      await saveLists(updatedLists);
      
      const updatedArchivedLists = archivedLists.filter(l => l.id !== listId);
      setArchivedLists(updatedArchivedLists);
      await saveArchivedLists(updatedArchivedLists);
    }
  };

  const handleDelete = async (listId: string) => {
    const updatedArchivedLists = archivedLists.filter(l => l.id !== listId);
    setArchivedLists(updatedArchivedLists);
    await saveArchivedLists(updatedArchivedLists);
  };

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
      <header className="h-16 flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-border px-4 flex items-center gap-3">
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
        <h1 className="font-bold text-xl">欄位封存區</h1>
      </header>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {archivedLists.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            沒有封存的欄位
          </div>
        ) : (
          archivedLists.map((list) => {
            const totalAmount = list.cards.reduce((sum, card) => sum + card.amount, 0);
            
            return (
              <div
                key={list.id}
                className="bg-card rounded-lg p-4 border border-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{list.name}</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnarchive(list.id)}
                    >
                      <ArchiveIcon className="w-4 h-4 mr-2" />
                      解除封存
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(list.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-xl font-bold text-primary mb-3">
                  ${totalAmount.toLocaleString('zh-TW')}
                </div>

                <div className="space-y-2">
                  {list.cards.map((card) => {
                    const tag = tags.find(t => t.id === card.tagId);
                    return (
                      <div
                        key={card.id}
                        className="bg-background/50 rounded p-2 text-sm flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{card.date}</span>
                          {tag && (
                            <span className={`px-2 py-0.5 rounded text-xs bg-tag-${tag.color} text-white`}>
                              {tag.name}
                            </span>
                          )}
                          <span>{card.content}</span>
                        </div>
                        <span className="font-medium">${card.amount.toLocaleString('zh-TW')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
