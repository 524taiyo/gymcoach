import { coach as english } from '../en/coach';
import type { MessageShape } from '@/i18n/message-types';

export const coach = {
  title: 'コーチ',
  description: 'AIによる週次トレーニングレビュー。',
  chatTitle: 'チャット',
  chatDescription: 'トレーニングデータをコンテキストとしてコーチと話しましょう。',
  conversation: '会話',
  client: {
    generating: '生成中 (10-20秒)...',
    request: '週次レビューをリクエスト',
    empty: 'まだレビューがありません。上からリクエストしてください。',
    unknownError: '不明なエラー',
    keyMissing: '{provider} キーが設定されていません',
    keySetup: 'コーチを有効にするには .env に {variable} を設定してください。',
    applied: '適用済み',
    debriefFrom: '{date} のレビュー',
    weekOf: '{date} の週',
  },
  chat: {
    apiKey: 'チャットを有効にするには .env に {variable} を設定してください。',
    liveSession: 'ライブセッション接続中。',
    new: '新規',
    placeholder: 'コーチにメッセージ...',
    send: '送信',
    liveSessionDescription:
      'コーチはここまでのセットと今回のワークアウトのプログラム目標を確認できます。',
    emptySession:
      'トレーニング中の質問はありますか？次のセット、重量の感覚、種目の変更について聞いてみましょう。',
    empty:
      '停滞の突破口、トレーニングボリューム、進歩、回復、またはケガの調整について質問してください。',
  },
  context: {
    title: 'コーチが見ているデータ',
    teaser: 'すべてのレビューの背景にあるトレーニングコンテキスト。タップして展開。',
    history: 'トレーニング履歴',
    goals: '目標',
    achieved: '達成済み',
    noGoals: '種目目標が設定されていません。',
    fatigue: '疲労',
    conditioning: 'コンディショニング',
    readiness: 'コンディション',
    historySummary:
      '{exercises, plural, one {# 種目} other {# 種目}} にわたる最近 {weeks, plural, one {# 週} other {# 週}} の履歴。',
    noHistory: 'まだセッションがありません。最初のワークアウトからコーチが学習を開始します。',
    goalProgress: '({percent}% 達成)',
    stalled: '停滞中のリフト: {names}。',
    noStalled: '停滞中のリフトは検出されていません。',
    deloadActive: '計画的なデロードウィークが進行中です。',
    deloadRecommended: 'デロードを推奨{reasons, select, none {。} other {: {reasons}。}}',
    noDeload: 'デロードの推奨はありません。',
    conditioningSummary:
      '今週: {minutes} 分{km, select, none {} other { · {km} km}} · {sessions, plural, one {# セッション} other {# セッション}} (目標 {target} 分/週)',
    today: '今日',
    daysAgo: '{days, plural, one {# 日前} other {# 日前}}',
    readinessSummary: '最後のチェックイン {when}: コンディション {readiness}/5、睡眠 {sleep}/5。',
    noReadiness: '過去7日間のコンディションチェックインがありません。',
    privacy:
      'このようなコンパクトなサマリーと最近のセット別トレーニングログがAIに送信されます。アカウントデータやトレーニング履歴以外の情報は送信されません。',
  },
  note: {
    title: 'コーチへのメモ',
    description:
      'トレーニングデータに現れない情報 (ケガ、体調不良、旅行など) を追加してください。',
    placeholder: '例: 肩が痛いので今週はプレスを軽めに。',
    clear: 'クリア',
    save: '保存',
    saved: 'メモを保存しました。',
    cleared: 'メモをクリアしました。',
    error: 'メモを保存できませんでした。',
  },
  adjustments: {
    title: '提案された調整',
    applied: '適用済み',
    description:
      'アクティブなプログラムに適用するものを選択してください。確認前に値を編集できます。',
    aria: '{exercise} の調整を適用',
    repsMin: '回数 最小',
    repsMax: '回数 最大',
    sets: 'セット数',
    rest: '休憩 (秒)',
    targetLoad: '目標重量',
    versus: ' (現在 {value})',
    applying: '適用中...',
    apply: '{count, plural, one {# つの調整} other {# つの調整}} を適用',
  },
} satisfies MessageShape<typeof english>;
