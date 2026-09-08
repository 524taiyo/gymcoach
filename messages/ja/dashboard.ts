import { dashboard as english } from '../en/dashboard';
import type { MessageShape } from '@/i18n/message-types';

export const dashboard = {
  activeSession: 'アクティブセッション',
  sessionFallback: 'セッション',
  startedOn: '{name} - {date}開始',
  resumeSession: 'セッションを再開',
  noActiveProgram: 'アクティブなプログラムなし',
  noActiveProgramDescription: 'プログラムを有効化してセッションを開始してください。',
  viewPrograms: 'プログラムを見る',
  emptyProgram: '空のプログラム',
  emptyProgramDescription: '{name} にはセッションが設定されていません。',
  configureProgram: 'プログラムを設定',
  startSession: 'セッションを開始',
  activeProgram: 'アクティブプログラム: {name}',
  chooseSession: 'セッションを選択',
  programSessions: 'プログラムのセッション',
  insight: {
    deloadTitle: '回復が必要かもしれません',
    stalledTitle: '{count, plural, one {# つのリフトが停滞中} other {# つのリフトが停滞中}}',
    stalledDetail:
      '{count, plural, one {{names} は最近進歩していません。重量、回数、またはフォームを少し変えてみましょう。} other {{names} は最近進歩していません。進捗ページで調整点を確認してください。}}',
    prTitle: '新記録達成',
    prWeightDetail: '前回のセッションで {name} の最高重量を更新しました。',
    prOneRmDetail: '前回のセッションで {name} の推定1RM最高記録を更新しました。',
    consistentTitle: 'コンスタントにトレーニングしています',
    consistentDetail:
      '今週 {count, plural, one {# 日} other {# 日}} トレーニングしました。この調子を続けましょう。',
    deloadStalledReason:
      '{count, plural, one {# つのリフトが停滞中: {names}。} other {# つのリフトが停滞中: {names}。}}',
    deloadReadinessReason:
      '直近 {checkins, plural, one {# 回} other {# 回}} のチェックインでコンディションの平均が {average}/5 でした。',
  },
} satisfies MessageShape<typeof english>;
