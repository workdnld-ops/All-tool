import { Plus, Undo, Settings, Trash2, Download, Upload } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { APP_VERSION } from '@/lib/version';

interface HeaderProps {
  onAddList: () => void;
  onDeleteList: () => void;
  onRestoreList: () => void;
  canRestoreList: boolean;
  canDeleteList: boolean;
  onExport: () => void;
  onImport: () => void;
  onCopyBusinessNumber: () => void;
}

export function Header({ onAddList, onDeleteList, onRestoreList, canRestoreList, canDeleteList, onExport, onImport, onCopyBusinessNumber }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="h-12 flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-border px-4 flex items-center justify-between sticky top-0 z-50">
      <h1 className="font-semibold text-xs text-muted-foreground">v{APP_VERSION}</h1>
      
      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => { window.location.href = '/'; }}
          className="h-8 px-2 text-xs font-bold"
        >
          工具箱
        </Button>

        <Button
          variant="ghost"
          onClick={onCopyBusinessNumber}
          className="h-8 px-2 text-xs font-bold"
        >
          統編
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onAddList}
          className="h-8 w-8"
        >
          <Plus className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onDeleteList}
          disabled={!canDeleteList}
          className="h-8 w-8"
        >
          <Trash2 className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRestoreList}
          disabled={!canRestoreList}
          className="h-8 w-8"
        >
          <Undo className="w-4 h-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/frequency')}>
              購買頻率統計
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/tags')}>
              設定
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/archive')}>
              欄位封存區
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="w-4 h-4 mr-2" />
              匯出資料
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImport}>
              <Upload className="w-4 h-4 mr-2" />
              匯入資料
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
