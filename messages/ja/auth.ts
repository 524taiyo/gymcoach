import { auth as english } from '../en/auth';
import type { MessageShape } from '@/i18n/message-types';

export const auth = {
  login: {
    title: 'ログイン',
    description: 'トレーニング記録にアクセスします。',
    submit: 'ログイン',
    submitting: 'ログイン中...',
    demoTitle: 'デモアカウント',
    demoSubmit: 'デモでログイン',
    noAccount: 'アカウントをお持ちでないですか？',
    createAccount: '作成する',
    error: 'ログインエラー。',
  },
  signup: {
    title: 'アカウント作成',
    description: 'トレーニング記録を始めましょう。',
    submit: 'アカウント作成',
    submitting: '作成中...',
    hasAccount: 'すでにアカウントをお持ちですか？',
    signIn: 'ログイン',
    error: '登録エラー。',
  },
  logout: 'ログアウト',
  validation: {
    invalidEmail: '無効なメールアドレス',
    nameRequired: '名前を入力してください',
    passwordRequired: 'パスワードを入力してください',
    passwordMin: 'パスワードは8文字以上にしてください',
  },
} satisfies MessageShape<typeof english>;
