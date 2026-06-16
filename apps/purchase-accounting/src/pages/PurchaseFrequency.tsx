import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { List as ListType, Tag } from '@/types';
import { DEFAULT_TAGS } from '@/types';
import { usePurchaseFrequency, ItemFrequency } from '@/hooks/usePurchaseFrequency';

const PurchaseFrequency = () => {
  const navigate = useNavigate();
  const [lists] = useLocalStorage<ListType[]>('lists', []);
  const [tags] = useLocalStorage<Tag[]>('tags', DEFAULT_TAGS);
  
  const frequencies = usePurchaseFrequency(lists);

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
        <h1 className="font-bold text-base">品項購買頻率統計</h1>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {frequencies.length === 0 ? (
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
