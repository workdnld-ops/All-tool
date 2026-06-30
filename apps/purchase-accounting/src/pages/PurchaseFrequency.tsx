import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Calendar, AlertCircle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFirebaseArchivedLists, useFirebaseLists, useFirebaseTrackedPurchaseItems } from '@/hooks/useFirebase';
import { normalizeItemName, usePurchaseFrequency, ItemFrequency } from '@/hooks/usePurchaseFrequency';
import { toast } from 'sonner';

const PurchaseFrequency = () => {
  const navigate = useNavigate();
  const { lists, loading: listsLoading } = useFirebaseLists();
  const { archivedLists, loading: archivedLoading } = useFirebaseArchivedLists();
  const { trackedItems, loading: trackedItemsLoading, saveTrackedItems } = useFirebaseTrackedPurchaseItems();
  const [newItemName, setNewItemName] = useState('');
  
  const frequencies = usePurchaseFrequency([...lists, ...archivedLists], trackedItems);

  const handleAddTrackedItem = async () => {
    const name = normalizeItemName(newItemName);
    if (!name) return;
    const exists = trackedItems.some((item) => normalizeItemName(item) === name);
    if (exists) {
      toast.info('這個品項已經在統計清單裡');
      return;
    }
    await saveTrackedItems([...trackedItems, name]);
    setNewItemName('');
  };

  const handleRemoveTrackedItem = async (name: string) => {
    await saveTrackedItems(trackedItems.filter((item) => normalizeItemName(item) !== normalizeItemName(name)));
  };

  const formatDate = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  const getStatusBadge = (status: ItemFrequency['status']) => {
    switch (status) {
      case 'suggest_restock':
        return <Badge variant="destructive">建議補貨</Badge>;
      case 'need_soon':
        return <Badge variant="secondary">即將需要購買</Badge>;
      default:
        return <Badge variant="outline">正常</Badge>;
    }
  };

  const getStatusColor = (status: ItemFrequency['status']) => {
    switch (status) {
      case 'suggest_restock':
        return 'border-destructive/50 bg-destructive/5';
      case 'need_soon':
        return 'border-primary/50 bg-primary/5';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="h-12 flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-border px-4 flex items-center gap-2 sticky top-0 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="h-8 w-8"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { window.location.href = '/'; }}
          className="h-8 px-2 text-xs font-bold"
        >
          工具箱
        </Button>
        <h1 className="font-bold text-base">品項購買頻率統計</h1>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <Card className="mb-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">統計品項設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newItemName}
                onChange={(event) => setNewItemName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleAddTrackedItem()}
                placeholder="輸入要統計的品項名稱"
                className="h-9"
              />
              <Button type="button" size="sm" className="h-9 px-3" onClick={handleAddTrackedItem}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {trackedItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                尚未指定品項，目前會統計所有月份卡匣內的品項。新增品項後，統計與本月建議只會顯示指定品項。
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {trackedItems.map((item) => (
                  <Badge key={item} variant="secondary" className="gap-1 pr-1">
                    {item}
                    <button
                      type="button"
                      className="ml-1 rounded-full p-0.5 hover:bg-background/70"
                      onClick={() => handleRemoveTrackedItem(item)}
                      aria-label={`移除 ${item}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {listsLoading || archivedLoading || trackedItemsLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="mb-4 h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p>讀取購買紀錄中...</p>
            </CardContent>
          </Card>
        ) : frequencies.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mb-4 opacity-50" />
              <p>尚無購買記錄</p>
              <p className="text-sm mt-2">請先在主頁面新增卡片並填寫內容和日期</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {frequencies.map((item, index) => (
              <Card key={index} className={getStatusColor(item.status)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold">
                      {item.itemName}
                    </CardTitle>
                    {getStatusBadge(item.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>平均購買間隔</span>
                      </div>
                      <div className="font-medium">
                        {item.averageDaysBetween > 0 
                          ? `${item.averageDaysBetween} 天` 
                          : '資料不足'}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>上次購買</span>
                      </div>
                      <div className="font-medium">
                        {formatDate(item.lastPurchaseDate)}
                      </div>
                    </div>

                    {item.averageDaysBetween > 0 && (
                      <>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>預估下次購買</span>
                          </div>
                          <div className="font-medium">
                            {formatDate(item.nextPurchaseDate)}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-muted-foreground">
                            購買次數
                          </div>
                          <div className="font-medium">
                            {item.records.length} 次
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-1">
                      歷史記錄
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.records.slice(-5).map((record, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {formatDate(record.date)} · ${record.amount}
                        </Badge>
                      ))}
                      {item.records.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{item.records.length - 5} 筆
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseFrequency;
