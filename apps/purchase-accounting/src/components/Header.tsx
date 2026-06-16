import { Plus, Undo, Settings, Trash2, Download, Upload } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onAddList: () => void;
  onDeleteList: () => void;
  onRestoreList: () => void;
  canRestoreList: boolean;
  canDeleteList: boolean;
  onExport: () => void;
  onImport: () => void;
}

export function Header({ onAddList, onDeleteList, onRestoreList, canRestoreList, canDeleteList, onExport, onImport }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="h-12 flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-border px-4 flex items-center justify-between sticky top-0 z-50">
      <h1 className="font-bold text-base">記帳本 v1.1.1</h1>
      
      <div className="flex gap-2">
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
              標籤設定
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
