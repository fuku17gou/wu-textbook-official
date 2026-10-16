import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { to, subject, text, type } = await request.json();

    if (!to || !to.includes('@')) {
      return NextResponse.json({ error: '有効なメールアドレスではありません' }, { status: 400 });
    }

    const from = '和歌山大学 教科書フリマ <onboarding@resend.dev>';

    let emailContent = text;
    let finalSubject = subject || '【キャンパスフリマ】新しいお知らせ';

    if (type === 'test') {
      emailContent = `【テスト通知】\n\nキャンパスフリマからの通知設定が正常に完了しました！\n今後、チャットメッセージや商品の取引更新があった際にこちらのメールアドレスへ通知が届きます。`;
    } else {
      // ★ 毎回件名をユニークにしてスレッド化（まとまるの）を防ぐ
      const timeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      finalSubject = `${finalSubject} (${timeStr})`;
    }

    const data = await resend.emails.send({
      from: from,
      to: [to],
      subject: finalSubject, // ★ 修正した件名を使用
      text: emailContent,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: error.message || 'メール送信に失敗しました' }, { status: 500 });
  }
}