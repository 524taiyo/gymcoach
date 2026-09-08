import { navigation as english } from '../en/navigation';
import type { MessageShape } from '@/i18n/message-types';

export const navigation = {
  home: 'ホーム',
  history: '履歴',
  progress: '進捗',
  coach: 'コーチ',
  chat: 'チャット',
  programs: 'プログラム',
  catalog: 'カタログ',
  settings: '設定',
} satisfies MessageShape<typeof english>;
